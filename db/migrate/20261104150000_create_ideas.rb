class CreateIdeas < ActiveRecord::Migration[8.1]
  def change
    create_table :ideas do |t|
      t.string :key, null: false
      t.string :standard, null: false
      t.string :topic
      t.string :band, null: false
      t.string :title, null: false
      t.string :line, null: false
      t.json :needs, null: false, default: []
      t.boolean :drawable, null: false, default: true

      # Who has it: held while they decide (until held_until), theirs for good once claimed_at is set.
      t.string :holder
      t.datetime :held_until
      t.datetime :claimed_at
      t.timestamps
    end
    add_index :ideas, :key, unique: true
    add_index :ideas, [ :band, :claimed_at ]
    add_index :ideas, :holder
  end
end
