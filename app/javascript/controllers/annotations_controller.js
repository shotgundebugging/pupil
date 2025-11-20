import { Controller } from "@hotwired/stimulus"

// Handles drawing a rectangle and saving it as an annotation
export default class extends Controller {
  static targets = ["canvas", "labelSelect", "info"]
  static values = { createUrl: String }

  connect() {
    this.ctx = this.canvasTarget.getContext("2d")
    this.isDrawing = false
    this.currentBox = null
    this.currentFrameIndex = 0
    this.currentTimeSec = 0

    this._onMouseDown = this.onMouseDown.bind(this)
    this._onMouseMove = this.onMouseMove.bind(this)
    this._onMouseUp = this.onMouseUp.bind(this)

    this.canvasTarget.addEventListener("mousedown", this._onMouseDown)
    this.canvasTarget.addEventListener("mousemove", this._onMouseMove)
    this.canvasTarget.addEventListener("mouseup", this._onMouseUp)
    this.canvasTarget.addEventListener("mouseleave", this._onMouseUp)

    const container = this.element.closest('[data-controller~="synced-videos"]')
    this.rgbVideo = container?.querySelector('[data-synced-videos-target="rgb"]') || null

    // Try to draw immediately if the video is ready; otherwise wait
    if (this.rgbVideo && this.rgbVideo.readyState > 2) {
      this.drawBackground()
    } else if (this.rgbVideo) {
      this._onLoadedData = () => { this.drawBackground() }
      this.rgbVideo.addEventListener("loadeddata", this._onLoadedData, { once: true })
      this.rgbVideo.addEventListener("timeupdate", this._onLoadedData, { once: true })
      this.rgbVideo.addEventListener("seeked", this._onLoadedData, { once: true })
    }
    requestAnimationFrame(() => this.drawBackground())
  }

  disconnect() {
    this.canvasTarget.removeEventListener("mousedown", this._onMouseDown)
    this.canvasTarget.removeEventListener("mousemove", this._onMouseMove)
    this.canvasTarget.removeEventListener("mouseup", this._onMouseUp)
    this.canvasTarget.removeEventListener("mouseleave", this._onMouseUp)
  }

  onFrameChanged(event) {
    this.currentFrameIndex = event.detail.frameIndex
    this.currentTimeSec = event.detail.currentTime
    this.drawBackground()
    this.overlayBox()
  }

  onMouseDown(event) {
    const rect = this.canvasTarget.getBoundingClientRect()
    this.isDrawing = true
    this.startX = event.clientX - rect.left
    this.startY = event.clientY - rect.top
    this.currentBox = { x: this.startX, y: this.startY, width: 0, height: 0 }
  }

  onMouseMove(event) {
    if (!this.isDrawing) return

    const rect = this.canvasTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    const width = x - this.startX
    const height = y - this.startY

    this.currentBox = { x: this.startX, y: this.startY, width, height }
    this.redraw()
  }

  onMouseUp(_event) {
    if (!this.isDrawing) return
    this.isDrawing = false
    this.updateInfo()
  }

  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvasTarget.width, this.canvasTarget.height)
  }

  drawBackground() {
    this.clearCanvas()
    if (this.rgbVideo && this.rgbVideo.readyState > 2) {
      const c = this.canvasTarget
      this.ctx.drawImage(this.rgbVideo, 0, 0, c.width, c.height)
    }
  }

  overlayBox() {
    if (this.currentBox) {
      let { x, y, width, height } = this.currentBox
      if (width < 0) { x += width; width = Math.abs(width) }
      if (height < 0) { y += height; height = Math.abs(height) }
      this.ctx.strokeStyle = "red"
      this.ctx.lineWidth = 2
      this.ctx.strokeRect(x, y, width, height)
    }
  }

  redraw() {
    this.drawBackground()
    this.overlayBox()
    this.updateInfo()
  }

  updateInfo() {
    if (!this.hasInfoTarget) return
    if (!this.currentBox) {
      this.infoTarget.textContent = "x: –, y: –, w: –, h: –"
      return
    }
    const { x, y, width, height } = this.normalizedCurrentBox()
    this.infoTarget.textContent = `x: ${x}, y: ${y}, w: ${width}, h: ${height}`
  }

  normalizedCurrentBox() {
    if (!this.currentBox) return null
    let { x, y, width, height } = this.currentBox
    if (width < 0) { x += width; width = Math.abs(width) }
    if (height < 0) { y += height; height = Math.abs(height) }
    return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) }
  }

  clearAnnotation() {
    this.currentBox = null
    this.redraw()
  }

  async saveCurrentAnnotation() {
    const norm = this.normalizedCurrentBox()
    if (!norm) return
    const { x, y, width, height } = norm
    if (width === 0 || height === 0) return

    const payload = {
      annotation: {
        frame_index: this.currentFrameIndex,
        time_sec: this.currentTimeSec,
        stream: "rgb",
        label: this.labelSelectTarget.value,
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height)
      }
    }

    const token = document.querySelector('meta[name="csrf-token"]')?.content
    const response = await fetch(this.createUrlValue, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "text/vnd.turbo-stream.html",
        ...(token ? { "X-CSRF-Token": token } : {})
      },
      body: JSON.stringify(payload)
    })
    if (response.ok) {
      const html = await response.text()
      if (window.Turbo && typeof Turbo.renderStreamMessage === "function") {
        Turbo.renderStreamMessage(html)
      }
      this.clearAnnotation()
    }
  }
}
