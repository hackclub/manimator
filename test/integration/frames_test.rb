require "test_helper"

class FramesTest < ActionDispatch::IntegrationTest
  CODE = "from manim import *\n\nclass OrbitScene(Scene):\n    def construct(self):\n        self.wait()\n"
  JPEG = "\xFF\xD8\xFF\xE0fake jpeg".b
  FRAME = Scene::FRAME_PREFIX + Base64.strict_encode64(JPEG)

  def my_scene
    get editor_path
    post scenes_path, params: { scene: { code: CODE } }, as: :json
    Scene.find(response.parsed_body["id"])
  end

  test "the editor saves a scene's frame, and when it was taken, without it counting as an edit" do
    scene = my_scene
    scene.update_column(:edited_at, 1.day.ago)
    patch scene_path(scene), params: { scene: { frame: FRAME } }, as: :json
    assert_response :ok
    assert_not_includes response.parsed_body.keys, "frame"
    scene.reload
    assert_equal FRAME, scene.frame
    assert_in_delta Time.current, scene.frame_at, 5
    assert_in_delta 1.day.ago, scene.edited_at, 5
    assert_equal CODE, scene.code
  end

  test "a frame has to be a JPEG data URL, and a small one" do
    scene = my_scene
    [ "data:image/png;base64,#{Base64.strict_encode64("png")}", "https://example.com/a.jpg", "#{Scene::FRAME_PREFIX}not base64!",
      Scene::FRAME_PREFIX + Base64.strict_encode64("<script>"), Scene::FRAME_PREFIX + Base64.strict_encode64(JPEG + "x" * 400.kilobytes) ].each do |frame|
      patch scene_path(scene), params: { scene: { frame: } }, as: :json
      assert_response :unprocessable_content
    end
    assert_nil scene.reload.frame
    assert_nil scene.frame_at
  end

  test "someone else's scene doesn't take a frame" do
    other = Scene.create!(visitor_id: "someone-else", code: CODE)
    get editor_path
    patch scene_path(other), params: { scene: { frame: FRAME } }, as: :json
    assert_response :not_found
  end

  test "a scene's frame is a JPEG anyone with its signed address can fetch, Slack included" do
    scene = Scene.create!(visitor_id: "v", code: CODE, frame: FRAME)
    get frame_path(scene.signed_id(purpose: :frame)), headers: { "User-Agent" => "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)" }
    assert_response :ok
    assert_equal "image/jpeg", response.media_type
    assert_equal JPEG, response.body.b
    assert_match(/max-age=300/, response.headers["Cache-Control"])
    assert_match(/public/, response.headers["Cache-Control"])
    assert_nil response.headers["Set-Cookie"]

    get frame_path(scene.signed_id(purpose: :frame)), headers: { "If-Modified-Since" => response.headers["Last-Modified"] }
    assert_response :not_modified
  end

  test "no frame, a plain id, or an id signed for something else is a not found" do
    bare = Scene.create!(visitor_id: "v", code: CODE)
    scene = Scene.create!(visitor_id: "v", code: CODE, frame: FRAME)
    [ bare.signed_id(purpose: :frame), scene.id, scene.signed_id, scene.signed_id(purpose: :other), "nonsense" ].each do |id|
      get frame_path(id)
      assert_response :not_found
    end
  end
end
