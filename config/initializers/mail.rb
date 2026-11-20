# Email (OnboardingMailer, π's one follow-up to people who left onboarding). SMTP from credentials (smtp.address,
# smtp.port, smtp.user_name, smtp.password) or SMTP_ADDRESS, SMTP_PORT, SMTP_USERNAME and SMTP_PASSWORD; the sender
# from mail.from or MAIL_FROM. Without an SMTP address nothing is sent, and nobody is put in a follow-up arm either,
# so the holdout isn't spent on people who'd never have been emailed. Tests always count as configured (:test).
smtp = ->(key, env) { Rails.application.credentials.dig(:smtp, key) || ENV[env] }
address = smtp.(:address, "SMTP_ADDRESS")

Rails.application.config.x.mail_from = Rails.application.credentials.dig(:mail, :from) || ENV.fetch("MAIL_FROM", "π at Manimator <manimator@hackclub.com>")
Rails.application.config.x.mail_configured = Rails.env.test? || address.present?

if address.present? && !Rails.env.test?
  settings = {
    address:,
    port: smtp.(:port, "SMTP_PORT")&.to_i || 587,
    user_name: smtp.(:user_name, "SMTP_USERNAME"),
    password: smtp.(:password, "SMTP_PASSWORD"),
    authentication: :plain,
    enable_starttls_auto: true
  }.compact
  ActiveSupport.on_load(:action_mailer) do
    self.delivery_method = :smtp
    self.smtp_settings = settings
  end
end
