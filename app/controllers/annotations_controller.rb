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

  def destroy_all
    @scenario.annotations.delete_all
    @annotations = @scenario.annotations.order(:frame_index)

    respond_to do |format|
      format.turbo_stream
      format.html { redirect_to @scenario, notice: "All annotations deleted." }
      format.json { head :no_content }
    end
  end

  def export
    anns = @scenario.annotations.order(:frame_index)
    base_w = 848.0
    base_h = 480.0

    rgb_blob = @scenario.rgb_video.attached? ? @scenario.rgb_video.blob : nil
    depth_blob = @scenario.depth_video.attached? ? @scenario.depth_video.blob : nil
    app_name = Rails.application.class.module_parent_name rescue Rails.application.class.module_parent.name rescue Rails.application.class.name
    env_name = Rails.env
    exported_at = Time.current

    respond_to do |format|
      format.json do
        headers["Content-Disposition"] = "attachment; filename=annotations_scenario_#{@scenario.id}.json"
        render json: {
          version: 1,
          exported_at: exported_at.iso8601,
          application: {
            name: app_name,
            rails_version: Rails.version,
            ruby_version: RUBY_VERSION,
            environment: env_name
          },
          scenario: {
            id: @scenario.id,
            name: @scenario.name,
            description: @scenario.description,
            created_at: @scenario.created_at&.iso8601,
            updated_at: @scenario.updated_at&.iso8601
          },
          videos: {
            rgb: rgb_blob && {
              attached: true,
              filename: rgb_blob.filename.to_s,
              byte_size: rgb_blob.byte_size,
              content_type: rgb_blob.content_type,
              created_at: rgb_blob.created_at&.iso8601,
              metadata: rgb_blob.metadata&.slice("width", "height", "duration")
            },
            depth: depth_blob && {
              attached: true,
              filename: depth_blob.filename.to_s,
              byte_size: depth_blob.byte_size,
              content_type: depth_blob.content_type,
              created_at: depth_blob.created_at&.iso8601,
              metadata: depth_blob.metadata&.slice("width", "height", "duration")
            }
          },
          fps: 30,
          canvas_size: { width: base_w.to_i, height: base_h.to_i },
          annotations: anns.map { |a| {
            id: a.id,
            created_at: a.created_at&.iso8601,
            updated_at: a.updated_at&.iso8601,
            frame_index: a.frame_index,
            time_sec: a.time_sec,
            stream: a.stream,
            label: a.label,
            box: { x: a.x, y: a.y, width: a.width, height: a.height },
            box_norm: { x: a.x / base_w, y: a.y / base_h, width: a.width / base_w, height: a.height / base_h }
          } }
        }
      end
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
