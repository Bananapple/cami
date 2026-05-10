import { describe, expect, it } from "vitest";
import { isMarketingHost } from "../marketing/isMarketingHost";

describe("isMarketingHost", () => {
  it("matches the marketing apex and www subdomain", () => {
    expect(isMarketingHost("heycami.studio")).toBe(true);
    expect(isMarketingHost("www.heycami.studio")).toBe(true);
  });

  it("does not match studio deployments", () => {
    expect(isMarketingHost("brie-hd7s.vercel.app")).toBe(false);
    expect(isMarketingHost("yogabrie.no")).toBe(false);
  });

  it("does not match Vercel preview URLs of either deployment", () => {
    // Preview URLs of the cami project still carry the studio surface
    // unless the user is browsing under heycami.studio itself.
    expect(isMarketingHost("cami-git-fix-post-audit-cleanup-…vercel.app")).toBe(false);
    expect(isMarketingHost("cami.vercel.app")).toBe(false);
  });

  it("does not match localhost / 127.0.0.1 in development", () => {
    expect(isMarketingHost("localhost")).toBe(false);
    expect(isMarketingHost("127.0.0.1")).toBe(false);
  });

  it("treats other heycami subdomains as non-marketing (not currently in scope)", () => {
    expect(isMarketingHost("app.heycami.studio")).toBe(false);
    expect(isMarketingHost("staging.heycami.studio")).toBe(false);
  });
});
