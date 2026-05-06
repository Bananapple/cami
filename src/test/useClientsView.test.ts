import { describe, it, expect } from "vitest";
import {
  frequencyTier,
  inSegment,
  inTag,
  DEFAULT_SEGMENT_CONFIG,
  type MemberSummary,
} from "@/manage/hooks/useClientsView";

const dayMs = 86_400_000;
const now = Date.now();
const d = (n: number) => new Date(now - n * dayMs).toISOString();

const baseMember: Partial<MemberSummary> = {
  status: "active",
  total_sessions: 0,
  membership_id: null,
  last_booking_at: null,
  bookings_last_30d: 0,
  bookings_last_90d: 0,
  plan_type: null,
  source: null,
  top_time_bucket: null,
  top_template_id: null,
  credits_expiring_soon: false,
  sub_renewing_soon: false,
};

const mk = (o: Partial<MemberSummary>): MemberSummary =>
  ({ ...baseMember, ...o }) as MemberSummary;

describe("frequencyTier", () => {
  it("returns 'none' below casualMin", () => {
    expect(frequencyTier(mk({ bookings_last_30d: 0 }), DEFAULT_SEGMENT_CONFIG)).toBe("none");
  });
  it("returns 'casual' at the casualMin boundary (1)", () => {
    expect(frequencyTier(mk({ bookings_last_30d: 1 }), DEFAULT_SEGMENT_CONFIG)).toBe("casual");
  });
  it("returns 'regular' at the regularMin boundary (4)", () => {
    expect(frequencyTier(mk({ bookings_last_30d: 4 }), DEFAULT_SEGMENT_CONFIG)).toBe("regular");
  });
  it("returns 'devotee' at the devoteeMin boundary (8)", () => {
    expect(frequencyTier(mk({ bookings_last_30d: 8 }), DEFAULT_SEGMENT_CONFIG)).toBe("devotee");
  });
  it("returns 'devotee' for very high counts", () => {
    expect(frequencyTier(mk({ bookings_last_30d: 100 }), DEFAULT_SEGMENT_CONFIG)).toBe("devotee");
  });
  it("respects custom thresholds", () => {
    const strict = {
      ...DEFAULT_SEGMENT_CONFIG,
      frequency: { casualMin: 2, regularMin: 6, devoteeMin: 12 },
    };
    expect(frequencyTier(mk({ bookings_last_30d: 1 }), strict)).toBe("none");
    expect(frequencyTier(mk({ bookings_last_30d: 5 }), strict)).toBe("casual");
    expect(frequencyTier(mk({ bookings_last_30d: 11 }), strict)).toBe("regular");
    expect(frequencyTier(mk({ bookings_last_30d: 12 }), strict)).toBe("devotee");
  });
});

describe("inSegment", () => {
  it("'all' matches every member", () => {
    expect(inSegment(mk({ joined_at: d(500) }), "all")).toBe(true);
  });

  it("'new' matches members joined within newDays", () => {
    expect(inSegment(mk({ joined_at: d(10) }), "new")).toBe(true);
    expect(inSegment(mk({ joined_at: d(40) }), "new")).toBe(false);
  });

  it("'on_leave' is exclusive — excludes from other lifecycle buckets", () => {
    expect(inSegment(mk({ joined_at: d(5), status: "on_leave" }), "new")).toBe(false);
    expect(inSegment(mk({ joined_at: d(5), status: "on_leave" }), "on_leave")).toBe(true);
  });

  it("'one_timer' requires total_sessions==1 AND cooldown elapsed", () => {
    expect(
      inSegment(mk({ joined_at: d(60), total_sessions: 1, last_booking_at: d(20) }), "one_timer"),
    ).toBe(true);
    expect(
      inSegment(mk({ joined_at: d(60), total_sessions: 1, last_booking_at: d(5) }), "one_timer"),
    ).toBe(false);
    expect(
      inSegment(mk({ joined_at: d(60), total_sessions: 2, last_booking_at: d(20) }), "one_timer"),
    ).toBe(false);
  });

  it("'lapsing' is band-bounded (between lapsingTo and lapsingFrom days)", () => {
    expect(
      inSegment(
        mk({ joined_at: d(200), total_sessions: 5, last_booking_at: d(60) }),
        "lapsing",
      ),
    ).toBe(true);
    // Past the From boundary → falls into Inactive instead.
    expect(
      inSegment(
        mk({ joined_at: d(200), total_sessions: 5, last_booking_at: d(120) }),
        "lapsing",
      ),
    ).toBe(false);
    // Below lapsingMinSessions threshold.
    expect(
      inSegment(
        mk({ joined_at: d(200), total_sessions: 2, last_booking_at: d(60) }),
        "lapsing",
      ),
    ).toBe(false);
  });

  it("'inactive' requires last booking older than inactiveDays AND >= inactiveMinSessions", () => {
    expect(
      inSegment(
        mk({ joined_at: d(400), total_sessions: 3, last_booking_at: d(120) }),
        "inactive",
      ),
    ).toBe(true);
    expect(
      inSegment(
        mk({ joined_at: d(400), total_sessions: 1, last_booking_at: d(120) }),
        "inactive",
      ),
    ).toBe(false);
  });

  it("'no_plan' is true iff membership_id is null", () => {
    expect(inSegment(mk({ joined_at: d(10), membership_id: null }), "no_plan")).toBe(true);
    expect(inSegment(mk({ joined_at: d(10), membership_id: "m1" }), "no_plan")).toBe(false);
  });
});

describe("inTag", () => {
  it("'plan' branch matches plan_type", () => {
    expect(inTag(mk({ plan_type: "subscription" }), { key: "plan", value: "subscription" })).toBe(true);
    expect(inTag(mk({ plan_type: "drop_in" }), { key: "plan", value: "subscription" })).toBe(false);
  });

  it("'source', 'time', 'class' branches match the raw evidence column", () => {
    expect(inTag(mk({ source: "instagram" }), { key: "source", value: "instagram" })).toBe(true);
    expect(inTag(mk({ top_time_bucket: "morning" }), { key: "time", value: "morning" })).toBe(true);
    expect(inTag(mk({ top_template_id: "tpl_1" }), { key: "class", value: "tpl_1" })).toBe(true);
  });

  it("'frequency' branch derives via frequencyTier and respects studio config", () => {
    const m = mk({ bookings_last_30d: 4 });
    expect(inTag(m, { key: "frequency", value: "regular" }, DEFAULT_SEGMENT_CONFIG)).toBe(true);

    const strict = {
      ...DEFAULT_SEGMENT_CONFIG,
      frequency: { casualMin: 1, regularMin: 5, devoteeMin: 10 },
    };
    expect(inTag(m, { key: "frequency", value: "regular" }, strict)).toBe(false);
    expect(inTag(m, { key: "frequency", value: "casual" }, strict)).toBe(true);
  });
});
