import { Controller } from "@hotwired/stimulus"

// Minimal rectangle drawing + save
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

    // Initial paint
    this.redraw()
  }

  disconnect() {
    this.canvasTarget.removeEventListener("mousedown", this._onMouseDown)
    this.canvasTarget.removeEventListener("mousemove", this._onMouseMove)
    this.canvasTarget.removeEventListener("mouseup", this._onMouseUp)
    this.canvasTarget.removeEventListener("mouseleave", this._onMouseUp)
  }

  // Optional: capture frame/time if emitted by synced-videos
  onFrameChanged(event) {
    this.currentFrameIndex = event.detail.frameIndex || 0
    this.currentTimeSec = event.detail.currentTime || 0
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
    this.currentBox = { x: this.startX, y: this.startY, width: x - this.startX, height: y - this.startY }
    this.redraw()
  }

  onMouseUp(_event) {
    if (!this.isDrawing) return
    this.isDrawing = false
    this.updateInfo()
  }

  clearCanvas() {
    const c = this.canvasTarget
    this.ctx.fillStyle = getComputedStyle(c).backgroundColor || "#000"
    this.ctx.clearRect(0, 0, c.width, c.height)
    // Give a subtle background
    this.ctx.fillStyle = "rgba(5,8,20,1)"
    this.ctx.fillRect(0, 0, c.width, c.height)
  }

  drawBox() {
    if (!this.currentBox) return
    let { x, y, width, height } = this.currentBox
    if (width < 0) { x += width; width = Math.abs(width) }
    if (height < 0) { y += height; height = Math.abs(height) }
    this.ctx.strokeStyle = "#22d3ee"
    this.ctx.lineWidth = 2
    this.ctx.strokeRect(x, y, width, height)
  }

  redraw() {
    this.clearCanvas()
    this.drawBox()
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
        frame_index: this.currentFrameIndex || 0,
        time_sec: this.currentTimeSec || 0,
        stream: "rgb",
        label: this.hasLabelSelectTarget ? this.labelSelectTarget.value : "",
        x, y, width, height,
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
