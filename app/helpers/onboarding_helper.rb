module OnboardingHelper
  # What you can earn, from the 3Blue1Brown store at DFTBA (store.dftba.com/collections/3blue1brown), cheapest first.
  # Price is the store's, in dollars; Shop turns it into hours.
  PRIZES = [
    { id: "fourier-socks", name: "Fourier Series Socks", kind: "socks", price: 15 },
    { id: "torus-mug", name: "Torus Mug", kind: "mug", price: 19 },
    { id: "pi-pins", name: "Pi Pin Pack", kind: "pins", price: 25 },
    { id: "pi-plushie", name: "Chunky Pi Plushie", kind: "plushie", price: 25 },
    { id: "pi-friends-shirt", name: "Pi Friends Shirt", kind: "shirt", price: 32 },
    { id: "hoodie", name: "3Blue1Brown Hoodie", kind: "hoodie", price: 40 }
  ].map { |prize| prize.merge(image: "prizes/#{prize[:id]}.jpg", hours: Shop.hours_for(prize[:price])) }.freeze

  # When people say they'll animate, as wrong-tool asks it (its nudges send at these times).
  WHEN = [ "after school", "evening", "late night", "weekends" ].freeze
  DAYS = [ 2, 3, 5, 7 ].freeze

  def onboarding_classes = Idea::CLASSES
  def onboarding_prizes = PRIZES
  def onboarding_when = WHEN
  def onboarding_days = DAYS
end
