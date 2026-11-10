# One message π sent someone on Slack, and whether they worked afterwards.
class Nudge < ApplicationRecord
  belongs_to :user
  has_secure_token :token
end
