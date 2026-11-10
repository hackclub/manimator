# The editor's heartbeat: while you're working it beats every 30 seconds, and each beat adds to your time today
# (Activity.beat!). Asking (GET) says where you stand without counting anything. For whoever's signed in, or the
# visitor until they do.
class HeartbeatsController < ApplicationController
  def show
    render json: standing(person_days.find_by(activity_date: today))
  end

  def create
    current_user&.remember_timezone(params[:timezone])
    render json: standing(Activity.beat!(user: current_user, visitor_id:, timezone:))
  end

  private
    def person_days
      Activity.of(user: current_user, visitor_id:)
    end

    # Yours as we remember it once you've signed in, otherwise whatever the browser says.
    def timezone
      current_user&.timezone.presence || params[:timezone]
    end

    def today
      Activity.date_for(Time.current, timezone)
    end

    # What the editor shows: today against its goal, your streak and all your time. Today with nothing on it yet
    # still has a goal.
    def standing(day)
      day ||= person_days.new(activity_date: today)
      {
        today_seconds: day.seconds,
        goal_seconds: day.goal_seconds,
        completed: day.completed?,
        first_day: day.first_day?,
        # Counted again each time, so a streak that lapsed while you were away doesn't linger.
        streak: current_user ? current_user.recalculate_streak! : person_days.streak(today),
        total_seconds: person_days.total_seconds,
        postcard_seconds: Activity::POSTCARD_SECONDS
      }
    end
end
