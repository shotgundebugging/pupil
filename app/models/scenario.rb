class Scenario < ApplicationRecord
  has_one_attached :rgb_video
  has_one_attached :depth_video

  has_many :annotations, dependent: :destroy
end
