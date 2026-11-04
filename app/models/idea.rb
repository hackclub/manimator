# Animation ideas from the Common Core math standards (db/seeds/ideas.json, built by script/ideas), handed out so no
# two people ever get the same one. Asking for an idea holds one for HOLD; asking again lets it go back in the pool;
# signing the pledge claims it for good.
#
# Rails runs SQLite transactions as BEGIN IMMEDIATE, so a draw's read and write can't interleave with another one's.
class Idea < ApplicationRecord
  HOLD = 30.minutes

  # The math class someone's in, and the bands of ideas it draws from, best fit first.
  CLASSES = {
    "middle" => { label: "Middle school math", bands: %w[middle elementary] },
    "algebra1" => { label: "Algebra 1", bands: %w[algebra1 middle] },
    "geometry" => { label: "Geometry", bands: %w[geometry middle] },
    "algebra2" => { label: "Algebra 2", bands: %w[algebra2 algebra1] },
    "precalc" => { label: "Precalculus", bands: %w[precalc algebra2] },
    "calculus" => { label: "Calculus or past it", bands: %w[precalc algebra2 geometry algebra1] }
  }.freeze

  scope :free, -> { where(claimed_at: nil).where("held_until IS NULL OR held_until < ?", Time.current) }

  # One idea for this holder from their class's bands, not one they've just seen (once they've seen them all, round
  # again, but never the same one twice running). Lets go of what they were holding. Standards with the fewest claimed ideas come first, so ideas
  # spread across topics. nil once everything for the class is taken.
  def self.draw(holder:, klass:, except: [])
    bands = CLASSES.fetch(klass, CLASSES["calculus"])[:bands]
    transaction do
      release(holder)
      idea = pick(bands, except) || pick(bands, except.last(1)) || pick(bands, [])
      idea&.update!(holder:, held_until: HOLD.from_now)
      idea
    end
  end

  def self.pick(bands, except)
    bands.lazy.filter_map do |band|
      free.where(band:, drawable: true).where.not(id: except)
        .order(Arel.sql("(SELECT COUNT(*) FROM ideas c WHERE c.standard = ideas.standard AND c.claimed_at IS NOT NULL), RANDOM()"))
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
  def self.import!(path = Rails.root.join("db/seeds/ideas.json"))
    now = Time.current
    rows = JSON.parse(File.read(path)).map do |idea|
      idea.slice("key", "standard", "topic", "band", "title", "line", "needs")
        .merge("drawable" => !idea["needs"].include?("3d"), "created_at" => now, "updated_at" => now)
    end
    upsert_all(rows, unique_by: :key, update_only: %w[standard topic band title line needs drawable]) if rows.any?
    rows.size
  end

  def as_json(*)
    { id:, title:, line:, standard:, topic: }
  end
end
