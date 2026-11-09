module PagesHelper
  PI_POSES = %w[plain happy hooray wave_1 wave_2 wave_3 speaking surprised tease awe thinking erm dance_1 dance_2 dance_3].freeze

  # Every "Start animating" / "sign in" link goes through onboarding (the pledge).
  def start_path
    onboarding_path
  end

  def pi_pose_urls
    PI_POSES.to_h { |pose| [ pose, image_path("pi_creature/#{pose}.svg") ] }.to_json
  end
end
