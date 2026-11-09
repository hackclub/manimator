require "test_helper"

class IdeaTest < ActiveSupport::TestCase
  def idea(band, n, source: "#{band}.#{n}")
    Idea.create!(key: "#{band}/#{n}", source:, band:, title: "idea #{n}", line: "line #{n}")
  end

  def draw(holder, klass, **options) = Idea.draw(holder:, klass:, **options)

  test "a draw holds three ideas from the class's own band first" do
    mine = 3.times.map { |n| idea("geometry", n) }
    idea("middle", 9)
    drawn = draw("ada", "geometry")
    assert_equal mine.sort_by(&:id), drawn.sort_by(&:id)
    assert drawn.map(&:reload).all? { |i| i.holder == "ada" && i.held_until.future? }
  end

  test "each from a different lesson where it can" do
    3.times { |n| idea("algebra1", n, source: "Euclid I.1") }
    other = idea("algebra1", 5, source: "Euclid I.2")
    drawn = draw("ada", "algebra1", count: 2)
    assert_includes drawn, other
  end

  test "falls back to the class's next band, and runs out" do
    fallback = idea("middle", 1)
    assert_equal [ fallback ], draw("ada", "geometry")
    assert_empty draw("bo", "geometry")
  end

  test "nobody draws ideas someone else is holding or has claimed" do
    7.times { |n| idea("algebra1", n) }
    a = draw("ada", "algebra1")
    assert Idea.claim(a.first.id, holder: "ada")
    b = draw("bo", "algebra1")
    c = draw("cy", "algebra1")
    assert_equal 7, (a + b + c).map(&:id).uniq.size
    assert_empty draw("di", "algebra1")
  end

  test "claiming one lets the others go" do
    3.times { |n| idea("algebra1", n) }
    first, *rest = draw("ada", "algebra1")
    assert Idea.claim(first.id, holder: "ada")
    assert rest.map(&:reload).none?(&:holder)
  end

  test "drawing again lets the last ones go and skips the ones you've seen" do
    6.times { |n| idea("algebra2", n) }
    first = draw("ada", "algebra2")
    second = draw("ada", "algebra2", except: first.map(&:id))
    assert_empty first.map(&:id) & second.map(&:id)
    assert first.map(&:reload).none?(&:holder)
  end

  test "once you've seen them all, drawing goes round again, not the last ones twice running" do
    ideas = 6.times.map { |n| idea("algebra2", n) }
    seen = ideas.map(&:id)
    3.times { assert_equal seen.first(3).sort, draw("ada", "algebra2", except: seen).map(&:id).sort }
  end

  test "an expired hold goes back in the pool" do
    only = idea("precalc", 1)
    draw("ada", "precalc")
    travel Idea::HOLD + 1.minute do
      assert_equal [ only ], draw("bo", "precalc")
    end
  end

  test "only one person can claim an idea" do
    only = idea("precalc", 1)
    draw("ada", "precalc")
    assert_not Idea.claim(only.id, holder: "bo")
    assert Idea.claim(only.id, holder: "ada")
    assert_not Idea.claim(only.id, holder: "ada")
    travel 1.year do
      assert_empty draw("bo", "precalc")
    end
  end

  test "ideas that need 3D are never drawn" do
    Idea.create!(key: "x", source: "Euclid XI.1", band: "geometry", title: "t", line: "l", needs: [ "3d" ], drawable: false)
    assert_empty draw("ada", "geometry")
  end

  test "lessons with the fewest claimed ideas come first" do
    taken = idea("middle", 1, source: "Euclid VII.1")
    idea("middle", 2, source: "Euclid VII.1")
    fresh = idea("middle", 3, source: "Euclid IX.20")
    Idea.claim(taken.id, holder: "ada")
    assert_equal [ fresh ], draw("bo", "middle", count: 1)
  end

  test "importing stops handing out ideas that left the file, but keeps who claimed them" do
    old = idea("geometry", 1)
    Idea.claim(draw("ada", "geometry").first.id, holder: "ada")
    path = Rails.root.join("tmp/ideas-test.json")
    File.write(path, [ { key: "euclid-i-47/squares", source: "Euclid I.47", source_title: "Euclid's Elements: Book I, Proposition 47",
      source_url: "https://mathcs.clarku.edu/~djoyce/java/elements/bookI/propI47.html", topic: "Book I", band: "geometry",
      title: "Squares", line: "l", needs: [] } ].to_json)
    assert_equal 1, Idea.import!(path)
    assert_not old.reload.drawable
    assert old.claimed_at
    assert_equal [ "Euclid's Elements: Book I, Proposition 47" ], draw("bo", "geometry").map(&:source_title)
  ensure
    File.delete(path) if path && File.exist?(path)
  end
end
