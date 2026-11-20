# Puts people from onboarding into Airtable's users table, keyed by email, for Hack Club's Airtable → Loops sync, as
# hackclub/stardance's Airtable::UserSyncJob does (Airtable is the only sanctioned path to Loops; no direct API).
#
# π's follow-up is a Loops workflow that fires on the "Loops - manimatorFollowupAt" timestamp and fills the email in
# from "Loops - manimatorFollowupUrl" (the link straight back) and "Loops - manimatorFollowupIdea" (blank before an
# idea). Those are only ever sent for a visit in the "sent" arm, so the holdout, or a second visit with the same email,
# never sets or clears them. Every field here has to exist on the table.
class OnboardingVisit::LoopsSync
  BATCH = 100

  def self.run = new.run

  def run
    return unless Rails.configuration.x.loops_sync_configured
    visits = OnboardingVisit.loops_unsynced.order(:updated_at).limit(BATCH).to_a
    return if visits.empty?

    # One row per email; the visit that's being followed up wins, so its fields go out.
    rows = visits.sort_by { |visit| visit.followup_arm == "sent" ? 0 : 1 }.uniq(&:email).map { |visit| table.new(fields(visit)) }
    table.batch_upsert(rows, "email")
    OnboardingVisit.where(id: visits.map(&:id)).update_all(loops_synced_at: Time.current)
  end

  def fields(visit)
    fields = {
      "email" => visit.email,
      "first_name" => visit.first_name,
      "Loops - manimatorOnboardingStep" => visit.last_step,
      "Loops - manimatorPledged" => visit.pledged_at.present?,
      "Loops - manimatorRef" => visit.utm["ref"] || visit.utm["utm_source"]
    }.compact
    return fields unless visit.followup_arm == "sent"

    fields.merge(
      "Loops - manimatorFollowupAt" => visit.followup_at.iso8601,
      "Loops - manimatorFollowupUrl" => visit.back_url,
      "Loops - manimatorFollowupIdea" => visit.answers["idea"].to_s
    )
  end

  private
    def table
      @table ||= Norairrecord.table(Rails.configuration.x.airtable_api_key, Rails.configuration.x.airtable_base_id, Rails.configuration.x.airtable_users_table)
    end
end
