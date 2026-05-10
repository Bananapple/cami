// The marketing site (heycami.studio) is served from the same React app as the
// studio app, but they are architecturally distinct surfaces. This is the
// authoritative check for "is the user on the marketing domain?" — gate
// routing and any deploy-specific styling on this, NOT on
// import.meta.env.VITE_DEPLOY_TARGET (env can drift; hostname is the actual
// runtime semantic).
//
// See docs/ARCHITECTURE.md for the boundary rules and the conditions under
// which this single-repo arrangement should be split into two repos.

const MARKETING_HOSTS: ReadonlySet<string> = new Set([
  "heycami.studio",
  "www.heycami.studio",
]);

export function isMarketingHost(hostname?: string): boolean {
  const host = hostname ?? (typeof window !== "undefined" ? window.location.hostname : "");
  return MARKETING_HOSTS.has(host);
}
