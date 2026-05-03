import posthog from "posthog-js";

const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const slug = import.meta.env.VITE_STUDIO_SLUG as string | undefined;

if (key) {
  posthog.init(key, {
    api_host: "https://us.i.posthog.com",
    capture_pageview: false,
    capture_pageleave: true,
    persistence: "localStorage",
  });
  // Register studio_id synchronously so the initial $pageview includes it
  if (slug) posthog.register({ studio_id: slug });
  posthog.capture("$pageview");
}

export function setStudioSlug(slug: string) {
  if (key) posthog.register({ studio_id: slug });
}

export function identifyUser(userId: string, props?: Record<string, unknown>) {
  if (key) posthog.identify(userId, props);
}

export { posthog };
