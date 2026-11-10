namespace :stickers do
  # Everyone owed a π sticker for their first session whose address we have, oldest first, tab-separated to paste into
  # a sheet or whatever posts them. The id is what stickers:sent takes.
  #
  #   bin/rails stickers:due > stickers.tsv
  desc "List the π stickers to post, tab-separated"
  task due: :environment do
    row = ->(values) { values.map { |value| value.to_s.gsub(/\s+/, " ") }.join("\t") }
    puts row.(%w[id name earned_at] + User::ADDRESS_FIELDS)
    Sticker.due.each do |sticker|
      user = sticker.user
      puts row.([ sticker.id, user.name, sticker.earned_at.to_date, *user.address.values_at(*User::ADDRESS_FIELDS) ])
    end
    waiting = Sticker.waiting_on_address.size
    warn "#{waiting} more earned a sticker but haven't shared an address." if waiting.positive?
  end

  # Mark stickers as posted, by the ids stickers:due gave:
  #
  #   bin/rails "stickers:sent[3 4 9]"
  desc "Mark π stickers as posted"
  task :sent, [ :ids ] => :environment do |_, args|
    ids = args.fetch(:ids).split
    Sticker.unsent.where(id: ids).each(&:sent!)
    puts "#{Sticker.sent.where(id: ids).count} of #{ids.size} marked as posted."
  end
end
