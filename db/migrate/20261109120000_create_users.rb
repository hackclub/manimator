class CreateUsers < ActiveRecord::Migration[8.1]
  def change
    create_table :users do |t|
      t.string :hca_id, null: false, index: { unique: true }
      t.string :email
      t.string :name
      t.string :first_name
      t.string :slack_id
      t.string :verification_status
      t.boolean :ysws_eligible, null: false, default: false
      t.string :timezone

      t.timestamps
    end

    add_reference :pledges, :user, foreign_key: true
  end
end
