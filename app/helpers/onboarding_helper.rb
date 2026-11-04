module OnboardingHelper
  # What you can earn, from the 3Blue1Brown store at DFTBA (store.dftba.com/collections/3blue1brown), cheapest first.
  # Price is the store's, in dollars. What it takes is in good videos (3+ hours each), roughly by price.
  PRIZES = [
    { id: "fourier-socks", name: "Fourier Series Socks", kind: "socks", price: 15, videos: "1 good video" },
    { id: "torus-mug", name: "Torus Mug", kind: "mug", price: 19, videos: "1 good video" },
    { id: "pi-pins", name: "Pi Pin Pack", kind: "pins", price: 25, videos: "1–2 good videos" },
    { id: "pi-plushie", name: "Chunky Pi Plushie", kind: "plushie", price: 25, videos: "1–2 good videos" },
    { id: "pi-friends-shirt", name: "Pi Friends Shirt", kind: "shirt", price: 32, videos: "2 good videos" },
    { id: "hoodie", name: "3Blue1Brown Hoodie", kind: "hoodie", price: 40, videos: "2–3 good videos" }
  ].map { |prize| prize.merge(image: "prizes/#{prize[:id]}.jpg") }.freeze

  # When people say they'll animate, as wrong-tool asks it (its nudges send at these times).
  WHEN = [ "after school", "evening", "late night", "weekends" ].freeze
  DAYS = [ 2, 3, 5, 7 ].freeze

  def onboarding_classes = Idea::CLASSES
  def onboarding_prizes = PRIZES
  def onboarding_when = WHEN
  def onboarding_days = DAYS
end
