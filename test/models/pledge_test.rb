require "test_helper"

class PledgeTest < ActiveSupport::TestCase
  def pledge(**attributes)
    Pledge.new(visitor_id: "v", idea: "Fourier series", build_time: "evening", days_per_week: 3, session_minutes: 60,
      signed_at: Time.current, **attributes)
  end

  test "valid with what the pledge page sends" do
    assert pledge(for_whom: "friend", prize: "hoodie", timezone: "America/New_York", ship_by: Date.tomorrow).valid?
  end

  test "only the choices the page offers" do
    assert_not pledge(for_whom: "my cat").valid?
    assert_not pledge(build_time: "3am").valid?
    assert_not pledge(session_minutes: 45).valid?
    assert_not pledge(days_per_week: 4).valid?
  end
end
