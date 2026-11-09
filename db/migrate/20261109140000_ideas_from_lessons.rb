# Ideas now come from lessons in Euclid's Elements and on Purplemath, not Common Core standards, and link back to them.
class IdeasFromLessons < ActiveRecord::Migration[8.1]
  def change
    rename_column :ideas, :standard, :source
    add_column :ideas, :source_title, :string
    add_column :ideas, :source_url, :string
  end
end
