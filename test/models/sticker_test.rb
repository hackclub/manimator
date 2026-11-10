require "test_helper"

class StickerTest < ActiveSupport::TestCase
  NOON = Time.utc(2026, 11, 10, 12)
  ADDRESS = { "street_address" => "15 Falls Rd", "locality" => "Shelburne", "region" => "VT", "postal_code" => "05482", "country" => "US" }.freeze

  setup do
    @user = User.create!(hca_id: "ident!ada", name: "Ada Lovelace", timezone: "UTC")
  end

  # A beat every 30 seconds from noon
  def beats(count, **who)
    who = { user: @user } if who.empty?
    count.times { |i| Activity.beat!(**who, timezone: "UTC", now: NOON + i * 30) }
  end

  test "finishing your first session earns one sticker, once" do
    beats(10)
    assert_nil @user.reload.sticker
    beats(11)
    sticker = @user.reload.sticker
    assert sticker
    assert_no_difference -> { Sticker.count } do
      assert_equal sticker, Sticker.earn(@user)
    end
  end

  test "nothing's earned before a session is finished" do
    assert_nil Sticker.earn(@user)
  end

  test "a session finished before signing in earns it at sign-in" do
    beats(11, visitor_id: "v1")
    assert_difference -> { Sticker.count }, 1 do
      @user.adopt!("v1")
    end
    assert @user.reload.sticker
  end

  test "what's due is unsent with an address, oldest first; the rest wait on one" do
    grace = User.create!(hca_id: "ident!grace", timezone: "UTC", address: ADDRESS)
    emmy = User.create!(hca_id: "ident!emmy", timezone: "UTC", address: ADDRESS)
    waiting = Sticker.create!(user: @user, earned_at: NOON)
    first = Sticker.create!(user: grace, earned_at: NOON - 1.day)
    posted = Sticker.create!(user: emmy, earned_at: NOON - 2.days)
    posted.sent!

    assert_equal [ first ], Sticker.due
    assert_equal [ waiting ], Sticker.waiting_on_address
    assert posted.sent?
  end

  test "the address from Hack Club Auth is kept, encrypted, and survives a sign-in that doesn't share one" do
    auth = ->(address) do
      OmniAuth::AuthHash.new(uid: "ident!ada", info: { name: "Ada Lovelace" }, extra: { raw_info: { address: } })
    end
    user = User.from_omniauth(auth.(ADDRESS.merge("extra" => "dropped", "region" => " VT ")))
    assert_equal ADDRESS, user.address
    assert_not user.needs_address?
    assert_no_match(/Shelburne/, User.connection.select_value("SELECT address FROM users WHERE id = #{user.id}"))

    assert_equal ADDRESS, User.from_omniauth(auth.(nil)).address
    assert_equal ADDRESS, User.from_omniauth(auth.(ADDRESS.to_json)).address
  end
end
