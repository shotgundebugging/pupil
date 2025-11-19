import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = [
    "rgb",
    "depth",
    "timeDisplay",
    "frameDisplay",
    "playPause",
    "scrubber",
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
      this.rgbTarget.addEventListener("seeked", this._onRgbUpdate)
      this.rgbTarget.addEventListener("timeupdate", this._onRgbUpdate)
      this.rgbTarget.addEventListener("pause", this._onRgbUpdate)
      this.rgbTarget.addEventListener("play", this._onRgbUpdate)
    }

    if (this.hasDepthTarget) {
      this.depthTarget.addEventListener("loadedmetadata", this._onMetadata)
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
    const source = from === "depth" ? this.depthTarget : (from === "rgb" ? this.rgbTarget : this.master)
    const currentTime = (source?.currentTime) || 0
    const fps = this.hasFpsValue ? this.fpsValue : 30
    const frameIndex = Math.floor(currentTime * fps)

    if (this.hasTimeDisplayTarget) {
      this.timeDisplayTarget.textContent = `${currentTime.toFixed(2)}s`
    }

    if (this.hasFrameDisplayTarget) {
      this.frameDisplayTarget.textContent = `frame ${frameIndex}`
    }

    if (this.hasScrubberTarget) {
      this.scrubberTarget.value = String(currentTime)
    }

    const counterpart = this.other(source)
    if (counterpart) {
      const delta = Math.abs((counterpart.currentTime || 0) - currentTime)
      if (!this._isSyncing && (delta > 0.034)) {
        this._isSyncing = true
        try {
          counterpart.currentTime = currentTime
        } finally {
          setTimeout(() => { this._isSyncing = false }, 0)
        }
      }
    }

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
