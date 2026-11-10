# A nudge as a Slack message (Block Kit): the latest frame of their scene up top when there is one, what π says,
# then the button to the editor and a way to stop these. Both buttons are tracked links (NudgeLinksController).
class Nudge::Message
  attr_reader :nudge

  def initialize(nudge)
    @nudge = nudge
  end

  def blocks
    [
      ({ type: "image", image_url: nudge.frame_url, alt_text: Nudge::Copy::FRAME_ALT } if nudge.frame_url),
      { type: "section", text: { type: "mrkdwn", text: SlackBot.escape(nudge.text) } },
      { type: "actions", elements: [
        { type: "button", text: { type: "plain_text", text: Nudge::Copy::OPEN }, style: "primary",
          url: nudge.link_url, action_id: "nudge_open" },
        { type: "button", text: { type: "plain_text", text: Nudge::Copy::STOP }, url: nudge.stop_url, action_id: "nudge_stop" }
      ] }
    ].compact
  end
end
