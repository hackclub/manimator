module OnboardingHelper
  # What you can earn: the postcard, and everything in the 3Blue1Brown store at DFTBA
  # (store.dftba.com/collections/3blue1brown), cheapest first. You pick one, and it's yours once that many hours of
  # your work have shipped. A prize costs about $3 an hour of work when it's cheap, $3.50 in the middle and $4 when
  # it's big, plus shipping; the postcard (the last frame of your video, printed) is an hour. Onboarding shows the
  # featured ones first, one per number of videos, and the rest behind "more".
  PRIZES = [
    { id: "postcard", name: "Postcard of your last frame", kind: "postcard", price: nil, hours: 1, featured: true, image: "prizes/postcard.svg" },
    { id: "fourier-socks", name: "Fourier Series Socks", kind: "socks", price: 15, hours: 5, featured: true },
    { id: "vector-socks", name: "Vector Field Socks", kind: "socks", price: 15, hours: 5 },
    { id: "torus-mug", name: "Torus Mug", kind: "mug", price: 19, hours: 6 },
    { id: "notebook", name: "Mathematical Quotebook", kind: "notebook", price: 20, hours: 7 },
    { id: "mystery-shirt", name: "Mystery Shirt", kind: "shirt", price: 23.2, hours: 7 },
    { id: "pi-plushie", name: "Chunky Pi Plushie", kind: "plushie", price: 25, hours: 7, featured: true },
    { id: "pi-pins", name: "Pi Pin Pack", kind: "pins", price: 25, hours: 7 },
    { id: "knot-tie", name: "Knot Theory Tie", kind: "tie", price: 31.41, hours: 9 },
    { id: "pause-shirt", name: "Pause and Ponder Shirt", kind: "shirt", price: 32, hours: 9 },
    { id: "pi-friends-shirt", name: "Pi Friends Shirt", kind: "shirt", price: 32, hours: 9 },
    { id: "zeta-shirt", name: "Zeta Spiral Shirt", kind: "shirt", price: 32, hours: 9 },
    { id: "vertical-shirt", name: "Vertical Alignment Shirt", kind: "shirt", price: 32, hours: 9 },
    { id: "neck-pillow", name: "Pi Neck Pillow", kind: "pillow", price: 36.5, hours: 9 },
    { id: "hoodie", name: "3Blue1Brown Hoodie", kind: "hoodie", price: 40, hours: 10, featured: true },
    { id: "crewneck", name: "Logo Crewneck", kind: "sweatshirt", price: 49.9, hours: 12 },
    { id: "pi-bundle", name: "The Full Pi Bundle", kind: "bundle", price: 52.62, hours: 13 },
    { id: "logo-hoodie", name: "Logo Hoodie", kind: "hoodie", price: 55, hours: 14 }
  ].map { |prize| { image: "prizes/#{prize[:id]}.jpg", featured: false }.merge(prize) }
   .map { |prize| prize.merge(videos: [ (prize[:hours].to_f / Pledge::HOURS_PER_VIDEO).ceil, 1 ].max) }.freeze

  def onboarding_classes = Idea::CLASSES
  def onboarding_prizes = PRIZES
  def onboarding_when = Pledge::SLOTS.keys
  def onboarding_days = Pledge::DAYS
  def onboarding_sessions = Pledge::SESSIONS
  def onboarding_for = Pledge::FOR
end
