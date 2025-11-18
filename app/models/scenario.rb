class Scenario < ApplicationRecord
  has_one_attached :rgb_video
  has_one_attached :depth_video
end
