# Handing out ideas during the pledge (Idea), to whoever's asking (ApplicationController#visitor_id).
class IdeasController < ApplicationController
  def draw
    ideas = Idea.draw(holder: visitor_id, klass: params[:klass].to_s, except: Array(params[:except]).map(&:to_i).last(60))
    ideas.any? ? render(json: ideas) : head(:no_content)
  end

  def claim
    Idea.claim(params[:id].to_i, holder: visitor_id) ? head(:ok) : head(:conflict)
  end
end
