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

export function identifyUser(userId: string, props?: Record<string, unknown>) {
  if (key) posthog.identify(userId, props);
}

export function identifyUser(userId: string, props?: Record<string, unknown>) {
  if (key) posthog.identify(userId, props);
}

export { posthog };
