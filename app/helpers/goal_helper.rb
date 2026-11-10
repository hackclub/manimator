# Today's goal in the editor's bar and what meeting it gets you (editors/_goal.html.erb, goal_controller.js).
module GoalHelper
  # The pledge of whoever's looking: by account once they've signed in, by visitor id until then (as
  # PledgesController#update finds it). Nil if they never pledged.
  def latest_pledge
    mine = signed_in? ? current_user.pledges : Pledge.where(visitor_id: cookies.signed[:visitor_id], user_id: nil)
    mine.order(:signed_at).last
  end

  # The local time they said they'd work ("19:00"), for ∞ to offer as their next sit-down.
  def usual_time(pledge)
    Pledge::SLOTS[pledge&.build_time]
  end
end
