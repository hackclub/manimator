namespace :onboarding do
  # Where π asks for your email, compared (OnboardingVisit::EMAIL_ARMS). Per group: visitors, how many we could even
  # ask (no email from Hack Club Auth's whoami), how many gave one when asked, how many got as far as an idea, and how
  # many signed. SINCE=2026-11-21 counts from a date. Small numbers mean nothing: wait for a few hundred per group.
  desc "Compare the email-ask test groups: emails and pledges per visitor"
  task email_ab: :environment do
    since = Time.zone.parse(ENV.fetch("SINCE", "2026-11-20"))
    pct = ->(n, d) { d.zero? ? "-" : format("%.0f%%", 100.0 * n / d) }
    puts "since #{since.to_date}"
    puts format("%-6s %9s %10s %12s %10s %9s", "group", "visitors", "askable", "gave email", "had idea", "signed")
    OnboardingVisit::EMAIL_ARMS.each do |arm|
      visits = OnboardingVisit.where(email_arm: arm).where(created_at: since..)
      total = visits.count
      askable = total - visits.where(email_source: "whoami").count
      asked = visits.where(email_source: "asked").count
      idea = visits.where("answers ? 'idea'").count
      signed = visits.pledged.count
      puts format("%-6s %9d %10d %12s %10s %9s", arm, total, askable, "#{asked} (#{pct.(asked, askable)})", pct.(idea, total), pct.(signed, total))
    end
  end
end
