# Which onboarding someone gets at /start. Each variant is a different first few minutes, and they're tried against
# each other: a dev-only switcher for now, a PostHog flag once real people come through.
#
# A first visit gets one at random, kept in a cookie so a refresh or a later visit gets the same one. In development
# ?variant= picks one (the switcher's links).
module Onboarding
  VARIANTS = {
    "pledge" => "Pledge first: pick an idea and a pace, sign a pledge, then open the editor",
    "remix" => "Remix first: a scene already playing in the editor, and π asks for three small changes",
    "none" => "No onboarding: straight into the editor"
  }.freeze
  # The ones that coach you in the editor (app/javascript/coach) rather than having a page of their own.
  COACHED = %w[remix].freeze
  COOKIE = :onboarding

  def self.pick(cookie: nil, requested: nil)
    [ requested, cookie ].find { |variant| VARIANTS.key?(variant) } || VARIANTS.keys.sample
  end
end
