# When they said they'd sit down next (asked at the end of their first session), and a picture of a scene's latest
# frame (a JPEG data URL) for their postcard and π's messages.
class AddNextSessionAndFrame < ActiveRecord::Migration[8.1]
  def change
    add_column :pledges, :next_session_at, :datetime
    add_column :scenes, :frame, :text
    add_column :scenes, :frame_at, :datetime
  end
end
