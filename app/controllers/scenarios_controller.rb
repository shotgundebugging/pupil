class ScenariosController < ApplicationController
  before_action :set_scenario, only: [ :show ]

  def index
    @scenarios = Scenario.all.order(created_at: :desc)
  end

  def show
  end

  def new
    @scenario = Scenario.new
  end

  def create
    @scenario = Scenario.new(scenario_params)
    if @scenario.save
      redirect_to @scenario, notice: "Scenario was successfully created."
    else
      render :new, status: :unprocessable_entity
    end
  end

  private
  def set_scenario
    @scenario = Scenario.find(params[:id])
  end

  def scenario_params
    params.require(:scenario).permit(:name, :description, :rgb_video, :depth_video)
  end
end
