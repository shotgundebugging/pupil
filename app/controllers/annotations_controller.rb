class AnnotationsController < ApplicationController
  before_action :set_scenario

  def index
    @annotations = @scenario.annotations.order(:frame_index)
  end

  def create
    @annotation = @scenario.annotations.build(annotation_params)

    if @annotation.save
      @annotations = @scenario.annotations.order(:frame_index)

      respond_to do |format|
        format.turbo_stream
        format.json { render json: @annotation, status: :created }
      end
    else
      head :unprocessable_entity
    end
  end

  private

  def set_scenario
    @scenario = Scenario.find(params[:scenario_id])
  end

  def annotation_params
    params.require(:annotation).permit(
      :frame_index,
      :time_sec,
      :stream,
      :label,
      :x, :y, :width, :height
    )
  end
end
