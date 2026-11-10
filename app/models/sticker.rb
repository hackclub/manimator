# The π sticker we post to someone for finishing their first session in the editor: the first day they reach its goal
# (Activity). One each, for good, and only for someone signed in, since a Hack Club identity is what keeps it to one
# and is where the address comes from. Whoever posts them works from Sticker.due (bin/rails stickers:due).
class Sticker < ApplicationRecord
  belongs_to :user

  scope :unsent, -> { where(sent_at: nil) }
  scope :sent, -> { where.not(sent_at: nil) }

  # Theirs if they've finished a session and don't have one yet. Safe to call again and again, and at once.
  def self.earn(user)
    return user.sticker if user.sticker
    return unless user.activities.completed_dates.any?

    create_or_find_by!(user:) { |sticker| sticker.earned_at = Time.current }
  end

  # Earned, not posted yet, and we know where to post it. Oldest first.
  def self.due
    unsent.includes(:user).order(:earned_at).reject { |sticker| sticker.user.needs_address? }
  end

  # Earned, but they haven't shared an address.
  def self.waiting_on_address
    unsent.includes(:user).order(:earned_at).select { |sticker| sticker.user.needs_address? }
  end

  def sent? = sent_at.present?

  def sent!
    update!(sent_at: Time.current) unless sent?
  end
end
