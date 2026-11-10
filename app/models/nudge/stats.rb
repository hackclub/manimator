# Whether π's messages do anything: for each kind, the people who were messaged against the people held out
# (Nudge.holdout?), who'd have got the same message at the same moment and got nothing. If the two work rates are
# about the same, the message isn't what's bringing people back.
#
#   Nudge::Stats.new.by_kind   # => { "cheer" => { messaged: Row, holdout: Row }, ... }
#   puts Nudge::Stats.new      # the same as a table (bin/rails nudges:stats)
class Nudge::Stats
  # Counts for some nudges. Worked is of the scored ones; an opt-out is scored, and didn't work. Messaged rows count
  # every DM we tried, delivered says how many got there.
  Row = Data.define(:sent, :delivered, :clicked, :scored, :worked, :opted_out) do
    def self.empty = new(sent: 0, delivered: 0, clicked: 0, scored: 0, worked: 0, opted_out: 0)

    def work_rate = scored.zero? ? nil : worked.fdiv(scored)
    def click_rate = delivered.zero? ? nil : clicked.fdiv(delivered)
  end

  COUNTS = [ "COUNT(*)", "COUNT(*) FILTER (WHERE delivered)", "COUNT(clicked_at)", "COUNT(reward)",
             "COUNT(*) FILTER (WHERE reward = 1)", "COUNT(opted_out_at)" ].map { |sql| Arel.sql(sql) }.freeze

  attr_reader :nudges

  def initialize(nudges = Nudge.real.where.not(sent_at: nil))
    @nudges = nudges
  end

  # Every kind that's gone out, messaged against held out.
  def by_kind
    rows = nudges.group(:kind, :holdout).pluck(:kind, :holdout, *COUNTS).to_h { |kind, holdout, *counts| [ [ kind, holdout ], row(counts) ] }
    rows.keys.map(&:first).uniq.sort.index_with do |kind|
      { messaged: rows.fetch([ kind, false ], Row.empty), holdout: rows.fetch([ kind, true ], Row.empty) }
    end
  end

  # Everything together.
  def totals
    rows = nudges.group(:holdout).pluck(:holdout, *COUNTS).to_h { |holdout, *counts| [ holdout, row(counts) ] }
    { messaged: rows.fetch(false, Row.empty), holdout: rows.fetch(true, Row.empty) }
  end

  # Each wording of a kind's arm, messaged only: which one works.
  def variants(kind)
    nudges.where(kind:, holdout: false).group(:arm, :variant).pluck(:arm, :variant, *COUNTS)
          .to_h { |arm, variant, *counts| [ [ arm, variant ], row(counts) ] }
  end

  def muted_users = User.where.not(slack_muted_at: nil).count
  def failed_dms = User.where.not(slack_dm_failed_at: nil).count

  def to_s
    lines = [ format("%-14s %-9s %6s %7s %7s %7s %8s", "kind", "group", "sent", "scored", "worked", "rate", "stopped") ]
    by_kind.merge("all" => totals).each do |kind, groups|
      groups.each do |group, row|
        rate = row.work_rate ? "#{(row.work_rate * 100).round}%" : "-"
        lines << format("%-14s %-9s %6d %7d %7d %7s %8d", kind, group, row.sent, row.scored, row.worked, rate, row.opted_out)
      end
    end
    lines.join("\n")
  end

  private
    def row(counts)
      sent, delivered, clicked, scored, worked, opted_out = counts
      Row.new(sent:, delivered:, clicked:, scored:, worked:, opted_out:)
    end
end
