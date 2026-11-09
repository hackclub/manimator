# One manim file someone's working on in the editor. It's theirs by user once they've signed in, and by visitor id
# (ApplicationController#visitor_id) until then; signing in takes a visitor's scenes along (User#adopt!).
class Scene < ApplicationRecord
  belongs_to :user, optional: true

  # A whole file, but not a novel: keeps a runaway paste from filling the database.
  MAX_CODE = 200.kilobytes

  validates :code, length: { maximum: MAX_CODE }
  validate :has_owner

  before_validation { self.edited_at ||= Time.current }
  before_save :name_from_code, if: :code_changed?

  scope :recent, -> { order(edited_at: :desc) }

  # What the editor needs to switch to it.
  def as_json(*)
    { id:, name:, code:, cursor_line:, edited_at: edited_at.iso8601 }
  end

  private
    # The first Scene class in the file ("class OrbitScene(Scene):" is OrbitScene), as the worker names it.
    def name_from_code
      self.name = code[/^class\s+(\w+)\s*\([^)]*Scene[^)]*\)/, 1] || "scene"
    end

    def has_owner
      errors.add(:base, "needs an owner") if user_id.blank? && visitor_id.blank?
    end
end
