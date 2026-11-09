# Someone signed in with Hack Club Auth. hca_id is their HCA subject (ident!…); everything else is copied from HCA's
# claims each time they sign in, so it stays current. (hackclub/wrong-tool's User, cut down to what manimator uses.)
class User < ApplicationRecord
  has_many :pledges, dependent: :nullify
  has_many :scenes, dependent: :destroy

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

  # What a visitor did before signing in (keyed by ApplicationController#visitor_id) becomes theirs: their pledge and
  # their scenes.
  def adopt!(visitor_id)
    Pledge.where(visitor_id:, user_id: nil).update_all(user_id: id)
    Scene.where(visitor_id:, user_id: nil).update_all(user_id: id)
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
end
