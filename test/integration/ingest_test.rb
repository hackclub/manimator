require "test_helper"

class IngestTest < ActionDispatch::IntegrationTest
  test "events go to PostHog's API host and its script to its assets host" do
    with_posthog_host("https://us.i.posthog.com") do
      assert_equal "https://us.i.posthog.com/e/?ip=1", IngestController.upstream("e/", "ip=1").to_s
      assert_equal "https://us-assets.i.posthog.com/static/array.js", IngestController.upstream("static/array.js").to_s
    end
  end

  test "without PostHog configured there's nothing to forward to" do
    with_posthog_host(nil) do
      post "/ingest/e/", params: "{}", headers: { "Content-Type" => "application/json" }
      assert_response :not_found
    end
  end

  private
    def with_posthog_host(host)
      was = Rails.configuration.x.posthog_host
      Rails.configuration.x.posthog_host = host
      yield
    ensure
      Rails.configuration.x.posthog_host = was
    end
end
