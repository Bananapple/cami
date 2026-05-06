import { describe, it, expect } from "vitest";
import { parseTagsParam, serializeTags } from "@/manage-v2/screens/ClientsScreen";
import type { TagFilter } from "@/manage/hooks/useClientsView";

describe("parseTagsParam", () => {
  it("returns [] for null and empty string", () => {
    expect(parseTagsParam(null)).toEqual([]);
    expect(parseTagsParam("")).toEqual([]);
  });

  it("parses a single valid tag", () => {
    expect(parseTagsParam("plan:drop_in")).toEqual([{ key: "plan", value: "drop_in" }]);
  });

  it("parses multiple comma-separated tags", () => {
    expect(parseTagsParam("plan:drop_in,frequency:devotee")).toEqual([
      { key: "plan", value: "drop_in" },
      { key: "frequency", value: "devotee" },
    ]);
  });

  it("drops malformed segments (missing colon, missing value, unknown key)", () => {
    expect(parseTagsParam("plain,plan:,unknown:foo,plan:drop_in")).toEqual([
      { key: "plan", value: "drop_in" },
    ]);
  });

  it("preserves colons inside values (UUIDs occasionally have them)", () => {
    expect(parseTagsParam("class:abc:def")).toEqual([{ key: "class", value: "abc:def" }]);
  });

  it("round-trips through serializeTags", () => {
    const tags: TagFilter[] = [
      { key: "plan", value: "subscription" },
      { key: "time", value: "morning" },
    ];
    expect(parseTagsParam(serializeTags(tags))).toEqual(tags);
  });
});

describe("serializeTags", () => {
  it("returns empty string for empty array", () => {
    expect(serializeTags([])).toBe("");
  });
  it("joins key:value pairs with commas", () => {
    expect(
      serializeTags([
        { key: "plan", value: "drop_in" },
        { key: "frequency", value: "devotee" },
      ]),
    ).toBe("plan:drop_in,frequency:devotee");
  });
});
