class AnnotationsController < ApplicationController
  before_action :set_scenario

  def index
    @annotations = @scenario.annotations.order(:frame_index)
  end

  private

  def set_scenario
    @scenario = Scenario.find(params[:scenario_id])
  end
end

