# Postgres has no equality for json, which the upsert in Idea.import! needs to compare rows.
class ChangeIdeasNeedsToJsonb < ActiveRecord::Migration[8.1]
  def up
    change_column :ideas, :needs, :jsonb, default: [], null: false
  end

  def down
    change_column :ideas, :needs, :json, default: [], null: false
  end
end
