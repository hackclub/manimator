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

  def onboarding_classes = Idea::CLASSES
  def onboarding_prizes = PRIZES
  def onboarding_when = Pledge::SLOTS.keys
  def onboarding_days = Pledge::DAYS
  def onboarding_sessions = Pledge::SESSIONS
  def onboarding_for = Pledge::FOR
end
