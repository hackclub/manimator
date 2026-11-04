// Every onboarding and editor event goes out through here. PostHog isn't set up yet, so for now they're only
// logged; once it is, nothing calling this has to change.
export function capture(event, properties = {}) {
  if (window.posthog?.capture) window.posthog.capture(event, properties)
  else console.debug("[capture]", event, properties)
}
