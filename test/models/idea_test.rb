require "test_helper"

class IdeaTest < ActiveSupport::TestCase
  def idea(band, n, standard: "8.G.B.#{n}")
    Idea.create!(key: "#{band}/#{n}", standard:, band:, title: "idea #{n}", line: "line #{n}")
  end

  test "a draw holds an idea from the class's own band first" do
    mine = idea("geometry", 1)
    idea("middle", 2)
    drawn = Idea.draw(holder: "ada", klass: "geometry")
    assert_equal mine, drawn
    assert_equal "ada", drawn.reload.holder
    assert drawn.held_until.future?
  end

  test "falls back to the class's next band, and runs out" do
    fallback = idea("middle", 1)
    assert_equal fallback, Idea.draw(holder: "ada", klass: "geometry")
    assert_nil Idea.draw(holder: "bo", klass: "geometry")
  end

  test "nobody draws an idea someone else is holding or has claimed" do
    3.times { |n| idea("algebra1", n) }
    a = Idea.draw(holder: "ada", klass: "algebra1")
    b = Idea.draw(holder: "bo", klass: "algebra1")
    assert Idea.claim(a.id, holder: "ada")
    c = Idea.draw(holder: "cy", klass: "algebra1")
    assert_equal 3, [ a, b, c ].map(&:id).uniq.size
    assert_nil Idea.draw(holder: "di", klass: "algebra1")
  end

  test "drawing again lets the last one go and skips the ones you've seen" do
    first, second = idea("algebra2", 1), idea("algebra2", 2)
    drawn = Idea.draw(holder: "ada", klass: "algebra2")
    other = Idea.draw(holder: "ada", klass: "algebra2", except: [ drawn.id ])
    assert_equal [ first, second ].sort_by(&:id), [ drawn, other ].sort_by(&:id)
    assert_nil drawn.reload.holder
  end

  test "once you've seen them all, drawing goes round again, never the same one twice running" do
    first, second = idea("algebra2", 1), idea("algebra2", 2)
    5.times { assert_equal first, Idea.draw(holder: "ada", klass: "algebra2", except: [ first.id, second.id ]) }
    5.times { assert_equal second, Idea.draw(holder: "ada", klass: "algebra2", except: [ second.id, first.id ]) }
  end

  test "an expired hold goes back in the pool" do
    only = idea("precalc", 1)
    Idea.draw(holder: "ada", klass: "precalc")
    travel Idea::HOLD + 1.minute do
      assert_equal only, Idea.draw(holder: "bo", klass: "precalc")
    end
  end

  test "only one person can claim an idea" do
    only = idea("precalc", 1)
    Idea.draw(holder: "ada", klass: "precalc")
    assert_not Idea.claim(only.id, holder: "bo")
    assert Idea.claim(only.id, holder: "ada")
    assert_not Idea.claim(only.id, holder: "ada")
    travel 1.year do
      assert_nil Idea.draw(holder: "bo", klass: "precalc")
    end
  end

  test "ideas that need 3D are never drawn" do
    Idea.create!(key: "x", standard: "HSG-GMD.B.4", band: "geometry", title: "t", line: "l", needs: [ "3d" ], drawable: false)
    assert_nil Idea.draw(holder: "ada", klass: "geometry")
  end

  test "standards with the fewest claimed ideas come first" do
    taken = idea("middle", 1, standard: "7.G.A.1")
    idea("middle", 2, standard: "7.G.A.1")
    fresh = idea("middle", 3, standard: "7.G.B.4")
    Idea.claim(taken.id, holder: "ada")
    assert_equal fresh, Idea.draw(holder: "bo", klass: "middle")
  end
end
