# Every 15 minutes: π's nudges for everyone whose booked time or slot it is (see Nudge.deliver_due).
class NudgeDeliveryJob < ApplicationJob
  def perform
    Nudge.deliver_due
  end
end
