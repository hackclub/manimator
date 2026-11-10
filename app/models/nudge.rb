# One message π sent someone on Slack, or would have sent, and whether they worked afterwards.
#
# Every 15 minutes (NudgeDeliveryJob), anyone whose booked sit-down has arrived, or whose local time just reached the
# slot they pledged to work at, gets at most one: the first of Nudge::Fixed's rules that applies. And the moment
# someone's day reaches its goal (Activity calls Nudge.day_completed), π cheers (Nudge::Cheer). Nothing goes within
# MESSAGE_GAP of anything else π sent them, so a nudge's slot passes and a cheer waits.
#
# One person in ten is held out (Nudge.holdout?): everything is decided for them the same way and saved with
# holdout set and the words they'd have got, but nothing is sent. Hourly (NudgeScoringJob), each one whose window has
# closed is scored on whether they worked, held out or not, so Nudge::Stats can say whether a message did anything
# that would not have happened anyway.
#
# There's no bandit: the rules are fixed, and each kind's wording is picked at random from a few (variant says which).
# What it says is Nudge::Copy, the Slack message is Nudge::Message, and its links are NudgeLinksController.
# (hackclub/wrong-tool's Nudge, without the bandit and the dramatic arm, with the holdout made real.)
class Nudge < ApplicationRecord
  # Test ones (bin/rails nudges:test) always send, and are never scored or counted.
  KINDS = %w[session first_frame milestone streak_saver comeback cheer test].freeze

  # Reaching a day's goal this long after a nudge counts as it working. A cheer's window is the whole of the next
  # day instead (see #window).
  REWARD_WINDOW = 6.hours
  # Stopping π's messages from a nudge counts as this many failures.
  OPT_OUT_PENALTY = -5

  # Cheers aren't counted against the weekly cap: they're earned.
  DAILY_CAP = 1
  WEEKLY_CAP = 5
  # The least time between any two of π's messages to someone.
  MESSAGE_GAP = 1.hour

  # Local time. Nothing sends at or after QUIET_FROM or before QUIET_UNTIL.
  QUIET_FROM = 22
  QUIET_UNTIL = 8

  # Same people every time, from their id.
  HOLDOUT_SHARE = 0.1

  belongs_to :user

  # The tracked links: /n/<token> opens the editor, /n/<token>/stop stops π's messages.
  has_secure_token :token

  # The picture that goes with it, if any. Only while it's being sent; not kept.
  attr_accessor :frame_url

  validates :kind, inclusion: { in: KINDS }

  scope :cheers, -> { where(kind: "cheer") }
  scope :delivered, -> { where(delivered: true) }
  scope :holdout, -> { where(holdout: true) }
  # Sent, or would have been if they weren't held out. Caps and "only once" count these, so the two groups get the
  # same schedule.
  scope :issued, -> { where(delivered: true).or(where(holdout: true)) }
  scope :real, -> { where.not(kind: "test") }
  scope :scored, -> { where.not(reward: nil) }
  # Every one we tried, a DM that failed included, so the comparison with the holdout is of everyone we meant to
  # message.
  scope :unscored, -> { real.where(reward: nil).where.not(sent_at: nil) }

  def self.configured? = Rails.configuration.x.slack_configured.present?

  # Whether this person never hears from π: a tenth of everyone, the same tenth every time.
  def self.holdout?(user)
    Digest::SHA256.hexdigest("manimator-holdout-#{user.id}").to_i(16) % 100 < HOLDOUT_SHARE * 100
  end

  # Everyone π might message now (pledged, on Slack, and not muted), one at a time so one person's trouble doesn't
  # stop the rest. Nothing without a bot token.
  def self.deliver_due(now = Time.current)
    return unless configured?

    User.where(id: Pledge.select(:user_id)).where.not(slack_id: [ nil, "" ])
        .where(slack_muted_at: nil, slack_dm_failed_at: nil).find_each do |user|
      deliver_to(user, now)
    rescue => error
      Rails.error.report(error, context: { user_id: user.id })
    end
  end

  # Their nudge, if they should get one now: for the sit-down they booked if that's arrived, otherwise the first
  # fixed one that applies if it's their slot.
  def self.deliver_to(user, now = Time.current)
    return unless configured?

    context = Nudge::Context.new(user, now)
    return unless context.pledge && context.may_nudge?

    nudge = Nudge::Fixed.session(context) || (Nudge::Fixed.for(context) if context.in_slot?)
    nudge&.deliver!(context.vars, frame_url: context.frame_url)
    nudge
  end

  # Activity calls this, inside the editor's heartbeat, the moment someone's day first reaches its goal. All it does
  # is queue NudgeCheerJob, which marks whatever π said in the last REWARD_WINDOW as having worked and sends the
  # cheer. Never raises.
  def self.day_completed(user, activity_date)
    return unless configured?

    NudgeCheerJob.perform_later(user.id, activity_date, Time.current)
  rescue => error
    Rails.error.report(error, context: { user_id: user.id })
  end

  # Their day reached its goal at this moment: every nudge from the REWARD_WINDOW before it worked. (Not cheers,
  # which are about the next day, and not one they stopped π's messages from.)
  def self.worked!(user, at)
    user.nudges.unscored.where(opted_out_at: nil, sent_at: at - REWARD_WINDOW..at).where.not(kind: "cheer")
        .update_all(reward: 1, rewarded_at: at, updated_at: Time.current)
  end

  def self.score_due(now = Time.current)
    unscored.where(sent_at: ..now - REWARD_WINDOW).includes(:user).find_each do |nudge|
      nudge.score! if nudge.window_closes_at <= now
    end
  end

  def cheer? = kind == "cheer"

  # When reaching a day's goal counts as this nudge working: the six hours after it, or for a cheer, the whole of the
  # next day (2am to 2am where they are), since a cheer's job is getting them to come back.
  def window
    return sent_at..sent_at + REWARD_WINDOW unless cheer?

    next_day = built_on + 1
    zone = ActiveSupport::TimeZone[user.timezone.to_s] || ActiveSupport::TimeZone["UTC"]
    from = zone.local(next_day.year, next_day.month, next_day.day, 2)
    from..from + 1.day
  end

  def window_closes_at = window.end

  # Once its window has closed: OPT_OUT_PENALTY if this nudge made them stop π's messages, 1 if they came back and
  # reached the next day's goal (a cheer), 0 otherwise. The others were given their 1 the moment the day's goal was
  # reached inside the window (Nudge.worked!), so one that gets here unscored didn't work.
  def score!
    reward =
      if opted_out_at then OPT_OUT_PENALTY
      elsif cheer? && user.activities.find_by(activity_date: built_on + 1)&.completed? then 1
      else 0
      end
    update!(reward:, rewarded_at: Time.current)
  end

  # A DM from π's bot, unless they're held out: then it's saved as if it had gone, and that's all. If the bot can't
  # DM them, nothing more is tried.
  def deliver!(vars, frame_url: nil)
    self.variant, self.text = Nudge::Copy.render(arm, vars)
    return unless text

    self.frame_url = frame_url
    self.holdout = kind != "test" && self.class.holdout?(user)
    save! # for the token in its links
    return update!(sent_at: Time.current) if holdout

    message = SlackBot.dm(user.slack_id, text: SlackBot.escape(text), blocks: Nudge::Message.new(self).blocks)
    user.update!(slack_dm_failed_at: Time.current) if message.nil? && self.class.configured?
    update!(delivered: message.present?, slack_channel: message&.channel, slack_ts: message&.ts, sent_at: Time.current)
    user.slack_dmed!(sent_at) if delivered
  end

  def link_url = "#{Rails.configuration.x.app_url}/n/#{token}"
  def stop_url = "#{Rails.configuration.x.app_url}/n/#{token}/stop"

  # Someone clicked the button. Counted every time, but the first click is the one that matters.
  def clicked!
    self.class.where(id:).update_all([ "clicks = clicks + 1, clicked_at = COALESCE(clicked_at, ?)", Time.current ])
    reload
  end
end
