module OnboardingHelper
  # The postcard: a print of a frame of your video. It's made at one hour of work and mailed free with whatever prize
  # you earn, so an hour in you already own something. On its own, it's your prize for one video. That rule is said
  # before anyone starts (POSTCARD_RULE), never revealed afterwards.
  POSTCARD = { id: "postcard", name: "Postcard of your frame", kind: "postcard", price: nil, made_at_hours: 1,
    hours: Pledge::HOURS_PER_VIDEO, with_every_prize: true, featured: true, image: "prizes/postcard.svg" }.freeze
  POSTCARD_RULE = "A postcard of your frame is made at one hour. It’s mailed free with whatever prize you earn. " \
    "On its own, it’s your prize for one video.".freeze

  # What you can earn: the postcard, and everything in the 3Blue1Brown store at DFTBA
  # (store.dftba.com/collections/3blue1brown), cheapest first. You pick one, and it's yours once that many hours of
  # your work have shipped; the postcard comes with it. A prize costs about $3 an hour of work when it's cheap, $3.50
  # in the middle and $4 when it's big, plus shipping. Onboarding shows the featured ones first, one per number of
  # videos, and the rest behind "more".
  PRIZES = [
    POSTCARD,
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

  # Through the portal to Hack Club at the end of the story (story_controller#throughPortal), laid out the way
  # hackclub.com's hero is: real photos as tilted prints round the portal, Hack Club's own stickers, then prizes people
  # posted in #treasure-cove (Nov 2026) as polaroids, then what signing in takes on sticky notes. Places are in the
  # stage's units (x right, y up, from its middle; the stage is 14.2 wide), with a width and a tilt.
  HACK_CLUB_PRINTS = [
    [ -5.4, 2.5, 3.0, -8, "Everyone at Haven NYC" ], [ 5.4, 2.5, 3.0, 8, "Hacking at a hackathon" ],
    [ -5.7, -0.1, 2.6, 6, "Friends in propeller hats" ], [ 5.7, -0.1, 2.6, -6, "On the beach after a hackathon" ],
    [ -3.3, 1.2, 2.2, -13, "A whole hackathon" ], [ 3.3, 1.2, 2.2, 12, "A film photo from Haven" ],
    [ -4.6, 3.6, 1.9, 10, "A hackathon selfie" ], [ 4.6, 3.6, 1.9, -10, "Demos at Haven NYC" ],
    [ -7.0, 1.3, 2.3, -4, "A team photo" ], [ 7.0, 1.1, 2.3, 5, "A bonfire" ]
  ].each_with_index.map { |(x, y, w, r, alt), i| { x:, y:, w:, r:, alt:, image: format("hack_club/%02d.jpg", i + 1) } }.freeze
  HACK_CLUB_STICKERS = [
    [ 1, -6.2, 3.6, 1.6, -10 ], [ 3, 6.3, 3.5, 1.5, 12 ], [ 2, -4.3, -0.4, 0.9, -12 ], [ 7, 4.4, -0.3, 1.2, 10 ], [ 9, 2.0, -0.7, 0.8, 14 ]
  ].map { |(n, x, y, w, r)| { x:, y:, w:, r:, image: "hack_club/stickers/#{n}.webp" } }.freeze
  # Prizes from #treasure-cove as polaroids, some with a Hack Club sticker slapped on, and a note in pen.
  TREASURE_COVE = [
    [ "macbook", "MacBook!!", "stardance", 3 ], [ "console", "handheld console", "wrong", nil ], [ "hackpad", "hackpad kit", "stardance", 9 ],
    [ "goggles", "FPV goggles", "forge", nil ], [ "tamagotchi", "tamagotchi :)", "milkyway", 2 ], [ "controller", "first controller", "embassy", nil ]
  ].each_with_index.map { |(file, what, from, sticker), i|
    x = -4.6 + i * 1.84
    { image: format("treasure_cove/%02d-%s.jpg", i + 1, file), what:, from:, x: x.round(2), y: (1.0 - (x / 4.6)**2 * 0.5).round(2), w: 1.9,
      r: (i - 2.5) * 3.5 + (i.even? ? -2 : 2), sticker: sticker && "hack_club/stickers/#{sticker}.webp" }
  }.freeze

  def onboarding_world = { prints: HACK_CLUB_PRINTS, stickers: HACK_CLUB_STICKERS, prizes: TREASURE_COVE }

  def onboarding_classes = Idea::CLASSES
  def onboarding_prizes = PRIZES
  def onboarding_days = Pledge::DAYS
  def onboarding_sessions = Pledge::SESSIONS
end
