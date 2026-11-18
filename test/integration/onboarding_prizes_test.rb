require "test_helper"

class OnboardingPrizesTest < ActionDispatch::IntegrationTest
  test "the story's prize step knows when the postcard is made and that it comes with every prize" do
    get onboarding_path

    assert_response :success
    prizes = JSON.parse(css_select(".story").first["data-story-prizes-value"])
    postcard = prizes.find { |prize| prize["id"] == "postcard" }
    assert_equal [ 1, 1, true ], postcard.values_at("made_at_hours", "videos", "with_every_prize")
    assert prizes.without(postcard).none? { |prize| prize["with_every_prize"] }
  end
end
