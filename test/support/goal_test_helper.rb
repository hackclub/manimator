# The day's goals, for tests whose durations only exist to land on, just under or just over one. Say them through
# these rather than as minutes or beat counts, so the tests still mean the same thing when a goal changes.
module GoalTestHelper
  def first_day_goal = Activity::FIRST_DAY_GOAL_SECONDS
  def daily_goal = Activity::DAILY_GOAL_SECONDS
  def first_day_minutes = first_day_goal / 60
  def daily_minutes = daily_goal / 60

  # How many beats, `every` seconds apart, add up to `seconds`: the first starts the clock and counts nothing.
  def beats_for(seconds, every: 30) = seconds / every + 1
end
