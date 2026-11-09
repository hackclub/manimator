# Animation ideas from lessons in Euclid's Elements and on Purplemath (db/seeds/ideas.json, built by script/ideas),
# each linking back to its lesson so whoever takes it can read up and point people there. Handed out so no two people
# ever get the same one. Asking for ideas holds a few for HOLD; asking again lets them go back in the pool;
# signing the pledge claims the one you picked for good, and lets the others go.
#
# Draws take a transaction-level advisory lock, so one draw's read and write can't interleave with another's and two
# people never hold the same idea. Claims are a single conditional UPDATE, which Postgres already runs one at a time.
class Idea < ApplicationRecord
  HOLD = 30.minutes
  DRAW_LOCK = 0x1dea # any constant; only draws take it

  # The math class someone's in, and the bands of ideas it draws from, best fit first.
  CLASSES = {
    "middle" => { label: "Middle school math", bands: %w[middle algebra1] },
    "algebra1" => { label: "Algebra 1", bands: %w[algebra1 middle] },
    "geometry" => { label: "Geometry", bands: %w[geometry middle] },
    "algebra2" => { label: "Algebra 2", bands: %w[algebra2 algebra1] },
    "precalc" => { label: "Precalculus", bands: %w[precalc algebra2] },
    "calculus" => { label: "Calculus or past it", bands: %w[precalc algebra2 geometry algebra1] }
  }.freeze

  scope :free, -> { where(claimed_at: nil).where("held_until IS NULL OR held_until < ?", Time.current) }

  # A few ideas for this holder to choose from, from their class's bands, each from a different lesson where it can.
  # Not ones they've just seen (once they've seen them all, round again, but not the last few twice running). Lets go
  # of what they were holding. Lessons with the fewest claimed ideas come first, so ideas spread across topics.
  # Empty once everything for the class is taken.
  def self.draw(holder:, klass:, except: [], count: 3)
    bands = CLASSES.fetch(klass, CLASSES["calculus"])[:bands]
    transaction do
      connection.execute("SELECT pg_advisory_xact_lock(#{DRAW_LOCK})")
      release(holder)
      ideas = []
      count.times do
        taken = ideas.map(&:id)
        idea = pick(bands, except + taken, ideas.map(&:source)) || pick(bands, except + taken) ||
          pick(bands, except.last(count) + taken) || pick(bands, taken)
        break unless idea

        ideas << idea
      end
      where(id: ideas.map(&:id)).update_all(holder:, held_until: HOLD.from_now)
      ideas
    end
  end

  def self.pick(bands, except, sources = [])
    bands.lazy.filter_map do |band|
      free.where(band:, drawable: true).where.not(id: except).where.not(source: sources)
        .order(Arel.sql("(SELECT COUNT(*) FROM ideas c WHERE c.source = ideas.source AND c.claimed_at IS NOT NULL), RANDOM()"))
        .first
    end.first
  end
  private_class_method :pick

  def self.release(holder)
    where(holder:, claimed_at: nil).update_all(holder: nil, held_until: nil)
  end

  # Theirs for good, unless someone else claimed it, or holds it now that their own hold ran out.
  def self.claim(id, holder:)
    transaction do
      claimed = where(id:, claimed_at: nil)
        .where("holder = ? OR holder IS NULL OR held_until IS NULL OR held_until < ?", holder, Time.current)
        .update_all(holder:, held_until: nil, claimed_at: Time.current, updated_at: Time.current) == 1
      release(holder) if claimed
      claimed
    end
  end

  # Loads db/seeds/ideas.json. Adds new ideas and updates the wording of existing ones; never touches who has what.
  # Ideas no longer in the file stop being handed out, but stay, so whoever claimed one keeps it.
  def self.import!(path = Rails.root.join("db/seeds/ideas.json"))
    now = Time.current
    rows = JSON.parse(File.read(path)).map do |idea|
      idea.slice("key", "source", "source_title", "source_url", "topic", "band", "title", "line", "needs")
        .merge("drawable" => !idea["needs"].include?("3d"), "created_at" => now, "updated_at" => now)
    end
    transaction do
      upsert_all(rows, unique_by: :key,
        update_only: %w[source source_title source_url topic band title line needs drawable]) if rows.any?
      where.not(key: rows.map { _1["key"] }).update_all(drawable: false)
    end
    rows.size
  end

  def as_json(*)
    { id:, title:, line:, topic:, source_title:, source_url: }
  end
end
