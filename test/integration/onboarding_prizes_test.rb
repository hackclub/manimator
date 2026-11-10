require "test_helper"

class OnboardingPrizesTest < ActionDispatch::IntegrationTest
  test "the pledge page says the postcard's whole rule before you pick a prize" do
    get onboarding_path(pledge: 1)

    assert_response :success
    assert_select ".ostep__hint", text: OnboardingHelper::POSTCARD_RULE
    assert_select ".ostep__hint", text: /you pick one prize/
    assert_select ".prize[data-prize=postcard] .prize__hours", text: "1 video · on its own"
    assert_select ".prize[data-prize=hoodie] .prize__hours", text: "4 videos · 10 hours"
  end

  test "the story's prize step knows when the postcard is made and that it comes with every prize" do
    get onboarding_path

    assert_response :success
    prizes = JSON.parse(css_select(".story").first["data-story-prizes-value"])
    postcard = prizes.find { |prize| prize["id"] == "postcard" }
    assert_equal [ 1, 1, true ], postcard.values_at("made_at_hours", "videos", "with_every_prize")
    assert prizes.without(postcard).none? { |prize| prize["with_every_prize"] }
  end
end
