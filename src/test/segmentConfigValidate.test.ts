import { describe, it, expect } from "vitest";
import { validate } from "@/manage-v2/drawers/SegmentConfigDrawer";
import { DEFAULT_SEGMENT_CONFIG } from "@/manage/hooks/useClientsView";

describe("SegmentConfigDrawer.validate", () => {
  it("accepts the seeded default config", () => {
    expect(validate(DEFAULT_SEGMENT_CONFIG)).toEqual({});
  });

  it("rejects lapsingTo === lapsingFrom (must be a proper interval)", () => {
    const bad = {
      ...DEFAULT_SEGMENT_CONFIG,
      lifecycle: {
        ...DEFAULT_SEGMENT_CONFIG.lifecycle,
        lapsingFromDays: 60,
        lapsingToDays: 60,
      },
    };
    expect(validate(bad).lapsingToDays).toBeDefined();
  });

  it("rejects non-monotonic frequency: regularMin <= casualMin", () => {
    const bad = {
      ...DEFAULT_SEGMENT_CONFIG,
      frequency: { casualMin: 4, regularMin: 4, devoteeMin: 8 },
    };
    expect(validate(bad).regularMin).toBeDefined();
  });

  it("rejects non-monotonic frequency: devoteeMin <= regularMin", () => {
    const bad = {
      ...DEFAULT_SEGMENT_CONFIG,
      frequency: { casualMin: 1, regularMin: 4, devoteeMin: 4 },
    };
    expect(validate(bad).devoteeMin).toBeDefined();
  });

  it("rejects zero or negative day fields", () => {
    const bad = {
      ...DEFAULT_SEGMENT_CONFIG,
      lifecycle: { ...DEFAULT_SEGMENT_CONFIG.lifecycle, newDays: 0 },
    };
    expect(validate(bad).newDays).toBeDefined();
  });

  it("rejects zero or negative session fields", () => {
    const bad = {
      ...DEFAULT_SEGMENT_CONFIG,
      lifecycle: { ...DEFAULT_SEGMENT_CONFIG.lifecycle, lapsingMinSessions: 0 },
    };
    expect(validate(bad).lapsingMinSessions).toBeDefined();
  });
});
