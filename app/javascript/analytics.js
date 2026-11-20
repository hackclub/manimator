// Every onboarding and editor event goes out through here, to PostHog in the browser (loaded by
// app/views/layouts/_posthog.html.erb). Without it configured, events are only logged.
//
// Signed in, you're identified by the body's data-posthog-user-id, so what you did before signing in (the whole of
// onboarding) joins up with what you do after. Signing out forgets you.

// `options` go to posthog.capture: { transport: "sendBeacon" } gets an event out before the page goes.
export function capture(event, properties = {}, options) {
  if (window.posthog?.capture) window.posthog.capture(event, properties, options)
  else console.debug("[capture]", event, properties)
}

// Things about the person rather than one event (their email once we know it), on their PostHog person.
export function setPerson(properties) {
  window.posthog?.setPersonProperties?.(properties)
}

function identify() {
  const userId = document.body?.dataset.posthogUserId
  if (userId && window.posthog?.get_distinct_id?.() !== userId) window.posthog.identify(userId)
}
identify()
addEventListener("turbo:load", identify)

addEventListener("submit", ({ target }) => {
  if (target.matches("[data-posthog-reset]")) window.posthog?.reset()
}, true)
