import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = [
    "rgb",
    "depth",
    "timeDisplay",
    "frameDisplay",
    "slider",
    "rgbOverlay",
    "depthOverlay",
  ]
  static values = { fps: Number, baseWidth: Number, baseHeight: Number }

  connect() {
    if (!this.hasFpsValue) this.fpsValue = 30
    if (!this.hasBaseWidthValue) this.baseWidthValue = 848
    if (!this.hasBaseHeightValue) this.baseHeightValue = 480

    this._onRgbUpdate = () => this.updateFromVideo("rgb")
    this._onDepthUpdate = () => this.updateFromVideo("depth")
    this._onMetadata = () => this.updateFromVideo()
    this._isSyncing = false

    if (this.hasRgbTarget) {
      this.rgbTarget.addEventListener("loadedmetadata", this._onMetadata)
      this.rgbTarget.addEventListener("loadeddata", this._onRgbUpdate)
      this.rgbTarget.addEventListener("seeked", this._onRgbUpdate)
      this.rgbTarget.addEventListener("timeupdate", this._onRgbUpdate)
      // keep displays in sync on time changes
    }

    if (this.hasDepthTarget) {
      this.depthTarget.addEventListener("loadedmetadata", this._onMetadata)
      this.depthTarget.addEventListener("loadeddata", this._onDepthUpdate)
      this.depthTarget.addEventListener("seeked", this._onDepthUpdate)
      this.depthTarget.addEventListener("timeupdate", this._onDepthUpdate)
      // keep displays in sync on time changes
    }

    this.updateFromVideo()
    // no play/pause UI
  }

  disconnect() {
    if (this.hasRgbTarget) {
      this.rgbTarget.removeEventListener("loadedmetadata", this._onMetadata)
      this.rgbTarget.removeEventListener("seeked", this._onRgbUpdate)
      this.rgbTarget.removeEventListener("timeupdate", this._onRgbUpdate)
      
    }
    if (this.hasDepthTarget) {
      this.depthTarget.removeEventListener("loadedmetadata", this._onMetadata)
      this.depthTarget.removeEventListener("seeked", this._onDepthUpdate)
      this.depthTarget.removeEventListener("timeupdate", this._onDepthUpdate)
      
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
    

    if (this.hasTimeDisplayTarget) {
      this.timeDisplayTarget.textContent = `${currentTime.toFixed(2)}s`
    }
    if (this.hasFrameDisplayTarget) {
      this.frameDisplayTarget.textContent = `frame ${frameIndex}`
    }

    if (depth && Math.abs((depth.currentTime || 0) - currentTime) > 0.05) {
      depth.currentTime = currentTime
    }

    // Repaint overlays if a selection exists
    this.drawSelectedBox()

    const evt = new CustomEvent("frame-changed", {
      detail: { currentTime, frameIndex },
      bubbles: true
    })
    this.element.dispatchEvent(evt)
    document.dispatchEvent(evt)

    // no play/pause UI
  }

  

  

  

  seek(event) {
    const any = this.master
    if (!any || !isFinite(any.duration) || any.duration <= 0) return
    const percent = Math.max(0, Math.min(100, parseFloat(this.sliderTarget?.value || "0")))
    const t = any.duration * (percent / 100)
    // Clear any selected annotation overlay when seeking
    this.clearSelectedAnnotation()
    this.seekBoth(t)
    this.updateFromVideo()
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


  // Annotation overlay handling
  selectAnnotation(event) {
    const el = event.currentTarget
    const x = parseFloat(el.dataset.x)
    const y = parseFloat(el.dataset.y)
    const width = parseFloat(el.dataset.width)
    const height = parseFloat(el.dataset.height)
    if ([x, y, width, height].some(v => !isFinite(v))) return
    this._selectedBox = { x, y, width, height }
    this.drawSelectedBox()
  }

  drawSelectedBox() {
    if (!this._selectedBox) {
      this.clearOverlay(this.rgbOverlayTarget)
      this.clearOverlay(this.depthOverlayTarget)
      return
    }
    if (this.hasRgbOverlayTarget) this.drawBoxOnOverlay(this.rgbOverlayTarget, this._selectedBox, "rgba(255,0,0,0.0)", "2px solid red")
    if (this.hasDepthOverlayTarget) this.drawBoxOnOverlay(this.depthOverlayTarget, this._selectedBox, "rgba(0,0,255,0.0)", "2px solid #00d")
  }

  clearOverlay(overlay) {
    if (!overlay) return
    overlay.innerHTML = ""
  }

  drawBoxOnOverlay(overlay, box, fill, stroke) {
    if (!overlay) return
    overlay.innerHTML = ""
    const scaleX = overlay.clientWidth / this.baseWidthValue
    const scaleY = overlay.clientHeight / this.baseHeightValue
    const rect = document.createElement("div")
    rect.style.position = "absolute"
    rect.style.left = `${Math.round(box.x * scaleX)}px`
    rect.style.top = `${Math.round(box.y * scaleY)}px`
    rect.style.width = `${Math.round(box.width * scaleX)}px`
    rect.style.height = `${Math.round(box.height * scaleY)}px`
    rect.style.border = stroke
    rect.style.background = fill
    overlay.appendChild(rect)
  }

  clearSelectedAnnotation() {
    if (!this._selectedBox) return
    this._selectedBox = null
    this.drawSelectedBox()
  }
}
