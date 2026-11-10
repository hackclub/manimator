# Someone signed in with Hack Club Auth. hca_id is their HCA subject (ident!…); everything else is copied from HCA's
# claims each time they sign in, so it stays current. (hackclub/wrong-tool's User, cut down to what manimator uses.)
class User < ApplicationRecord
  has_many :pledges, dependent: :nullify
  has_many :scenes, dependent: :destroy
  has_many :activities, dependent: :destroy

  validates :hca_id, presence: true, uniqueness: true

  # Colours the editor's avatars come in (app.css .avatar--*), picked from your Hack Club ID so it's always the same.
  AVATAR_COLORS = %w[yellow blue teal green purple red].freeze

  def self.from_omniauth(auth)
    claims = auth.extra.raw_info.to_h.with_indifferent_access
    find_or_initialize_by(hca_id: auth.uid).tap do |user|
      user.update!(
        email: auth.info.email,
        name: auth.info.name,
        first_name: auth.info.first_name,
        slack_id: claims[:slack_id],
        verification_status: claims[:verification_status],
        ysws_eligible: claims[:ysws_eligible] || false
      )
    end
  end

  # What a visitor did before signing in (keyed by ApplicationController#visitor_id) becomes theirs: their pledge,
  # their scenes and their time in the editor.
  def adopt!(visitor_id)
    Pledge.where(visitor_id:, user_id: nil).update_all(user_id: id)
    Scene.where(visitor_id:, user_id: nil).update_all(user_id: id)
    adopt_activities!(visitor_id)
  end

  # Your streak: days in a row you reached the day's goal in the editor (Activity), ending today or yesterday, since
  # today doesn't break it until it's over.
  def recalculate_streak!
    streak = activities.streak(Activity.date_for(Time.current, timezone))
    update_columns(current_streak: streak) unless current_streak == streak
    streak
  end

  # All your time in the editor.
  def seconds_total
    activities.total_seconds
  end

  def hours
    (seconds_total / 3600.0).round(1)
  end

  def display_name
    first_name.presence || name.presence || "you"
  end

  def initial
    display_name.first.upcase
  end

  def avatar_color
    AVATAR_COLORS[Digest::SHA256.hexdigest(hca_id).first(8).to_i(16) % AVATAR_COLORS.size]
  end

  # Your timezone (IANA, like "America/New_York"), from your browser whenever it says something different, so it
  # follows you when you travel. Anything that isn't a real timezone is ignored.
  def remember_timezone(name)
    name = TZInfo::Timezone.get(name.to_s).identifier
    update!(timezone: name) unless timezone == name
  rescue TZInfo::InvalidTimezoneIdentifier
    nil
  end

  private
    # A visitor's days become yours. A day you already have time on (you'd worked signed in too) gets theirs added.
    def adopt_activities!(visitor_id)
      transaction do
        Activity.where(visitor_id:, user_id: nil).lock.each do |theirs|
          if (mine = activities.lock.find_by(activity_date: theirs.activity_date))
            mine.update!(seconds: mine.seconds + theirs.seconds, last_beat_at: [ mine.last_beat_at, theirs.last_beat_at ].compact.max)
            theirs.destroy!
          else
            theirs.update!(user_id: id)
          end
        end
      end
      recalculate_streak!
    end
end
