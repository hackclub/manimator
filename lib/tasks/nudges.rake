namespace :nudges do
  # One of each kind of nudge π sends, to someone on Slack, through the real thing (copy, their latest frame, tracked
  # links), with made-up numbers. Marked as tests, so they're never scored, counted or held out. Run it where the
  # links should go, like production:
  #
  #   bin/rails "nudges:test[U05F4B48GBF]"
  desc "DM someone one of each kind of π's nudges, for testing"
  task :test, [ :slack_id ] => :environment do |_, args|
    user = User.find_by!(slack_id: args.fetch(:slack_id))
    context = Nudge::Context.new(user)
    vars = { idea: "“why e^(iπ) = −1”", local_time: "7pm", goal: "20 minutes", left_today: "6 minutes", hours: "3.5 hours",
             prize: "Chunky Pi Plushie", prize_hours: "7 hours", streak: 4, streak_next: 5, minutes: "22 minutes",
             day: "today", next_day: "tomorrow", total: "3.5 hours" }

    Nudge::Copy::ARMS.each_key do |arm|
      nudge = user.nudges.new(kind: "test", arm:)
      nudge.deliver!(vars, frame_url: context.frame_url)
      puts "#{arm} (wording #{nudge.variant}): #{nudge.delivered ? "sent" : "not sent"}, #{nudge.link_url}"
    end
  end

  #   bin/rails nudges:stats
  desc "Each kind of nudge, the people messaged against the people held out"
  task stats: :environment do
    puts Nudge::Stats.new
  end
end
