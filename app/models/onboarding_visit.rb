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
  # Where π asks for it: right after you say hi ("hello"), or once you've picked your idea ("idea", where π offers to
  # keep it for you). Half and half, by visitor, so each person always gets the same one. The question is which ends
  # with more emails per visitor without losing more people before the editor (`bin/rails onboarding:email_ab`).
  EMAIL_ARMS = %w[hello idea].freeze

  # π's one follow-up email (sent by Loops, via OnboardingVisit::LoopsSync): a day after someone with an email we know stops without signing,
  # and only within a week of that. A tenth are held out, never emailed, so we can tell whether it brings anyone
  # back (compare followup_arm "sent" with "holdout": followup_clicked_at, coming back at all, pledged_at). Someone
  # whose email already pledged or was already followed up on another visit is "duplicate" and gets nothing.
  FOLLOWUP_AFTER = 1.day
  FOLLOWUP_WINDOW = 7.days
  FOLLOWUP_HOLDOUT = 0.1
  FOLLOWUP_ARMS = %w[sent holdout duplicate].freeze

  has_secure_token :followup_token

  validate :answers_small_enough
  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }, length: { maximum: 254 }, allow_nil: true
  validates :email_source, inclusion: { in: EMAIL_SOURCES }, allow_nil: true

  scope :pledged, -> { where.not(pledged_at: nil) }
  scope :unpledged, -> { where(pledged_at: nil) }
  scope :followup_due, -> {
    unpledged.where(followup_at: nil).where.not(email: nil)
      .where(last_seen_at: FOLLOWUP_WINDOW.ago..FOLLOWUP_AFTER.ago)
  }

  # Changed since it last went to Airtable (OnboardingVisit::LoopsSync), with an email to key it by.
  scope :loops_unsynced, -> {
    where.not(email: nil).where("loops_synced_at IS NULL OR onboarding_visits.updated_at > loops_synced_at")
  }

  # Every 5 minutes (OnboardingFollowupJob). Without the Loops sync set up, nobody is put in an arm.
  def self.follow_up_due
    return unless Rails.configuration.x.loops_sync_configured
    followup_due.find_each(&:follow_up!)
  end

  def self.for(visitor_id)
    visit = find_or_create_by!(visitor_id:) { |v| v.last_seen_at = Time.current }
    visit.update_column(:email_arm, email_arm_for(visitor_id)) unless visit.email_arm
    visit
  rescue ActiveRecord::RecordNotUnique
    retry
  end

  def self.email_arm_for(visitor_id)
    EMAIL_ARMS[Digest::SHA256.hexdigest(visitor_id.to_s).first(8).to_i(16) % EMAIL_ARMS.size]
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
    { at: question_index, answers:, k:, email: email_known? }
  end

  # "Start over": forget where you were, but not who you are or where you came from.
  def restart!
    update!(question_index: nil, answers: {}, k: nil)
  end

  # Decide this visit's arm, once. "sent" is emailed by Loops once the sync carries it over.
  def follow_up!(holdout: rand < FOLLOWUP_HOLDOUT)
    with_lock do
      next if followup_at || pledged_at
      arm = already_reached? ? "duplicate" : holdout ? "holdout" : "sent"
      self.followup_token ||= self.class.generate_unique_secure_token
      update!(followup_at: Time.current, followup_arm: arm)
      arm
    end
  end

  # Their link back: it opens /start as this visit (OnboardingController#show), wherever they open it.
  def back_url = "#{Rails.configuration.x.app_url}/start?v=#{followup_token}"

  def followup_clicked!
    update!(followup_clicked_at: Time.current) unless followup_clicked_at
  end

  def pledged!
    update!(pledged_at: Time.current) unless pledged_at
  end

  private
    # The same email already pledged (on another visit or as a signed-in user), or was already followed up.
    def already_reached?
      others = OnboardingVisit.where(email:).where.not(id:)
      others.where.not(followup_at: nil).or(others.pledged).exists? ||
        User.joins(:pledges).where("LOWER(users.email) = ?", email).exists?
    end

    def answers_small_enough
      errors.add(:answers, "are too big") if answers.to_json.bytesize > MAX_ANSWERS_BYTES
    end
end
