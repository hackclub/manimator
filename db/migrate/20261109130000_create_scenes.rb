class CreateScenes < ActiveRecord::Migration[8.1]
  def change
    create_table :scenes do |t|
      t.references :user, foreign_key: true
      t.string :visitor_id, index: true
      t.string :name, null: false, default: "scene"
      t.text :code, null: false, default: ""
      t.integer :cursor_line
      t.datetime :edited_at, null: false

      t.timestamps
    end
    add_index :scenes, [ :user_id, :edited_at ]
  end
end
