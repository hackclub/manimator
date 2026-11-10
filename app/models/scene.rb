# One manim file someone's working on in the editor. It's theirs by user once they've signed in, and by visitor id
# (ApplicationController#visitor_id) until then; signing in takes a visitor's scenes along (User#adopt!).
class Scene < ApplicationRecord
  belongs_to :user, optional: true

  # A whole file, but not a novel: keeps a runaway paste from filling the database.
  MAX_CODE = 200.kilobytes

  # The latest frame of it, as a JPEG data URL: the picture on your postcard and in π's messages (FramesController).
  FRAME_PREFIX = "data:image/jpeg;base64,"
  MAX_FRAME = 400.kilobytes

  validates :code, length: { maximum: MAX_CODE }
  validate :has_owner
  validate :frame_is_a_small_jpeg, if: :frame_changed?

  before_validation { self.edited_at ||= Time.current }
  before_save :name_from_code, if: :code_changed?
  before_save { self.frame_at = frame.present? ? Time.current : nil if frame_changed? }

  scope :recent, -> { order(edited_at: :desc) }

  # What the editor needs to switch to it.
  def as_json(*)
    { id:, name:, code:, cursor_line:, edited_at: edited_at.iso8601 }
  end

  # The frame as the bytes of a JPEG file.
  def frame_jpeg
    Base64.decode64(frame.delete_prefix(FRAME_PREFIX)) if frame.present?
  end

  private
    # The first Scene class in the file ("class OrbitScene(Scene):" is OrbitScene), as the worker names it.
    def name_from_code
      self.name = code[/^class\s+(\w+)\s*\([^)]*Scene[^)]*\)/, 1] || "scene"
    end

    # What the editor's canvas makes (toDataURL), and nothing else: JPEG files start FF D8 FF.
    def frame_is_a_small_jpeg
      return if frame.blank?
      return errors.add(:frame, "is too big") if frame.bytesize > MAX_FRAME
      jpeg = frame.start_with?(FRAME_PREFIX) && Base64.strict_decode64(frame.delete_prefix(FRAME_PREFIX))
      errors.add(:frame, "isn't a JPEG") unless jpeg && jpeg.start_with?("\xFF\xD8\xFF".b)
    rescue ArgumentError
      errors.add(:frame, "isn't a JPEG")
    end

    def has_owner
      errors.add(:base, "needs an owner") if user_id.blank? && visitor_id.blank?
    end
end
