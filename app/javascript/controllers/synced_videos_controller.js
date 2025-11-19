import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["rgb", "timeDisplay", "frameDisplay"]
  static values = { fps: Number }

  connect() {
    if (!this.hasFpsValue) this.fpsValue = 30

    if (this.hasRgbTarget) {
      const handler = () => this.updateFromVideo()
      this._syncedVideosHandler = handler
      this.rgbTarget.addEventListener("loadedmetadata", handler)
      this.rgbTarget.addEventListener("seeked", handler)
      this.rgbTarget.addEventListener("timeupdate", handler)
      this.rgbTarget.addEventListener("pause", handler)
      this.rgbTarget.addEventListener("play", handler)
      this.updateFromVideo()
    }
  }

  disconnect() {
    if (this.hasRgbTarget && this._syncedVideosHandler) {
      const handler = this._syncedVideosHandler
      this.rgbTarget.removeEventListener("loadedmetadata", handler)
      this.rgbTarget.removeEventListener("seeked", handler)
      this.rgbTarget.removeEventListener("timeupdate", handler)
      this.rgbTarget.removeEventListener("pause", handler)
      this.rgbTarget.removeEventListener("play", handler)
    }
  }

  updateFromVideo() {
    const currentTime = (this.rgbTarget?.currentTime) || 0
    const fps = this.hasFpsValue ? this.fpsValue : 30
    const frameIndex = Math.floor(currentTime * fps)

    if (this.hasTimeDisplayTarget) {
      this.timeDisplayTarget.textContent = `${currentTime.toFixed(2)}s`
    }

    if (this.hasFrameDisplayTarget) {
      this.frameDisplayTarget.textContent = `frame ${frameIndex}`
    }
  }
}
