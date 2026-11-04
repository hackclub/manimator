# Handing out ideas during the pledge (Idea). Until there are accounts, whoever's asking is a random id in a cookie.
class IdeasController < ApplicationController
  def draw
    ideas = Idea.draw(holder:, klass: params[:klass].to_s, except: Array(params[:except]).map(&:to_i).last(60))
    ideas.any? ? render(json: ideas) : head(:no_content)
  end

  def claim
    Idea.claim(params[:id].to_i, holder:) ? head(:ok) : head(:conflict)
  end

  private

  def holder
    cookies.permanent.signed[:idea_holder] ||= SecureRandom.uuid
  end
end
