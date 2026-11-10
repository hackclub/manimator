module OnboardingHelper
  # What you can earn, cheapest first. You pick one, and it's yours once that many hours of your work have shipped.
  # The merch is from the 3Blue1Brown store at DFTBA (store.dftba.com/collections/3blue1brown), price in dollars; the
  # postcard is the last frame of your first video, printed and mailed. Hours are placeholders until at-cost prices
  # are in: aim for $3–4 of prize per hour, plus shipping. A video is about 3 hours (Pledge::HOURS_PER_VIDEO).
  PRIZES = [
    { id: "postcard", name: "Postcard of your last frame", kind: "postcard", price: nil, hours: 3, image: "prizes/postcard.svg" },
    { id: "fourier-socks", name: "Fourier Series Socks", kind: "socks", price: 15, hours: 5 },
    { id: "pi-plushie", name: "Chunky Pi Plushie", kind: "plushie", price: 25, hours: 7 },
    { id: "hoodie", name: "3Blue1Brown Hoodie", kind: "hoodie", price: 40, hours: 10 }
  ].map { |prize| { image: "prizes/#{prize[:id]}.jpg" }.merge(prize) }.freeze

  def onboarding_classes = Idea::CLASSES
  def onboarding_prizes = PRIZES
  def onboarding_when = Pledge::SLOTS.keys
  def onboarding_days = Pledge::DAYS
  def onboarding_sessions = Pledge::SESSIONS
  def onboarding_for = Pledge::FOR
end
