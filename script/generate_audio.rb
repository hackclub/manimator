# Generates the landing page's music bed and sound effects with ElevenLabs.
# Cached: a file that already exists is never regenerated (each call costs credits).
#
#   ELEVENLABS_API_KEY=... bin/rails runner script/generate_audio.rb [name ...]
#
# Output goes to app/assets/audio/<name>.mp3.
require "net/http"
require "json"
require "fileutils"

MUSIC = {
  "bed" => "Calm, curious solo felt piano for a math explainer video: a soft, sparse melody that wanders " \
           "gently over warm sustained chords, a hint of celesta, and a very quiet string pad far underneath, " \
           "in a soft, roomy reverb. Wondering and thoughtful, a little playful, like noticing something " \
           "beautiful in a proof late at night. Slow, about 70 BPM. No drums, no percussion, no bass drops. " \
           "Steady from the first second to the last, no intro, no build-ups, no big ending, so it can loop. " \
           "Instrumental, no vocals."
}.freeze

SFX = {
  "scatter" => [ "A soft, quick upward glissando on harp and celesta with a light airy shimmer, magical and gentle, " \
                 "no whoosh, no impact.", 1.2 ],
  "poke"    => [ "A single soft wooden marimba note with a tiny upward pitch bend, cute and gentle, short and dry.", 0.5 ]
}.freeze

KEY = ENV.fetch("ELEVENLABS_API_KEY") { abort "Set ELEVENLABS_API_KEY" }
DIR = Rails.root.join("app/assets/audio")
FileUtils.mkdir_p(DIR)

def post(path, body)
  uri = URI("https://api.elevenlabs.io#{path}")
  req = Net::HTTP::Post.new(uri, "xi-api-key" => KEY, "content-type" => "application/json")
  req.body = body.to_json
  res = Net::HTTP.start(uri.host, uri.port, use_ssl: true, read_timeout: 300) { |http| http.request(req) }
  abort "#{res.code} #{res.body[0, 300]}" unless res.is_a?(Net::HTTPSuccess)
  res.body
end

names = ARGV.any? ? ARGV : MUSIC.keys + SFX.keys
names.each do |name|
  file = DIR.join("#{name}.mp3")
  next puts("cached #{file}") if file.exist?

  audio =
    if (prompt = MUSIC[name])
      post("/v1/music?output_format=mp3_44100_128", prompt:, music_length_ms: 90_000, model_id: "music_v1")
    elsif (text, secs = SFX[name])
      post("/v1/sound-generation?output_format=mp3_44100_128", text:, duration_seconds: secs, prompt_influence: 0.6)
    else
      abort "unknown sound #{name} (#{(MUSIC.keys + SFX.keys).join(', ')})"
    end
  File.binwrite(file, audio)
  puts "made #{file}"
end
