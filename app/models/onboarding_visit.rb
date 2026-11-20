# Someone going through onboarding (/start), kept as they go, whether or not they ever sign in: the last beat they
# saw, their answers so far, and where they came from. One per visitor (ApplicationController#visitor_id). This is
# the funnel in our own database, next to PostHog's, and what lets someone who leaves come back to where they were.
class OnboardingVisit < ApplicationRecord
  belongs_to :user, optional: true

  # Answers are the story's own (idea, when, days, minutes, prize, shipBy…); anything bigger than this isn't.
  MAX_ANSWERS_BYTES = 4.kilobytes
  UTM_KEYS = %w[utm_source utm_medium utm_campaign utm_content ref].freeze
  # Where an email came from: Hack Club Auth's whoami (you're signed in at auth.hackclub.com, so we know it without
  # asking), or π asked and you told it.
  EMAIL_SOURCES = %w[whoami asked].freeze

  validate :answers_small_enough
  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }, length: { maximum: 254 }, allow_nil: true
  validates :email_source, inclusion: { in: EMAIL_SOURCES }, allow_nil: true

  scope :pledged, -> { where.not(pledged_at: nil) }
  scope :unpledged, -> { where(pledged_at: nil) }

  def self.for(visitor_id)
    find_or_create_by!(visitor_id:) { |visit| visit.last_seen_at = Time.current }
  rescue ActiveRecord::RecordNotUnique
    retry
  end

  # Where the story is now, and where they came from.
  def record!(step: nil, question_index: nil, answers: nil, k: nil, referrer: nil, utm: nil)
    # The first place we hear you came from sticks; each page load says once.
    if self.referrer.nil? && self.utm.blank?
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

  # An email to reach you at if you wander off. Hack Club Auth's is the one you actually use, so it wins over one
  # typed in; a typed one doesn't replace it.
  def remember_email!(email, source:, first_name: nil)
    email = email.to_s.strip.downcase.presence or return
    return if self.email.present? && email_source == "whoami" && source != "whoami"
    update!(email:, email_source: source, first_name: first_name.to_s.strip.first(40).presence || self.first_name)
  end

  def email_skipped!
    update!(email_skipped_at: Time.current) unless email_skipped_at
  end

  def email_known? = email.present?

  # Where to set you back down if you come back without having signed: the question you were on, your answers so
  # far and your k. Nil before the questions start (the opening is short enough to play again) and once you've signed.
  def progress
    return if pledged_at || question_index.nil?
    { at: question_index, answers:, k: }
  end

  # "Start over": forget where you were, but not who you are or where you came from.
  def restart!
    update!(question_index: nil, answers: {}, k: nil)
  end

  def pledged!
    update!(pledged_at: Time.current) unless pledged_at
  end

  private
    def answers_small_enough
      errors.add(:answers, "are too big") if answers.to_json.bytesize > MAX_ANSWERS_BYTES
    end
end
