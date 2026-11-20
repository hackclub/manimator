# Airtable, for π's follow-up email, the way hackclub/stardance sends its emails: the app never emails anyone itself.
# It upserts people into an Airtable table (by email) with "Loops - manimator…" fields, Hack Club's Airtable → Loops
# sync turns those into Loops contact properties, and a Loops workflow sends the email when one is set (see
# OnboardingVisit::LoopsSync). Loops handles unsubscribing.
#
# From credentials (airtable.api_key, airtable.base_id, airtable.users_table) or AIRTABLE_API_KEY, AIRTABLE_BASE_ID and
# AIRTABLE_USERS_TABLE (default "_users"). Without a key and base nothing is synced, and nobody is put in a follow-up
# arm either, so the holdout isn't spent on people who'd never have been emailed. Tests never have them.
airtable = ->(key) { Rails.application.credentials.dig(:airtable, key) || ENV["AIRTABLE_#{key.upcase}"] unless Rails.env.test? }

Rails.application.config.x.airtable_api_key = airtable.(:api_key).presence
Rails.application.config.x.airtable_base_id = airtable.(:base_id).presence
Rails.application.config.x.airtable_users_table = airtable.(:users_table).presence || "_users"
Rails.application.config.x.loops_sync_configured =
  Rails.application.config.x.airtable_api_key.present? && Rails.application.config.x.airtable_base_id.present?
