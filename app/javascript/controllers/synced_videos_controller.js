import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = [
    "rgb",
    "depth",
    "timeDisplay",
    "frameDisplay",
    "playPause",
    "scrubber",
    "slider",
  ]
  static values = { fps: Number }

  connect() {
    if (!this.hasFpsValue) this.fpsValue = 30

    this._onRgbUpdate = () => this.updateFromVideo("rgb")
    this._onDepthUpdate = () => this.updateFromVideo("depth")
    this._onMetadata = () => this.updateDurationUI()
    this._isSyncing = false

    if (this.hasRgbTarget) {
      this.rgbTarget.addEventListener("loadedmetadata", this._onMetadata)
      this.rgbTarget.addEventListener("loadeddata", this._onRgbUpdate)
      this.rgbTarget.addEventListener("seeked", this._onRgbUpdate)
      this.rgbTarget.addEventListener("timeupdate", this._onRgbUpdate)
      this.rgbTarget.addEventListener("pause", this._onRgbUpdate)
      this.rgbTarget.addEventListener("play", this._onRgbUpdate)
    }

    if (this.hasDepthTarget) {
      this.depthTarget.addEventListener("loadedmetadata", this._onMetadata)
      this.depthTarget.addEventListener("loadeddata", this._onDepthUpdate)
      this.depthTarget.addEventListener("seeked", this._onDepthUpdate)
      this.depthTarget.addEventListener("timeupdate", this._onDepthUpdate)
      this.depthTarget.addEventListener("pause", this._onDepthUpdate)
      this.depthTarget.addEventListener("play", this._onDepthUpdate)
    }

    this.updateDurationUI()
    this.updateFromVideo()
    this.updatePlayPauseUI()
  }

  disconnect() {
    if (this.hasRgbTarget) {
      this.rgbTarget.removeEventListener("loadedmetadata", this._onMetadata)
      this.rgbTarget.removeEventListener("seeked", this._onRgbUpdate)
      this.rgbTarget.removeEventListener("timeupdate", this._onRgbUpdate)
      this.rgbTarget.removeEventListener("pause", this._onRgbUpdate)
      this.rgbTarget.removeEventListener("play", this._onRgbUpdate)
    }
    if (this.hasDepthTarget) {
      this.depthTarget.removeEventListener("loadedmetadata", this._onMetadata)
      this.depthTarget.removeEventListener("seeked", this._onDepthUpdate)
      this.depthTarget.removeEventListener("timeupdate", this._onDepthUpdate)
      this.depthTarget.removeEventListener("pause", this._onDepthUpdate)
      this.depthTarget.removeEventListener("play", this._onDepthUpdate)
    }
  }

  get master() {
    if (this.hasRgbTarget) return this.rgbTarget
    if (this.hasDepthTarget) return this.depthTarget
    return null
  }

  other(of) {
    if (!of) return null
    if (of === this.rgbTarget && this.hasDepthTarget) return this.depthTarget
    if (of === this.depthTarget && this.hasRgbTarget) return this.rgbTarget
    return null
  }

  updateFromVideo(from = null) {
    const rgb = this.rgbTarget
    const depth = this.depthTarget
    const source = from === "depth" ? depth : (from === "rgb" ? rgb : this.master)
    const currentTime = (rgb?.currentTime) || (source?.currentTime) || 0
    const duration = (rgb?.duration) || (source?.duration) || 1
    const fps = this.hasFpsValue ? this.fpsValue : 30
    const frameIndex = Math.floor(currentTime * fps)

    const ratio = duration > 0 ? (currentTime / duration) : 0
    if (this.hasSliderTarget) {
      this.sliderTarget.value = String(ratio * 100)
    }
    if (this.hasScrubberTarget) {
      this.scrubberTarget.value = String(currentTime)
    }

    if (this.hasTimeDisplayTarget) {
      this.timeDisplayTarget.textContent = `${currentTime.toFixed(2)}s`
    }
    if (this.hasFrameDisplayTarget) {
      this.frameDisplayTarget.textContent = `frame ${frameIndex}`
    }

    if (depth && Math.abs((depth.currentTime || 0) - currentTime) > 0.05) {
      depth.currentTime = currentTime
    }

    const evt = new CustomEvent("frame-changed", {
      detail: { currentTime, frameIndex },
      bubbles: true
    })
    this.element.dispatchEvent(evt)
    document.dispatchEvent(evt)

    this.updatePlayPauseUI()
  }

  updateDurationUI() {
    if (!this.hasScrubberTarget) return
    const durations = []
    if (this.hasRgbTarget && isFinite(this.rgbTarget.duration)) durations.push(this.rgbTarget.duration)
    if (this.hasDepthTarget && isFinite(this.depthTarget.duration)) durations.push(this.depthTarget.duration)
    const max = durations.length ? Math.max(...durations) : 0
    if (max > 0) {
      this.scrubberTarget.max = String(max)
      if (!this.scrubberTarget.hasAttribute("step")) this.scrubberTarget.step = "0.01"
      if (!this.scrubberTarget.hasAttribute("min")) this.scrubberTarget.min = "0"
    } else {
      this.scrubberTarget.removeAttribute("max")
    }
  }

  togglePlay(event) {
    const any = this.master
    if (!any) return
    if (this.isPlaying(any)) {
      this.pauseBoth()
    } else {
      this.playBoth()
    }
    this.updatePlayPauseUI()
  }

  scrub(event) {
    const val = parseFloat(this.scrubberTarget.value)
    const t = isFinite(val) ? val : 0
    this.seekBoth(t)
    this.updateFromVideo()
  }

  seek(event) {
    const any = this.master
    if (!any || !isFinite(any.duration) || any.duration <= 0) return
    const percent = Math.max(0, Math.min(100, parseFloat(this.sliderTarget?.value || "0")))
    const t = any.duration * (percent / 100)
    this.seekBoth(t)
    this.updateFromVideo()
  }

  playBoth() {
    const ops = []
    if (this.hasRgbTarget) ops.push(this.rgbTarget.play().catch(() => {}))
    if (this.hasDepthTarget) ops.push(this.depthTarget.play().catch(() => {}))
    Promise.allSettled(ops)
  }

  pauseBoth() {
    if (this.hasRgbTarget) this.rgbTarget.pause()
    if (this.hasDepthTarget) this.depthTarget.pause()
  }

  seekBoth(t) {
    this._isSyncing = true
    try {
      if (this.hasRgbTarget) this.rgbTarget.currentTime = t
      if (this.hasDepthTarget) this.depthTarget.currentTime = t
    } finally {
      setTimeout(() => { this._isSyncing = false }, 0)
    }
  }

  isPlaying(video) {
    return !!video && !video.paused && !video.ended && video.readyState > 2
  }

  updatePlayPauseUI() {
    if (!this.hasPlayPauseTarget) return
    const any = this.master
    const label = this.isPlaying(any) ? "Pause" : "Play"
    if (this.playPauseTarget.textContent !== label) {
      this.playPauseTarget.textContent = label
    }
  }
}
