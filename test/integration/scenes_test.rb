require "test_helper"

class ScenesTest < ActionDispatch::IntegrationTest
  CODE = "from manim import *\n\nclass OrbitScene(Scene):\n    def construct(self):\n        self.wait()\n"

  def json_headers = { "Accept" => "application/json" }

  test "a visitor's first edit makes a scene, named after its class, and later edits save to it" do
    get editor_path
    post scenes_path, params: { scene: { code: CODE } }, headers: json_headers, as: :json
    assert_response :created
    id = response.parsed_body["id"]
    assert_equal "OrbitScene", response.parsed_body["name"]

    patch scene_path(id), params: { scene: { code: CODE.sub("Orbit", "Spin"), cursor_line: 4 } }, as: :json
    assert_response :ok
    scene = Scene.find(id)
    assert_equal [ "SpinScene", 4 ], [ scene.name, scene.cursor_line ]
  end

  test "moving the cursor doesn't count as an edit" do
    get editor_path
    post scenes_path, params: { scene: { code: CODE } }, as: :json
    scene = Scene.find(response.parsed_body["id"])
    scene.update_column(:edited_at, 1.day.ago)
    patch scene_path(scene), params: { scene: { code: CODE, cursor_line: 3 } }, as: :json
    assert_in_delta 1.day.ago, scene.reload.edited_at, 5
  end

  test "the editor opens your last edited scene, or the one asked for" do
    get editor_path
    post scenes_path, params: { scene: { code: CODE } }, as: :json
    older = response.parsed_body["id"]
    post scenes_path, params: { scene: { code: CODE.sub("Orbit", "Newer") } }, as: :json

    get editor_path
    assert_includes response.body, "NewerScene"
    assert_match(/data-editor-scene-value="[^"]*NewerScene/, response.body)
    get editor_path(scene: older)
    assert_match(/data-editor-scene-value="[^"]*OrbitScene/, response.body)
  end

  test "someone else's scene is a not found" do
    other = Scene.create!(visitor_id: "someone-else", code: CODE)
    get editor_path
    get scene_path(other), headers: json_headers
    assert_response :not_found
    patch scene_path(other), params: { scene: { code: "x" } }, as: :json
    assert_response :not_found
    get editor_path(scene: other.id)
    assert_match(/data-editor-scene-value="\{\}"/, response.body)
  end

  test "signing in takes a visitor's scenes along" do
    OmniAuth.config.test_mode = true
    OmniAuth.config.mock_auth[:hackclub] = OmniAuth::AuthHash.new(provider: "hackclub", uid: "ident!xyz", info: { first_name: "Emmy" }, extra: { raw_info: {} })
    get editor_path
    post scenes_path, params: { scene: { code: CODE } }, as: :json
    post "/auth/hackclub"
    follow_redirect!
    assert_equal User.find_by!(hca_id: "ident!xyz"), Scene.last.user
    get scene_path(Scene.last), headers: json_headers
    assert_response :ok
  ensure
    OmniAuth.config.test_mode = false
  end
end
