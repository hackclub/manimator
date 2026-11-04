module OnboardingHelper
  # The landing page's examples, as ideas to start from.
  IDEAS = [
    { title: "Odd numbers make squares", line: "1 + 3 + 5 + 7 = 4², one L at a time.", color: "yellow" },
    { title: "Where sine comes from", line: "A point going round a circle, and its height.", color: "blue" },
    { title: "Euler’s identity", line: "Why turning by π lands you on −1.", color: "teal" },
    { title: "Pythagoras, rearranged", line: "The two small squares always fill the big one.", color: "green" },
    { title: "Area under a curve", line: "Rectangles, thinner and thinner, until they’re an integral.", color: "purple" },
    { title: "Fourier epicycles", line: "Circles on circles that can draw anything.", color: "red" }
  ].freeze

  EXPERIENCE = {
    "new" => "I’ve never written Python",
    "python" => "I know some Python, not manim",
    "manim" => "I’ve used manim before"
  }.freeze

  # When people say they'll animate, as wrong-tool asks it (its nudges send at these times).
  WHEN = [ "after school", "evening", "late night", "weekends" ].freeze
  DAYS = [ 2, 3, 5, 7 ].freeze

  def onboarding_ideas = IDEAS
  def onboarding_experience = EXPERIENCE
  def onboarding_when = WHEN
  def onboarding_days = DAYS
end
