# Hours of animating for a prize, as wrong-tool's shop counts them: FIRST_RATE dollars an hour for your first
# FIRST_HOURS, RATE an hour after that. The rates and prices stay here: people only ever see hours.
module Shop
  FIRST_HOURS = 10
  FIRST_RATE = 5
  RATE = 4

  # Hours that earn these dollars: always a whole number, always rounded up. (Rounded to a thousandth first, so
  # 12.000000001 is 12, not 13.)
  def self.hours_for(dollars)
    dollars = dollars.to_f
    first = FIRST_HOURS * FIRST_RATE
    hours = dollars <= first ? dollars / FIRST_RATE : FIRST_HOURS + (dollars - first) / RATE
    hours.round(3).ceil
  end
end
