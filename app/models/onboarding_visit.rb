# Someone going through onboarding (/start), kept as they go, whether or not they ever sign in: the last beat they
# saw, their answers so far, and where they came from. One per visitor (ApplicationController#visitor_id). This is
# the funnel in our own database, next to PostHog's, and what lets someone who leaves come back to where they were.
class OnboardingVisit < ApplicationRecord
  belongs_to :user, optional: true

  # Answers are the story's own (idea, when, days, minutes, prize, shipBy…); anything bigger than this isn't.
  MAX_ANSWERS_BYTES = 4.kilobytes
  UTM_KEYS = %w[utm_source utm_medium utm_campaign utm_content ref].freeze

  validate :answers_small_enough

  scope :pledged, -> { where.not(pledged_at: nil) }
  scope :unpledged, -> { where(pledged_at: nil) }

  def self.for(visitor_id)
    find_or_create_by!(visitor_id:) { |visit| visit.last_seen_at = Time.current }
  rescue ActiveRecord::RecordNotUnique
    retry
  end

  # Where the story is now. Where they came from is kept from their first visit only.
  def record!(step: nil, question_index: nil, answers: nil, k: nil, referrer: nil, utm: nil)
    if last_step.nil?
      self.referrer = referrer.to_s.first(500).presence
      self.utm = utm.to_h.stringify_keys.slice(*UTM_KEYS).transform_values { |v| v.to_s.first(100) }
    end
    self.last_step = step if step.present?
    self.question_index = question_index unless question_index.nil?
    self.answers = answers if answers.present?
    self.k = k if k
    self.last_seen_at = Time.current
    save!
  end

  def pledged!
    update!(pledged_at: Time.current) unless pledged_at
  end

  private
    def answers_small_enough
      errors.add(:answers, "are too big") if answers.to_json.bytesize > MAX_ANSWERS_BYTES
    end
end
