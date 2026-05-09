import posthog from "posthog-js";

const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;

if (key) {
  posthog.init(key, {
    api_host: "https://us.i.posthog.com",
    capture_pageview: false,
    capture_pageleave: true,
    persistence: "localStorage",
  });
}

export function initStudio(studioId: string) {
  if (!key) return;
  posthog.register({ studio_id: studioId });
  posthog.capture("$pageview");
}

// Allowlisted properties — keep this narrow so PII (email, name, phone, address)
// can never accidentally land in PostHog. If a new field is needed for analytics
// segmentation, add it here only if it is NOT personally identifying.
type SafeIdentifyProps = {
  studio_role?: "owner" | "manager" | "instructor" | "member";
  has_active_membership?: boolean;
  account_age_days?: number;
};

export function identifyUser(userId: string, props?: SafeIdentifyProps) {
  if (key) posthog.identify(userId, props);
}

export { posthog };
