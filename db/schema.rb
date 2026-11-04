# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_11_04_150000) do
  create_table "ideas", force: :cascade do |t|
    t.string "key", null: false
    t.string "standard", null: false
    t.string "topic"
    t.string "band", null: false
    t.string "title", null: false
    t.string "line", null: false
    t.json "needs", default: [], null: false
    t.boolean "drawable", default: true, null: false
    t.string "holder"
    t.datetime "held_until"
    t.datetime "claimed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["band", "claimed_at"], name: "index_ideas_on_band_and_claimed_at"
    t.index ["holder"], name: "index_ideas_on_holder"
    t.index ["key"], name: "index_ideas_on_key", unique: true
  end
end
