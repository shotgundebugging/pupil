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
  static values = { fps: Number, baseWidth: Number, baseHeight: Number, debug: Boolean }

  connect() {
    if (!this.hasFpsValue) this.fpsValue = 30
    if (!this.hasBaseWidthValue) this.baseWidthValue = 848
    if (!this.hasBaseHeightValue) this.baseHeightValue = 480

    this._onRgbUpdate = () => this.updateFromVideo("rgb")
    this._onDepthUpdate = () => this.updateFromVideo("depth")
    this._onMetadata = () => this.updateFromVideo()
    this._isSyncing = false

    if (this.hasRgbTarget) {
      this.log('[connect] rgb present, preload=', this.rgbTarget.preload)
      this.rgbTarget.addEventListener("loadedmetadata", this._onMetadata)
      this.rgbTarget.addEventListener("loadeddata", this._onRgbUpdate)
      this.rgbTarget.addEventListener("seeked", this._onRgbUpdate)
      this.rgbTarget.addEventListener("timeupdate", this._onRgbUpdate)
      // keep displays in sync on time changes
    }

    if (this.hasDepthTarget) {
      this.log('[connect] depth present, preload=', this.depthTarget.preload)
      this.depthTarget.addEventListener("loadedmetadata", this._onMetadata)
      this.depthTarget.addEventListener("loadeddata", this._onDepthUpdate)
      this.depthTarget.addEventListener("seeked", this._onDepthUpdate)
      this.depthTarget.addEventListener("timeupdate", this._onDepthUpdate)
      // keep displays in sync on time changes
    }

    this.updateFromVideo()
    this.log('[connect] initialized; fps=', this.fpsValue)
    // no play/pause UI

    // Delegate clicks on dynamically replaced annotation rows
    this._onAnnotationProxy = (e) => {
      const btn = e.target && e.target.closest && e.target.closest('.annotation-row')
      if (!btn) return
      if (!this.element.contains(btn)) return
      try { console.log('[synced-videos][delegate] click on .annotation-row') } catch {}
      e.preventDefault()
      this.selectAnnotationFromElement(btn)
    }
    document.addEventListener('click', this._onAnnotationProxy)
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
    if (this._onAnnotationProxy) {
      document.removeEventListener('click', this._onAnnotationProxy)
      this._onAnnotationProxy = null
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
    try { console.log('[synced-videos][updateFromVideo]', { from, rgbCT: rgb?.currentTime, depthCT: depth?.currentTime, useCT: currentTime, duration, frameIndex, fps, syncing: this._isSyncing }) } catch {}

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

    if (!this._isSyncing) {
      if (depth && Math.abs((depth.currentTime || 0) - currentTime) > 0.05) {
        depth.currentTime = currentTime
      }
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
  onActivateAnnotation(event) {
    const { x, y, width, height, timeSec, frameIndex, id } = event.detail || {}
    try { console.log('[synced-videos][onActivateAnnotation]', { id, timeSec, frameIndex, x, y, width, height }) } catch {}
    if ([x, y, width, height].some(v => !isFinite(v))) return
    this._selectedBox = { x, y, width, height }
    this.drawSelectedBox()
    this.updateFromVideo()

    let t = null
    if (isFinite(timeSec)) t = timeSec
    else if (isFinite(frameIndex)) {
      const fps = this.hasFpsValue ? this.fpsValue : 30
      t = frameIndex / fps
    }
    if (t != null) this.seekWhenReady(Math.max(0, t))
  }
  selectAnnotation(event) {
    this.selectAnnotationFromElement(event.currentTarget)
  }

  selectAnnotationFromElement(el) {
    const id = el.getAttribute('data-annotation-id')
    const x = parseFloat(el.dataset.x)
    const y = parseFloat(el.dataset.y)
    const width = parseFloat(el.dataset.width)
    const height = parseFloat(el.dataset.height)
    if ([x, y, width, height].some(v => !isFinite(v))) {
      try { console.warn('[synced-videos][selectAnnotation] invalid box data', { x, y, width, height }) } catch {}
      return
    }
    this._selectedBox = { x, y, width, height }
    // Draw overlays immediately
    this.drawSelectedBox()
    this.updateFromVideo()

    // Compute target time from data attributes and seek both videos
    const timeAttr = el.getAttribute('data-time-sec')
    const frameAttr = el.getAttribute('data-frame-index')
    const timeSec = timeAttr != null && timeAttr !== '' ? parseFloat(timeAttr) : NaN
    const frameIndex = frameAttr != null && frameAttr !== '' ? parseInt(frameAttr, 10) : NaN
    let t = null
    if (isFinite(timeSec)) {
      t = timeSec
    } else if (isFinite(frameIndex)) {
      const fps = this.hasFpsValue ? this.fpsValue : 30
      t = frameIndex / fps
    }
    try { console.log('[synced-videos][selectAnnotation] clicked', { id, timeAttr, frameAttr, timeSec, frameIndex, computedT: t }) } catch {}
    if (t != null) {
      this.seekWhenReady(Math.max(0, t))
    } else {
      try { console.warn('[synced-videos][selectAnnotation] no time available for annotation; cannot seek') } catch {}
    }

    // Highlight selected row and remove highlight from others
    try {
      const root = el.closest('#annotations') || document
      root.querySelectorAll('.annotation-row.is-selected').forEach(n => {
        n.classList.remove('is-selected', 'bg-mission-panel', 'ring-1', 'ring-cyan-400/60')
        n.removeAttribute('aria-selected')
      })
      el.classList.add('is-selected', 'bg-mission-panel', 'ring-1', 'ring-cyan-400/60')
      el.setAttribute('aria-selected', 'true')
    } catch {}

    // Ensure the clicked annotation is visible in its scroll container
    try { el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' }) } catch {}
  }

  seekWhenReady(t) {
    const apply = () => {
      let targetTime = t
      const any = this.master
      if (any && isFinite(any.duration) && any.duration > 0) {
        targetTime = Math.max(0, Math.min(t, any.duration - 0.001))
      }
      try { console.log('[synced-videos][seekWhenReady] applying seek', { targetTime }) } catch {}
      this.seekBothAndWait(targetTime)
    }

    const rgbReady = !this.hasRgbTarget || this.rgbTarget.readyState >= 1 // HAVE_METADATA
    const depthReady = !this.hasDepthTarget || this.depthTarget.readyState >= 1

    if (rgbReady && depthReady) {
      try { console.log('[synced-videos][seekWhenReady] metadata ready; seeking now') } catch {}
      apply()
      return
    }
    const onMeta = () => {
      if ((!this.hasRgbTarget || this.rgbTarget.readyState >= 1) && (!this.hasDepthTarget || this.depthTarget.readyState >= 1)) {
        if (this._metaHandlerAttached) {
          this._metaHandlerAttached = false
          if (this.hasRgbTarget) this.rgbTarget.removeEventListener("loadedmetadata", onMeta)
          if (this.hasDepthTarget) this.depthTarget.removeEventListener("loadedmetadata", onMeta)
        }
        try { console.log('[synced-videos][seekWhenReady] metadata arrived; applying seek') } catch {}
        apply()
      }
    }
    this._metaHandlerAttached = true
    try { console.log('[synced-videos][seekWhenReady] waiting for metadata', { rgbReady, depthReady }) } catch {}
    if (this.hasRgbTarget) this.rgbTarget.addEventListener("loadedmetadata", onMeta)
    if (this.hasDepthTarget) this.depthTarget.addEventListener("loadedmetadata", onMeta)
  }

  seekBothAndWait(t) {
    this._isSyncing = true
    const targets = [this.hasRgbTarget ? this.rgbTarget : null, this.hasDepthTarget ? this.depthTarget : null].filter(Boolean)
    let remaining = targets.length
    const done = () => {
      if (--remaining <= 0) {
        this._isSyncing = false
        try { console.log('[synced-videos][seekBothAndWait] seeked on all videos; updating UI') } catch {}
        this.updateFromVideo()
        this.drawSelectedBox()
      }
    }
    const timeout = setTimeout(() => {
      this._isSyncing = false
      try { console.warn('[synced-videos][seekBothAndWait] seek timeout; updating UI anyway') } catch {}
      this.updateFromVideo()
      this.drawSelectedBox()
    }, 1000)

    targets.forEach(video => {
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked)
        done()
      }
      video.addEventListener('seeked', onSeeked, { once: true })
      try { video.pause() } catch (e) { try { console.warn('[synced-videos][seekBothAndWait] pause failed', e) } catch {} }
      try {
        try { console.log('[synced-videos][seekBothAndWait] setting currentTime', { t, readyState: video.readyState, duration: video.duration }) } catch {}
        video.currentTime = t
      } catch (e) {
        try { console.error('[synced-videos][seekBothAndWait] failed to set currentTime', e) } catch {}
      }
      // Temporary diagnostic listeners (auto-removed after one trigger)
      const onSeeking = () => { try { console.log('[synced-videos] seeking event', { currentTime: video.currentTime }) } catch {} video.removeEventListener('seeking', onSeeking) }
      const onTimeUpdate = () => { try { console.log('[synced-videos] timeupdate event', { currentTime: video.currentTime }) } catch {} video.removeEventListener('timeupdate', onTimeUpdate) }
      video.addEventListener('seeking', onSeeking)
      video.addEventListener('timeupdate', onTimeUpdate)
    })
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

  // Debug helpers
  log(...args) { if (this.hasDebugValue ? this.debugValue : true) { try { console.log('[synced-videos]', ...args) } catch {} } }
  warn(...args) { if (this.hasDebugValue ? this.debugValue : true) { try { console.warn('[synced-videos]', ...args) } catch {} } }
  error(...args) { if (this.hasDebugValue ? this.debugValue : true) { try { console.error('[synced-videos]', ...args) } catch {} } }
}
