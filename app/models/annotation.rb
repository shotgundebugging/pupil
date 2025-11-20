class Annotation < ApplicationRecord
  belongs_to :scenario

  enum :stream, { rgb: "rgb", depth: "depth" }

  validates :frame_index, :time_sec, :label,
            :x, :y, :width, :height,
            presence: true
end

