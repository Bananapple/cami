import posthog from "posthog-js";

const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;

if (key) {
  posthog.init(key, {
    api_host: "https://us.i.posthog.com",
    capture_pageview: true,
    capture_pageleave: true,
    persistence: "localStorage",
  });
}

export function setStudioId(studioId: string) {
  if (key) posthog.register({ studio_id: studioId });
}

export function identifyUser(userId: string, props?: Record<string, unknown>) {
  if (key) posthog.identify(userId, props);
}

export { posthog };
