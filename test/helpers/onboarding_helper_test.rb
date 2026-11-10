require "test_helper"

class OnboardingHelperTest < ActionView::TestCase
  test "the postcard is made at one hour and, on its own, is the prize for one video" do
    postcard = OnboardingHelper::PRIZES.find { |prize| prize[:id] == "postcard" }

    assert_equal OnboardingHelper::PRIZES.first, postcard
    assert_equal 1, postcard[:made_at_hours]
    assert_equal Pledge::HOURS_PER_VIDEO, postcard[:hours]
    assert_equal 1, postcard[:videos]
    assert postcard[:with_every_prize]
  end

  test "only the postcard comes with every prize, and no other prize is made early" do
    others = OnboardingHelper::PRIZES.reject { |prize| prize[:id] == "postcard" }

    assert others.none? { |prize| prize[:with_every_prize] || prize[:made_at_hours] }
    assert others.all? { |prize| prize[:hours] > OnboardingHelper::POSTCARD[:made_at_hours] }
  end

  test "every prize says its id, name, hours and videos, and its videos cover its hours" do
    OnboardingHelper::PRIZES.each do |prize|
      assert prize.values_at(:id, :name, :hours, :videos, :image).all?(&:present?), prize[:id]
      assert_operator prize[:videos] * Pledge::HOURS_PER_VIDEO, :>=, prize[:hours], prize[:id]
    end
    assert_equal OnboardingHelper::PRIZES.map { |prize| prize[:hours] }.sort, OnboardingHelper::PRIZES.map { |prize| prize[:hours] }
  end

  test "the rule is said whole: made at one hour, mailed with any prize, one video on its own" do
    rule = OnboardingHelper::POSTCARD_RULE

    assert_includes rule, "one hour"
    assert_includes rule, "whatever prize you earn"
    assert_includes rule, "one video"
  end
end
