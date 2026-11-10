# How long someone worked in the editor on one day, counted from the editor's heartbeats. Theirs by user once they've
# signed in, by visitor id until then (User#adopt! takes a visitor's days along).
class Activity < ApplicationRecord
  belongs_to :user, optional: true
end
