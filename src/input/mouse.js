/**
 * Mouse input handler.
 * Tracks position, button state, wheel delta for camera and building.
 */

export class Mouse {
  constructor(canvas) {
    this.canvas = canvas;
    this.x = 0;
    this.y = 0;
    this.buttons = 0;
    this.wheelDelta = 0;
    this._panStart = null;
    this._isPanning = false;

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.x = e.clientX - rect.left;
      this.y = e.clientY - rect.top;

      // Pan drag
      if (this._isPanning && this._panStart) {
        this._panDeltaX = this.x - this._panStart.x;
        this._panDeltaY = this.y - this._panStart.y;
        this._panStart = { x: this.x, y: this.y };
      }
    });

    canvas.addEventListener('mousedown', (e) => {
      this.buttons |= (1 << e.button);

      // Middle-click or right-click starts pan
      if (e.button === 1 || e.button === 2) {
        this._isPanning = true;
        this._panStart = { x: this.x, y: this.y };
        this._panDeltaX = 0;
        this._panDeltaY = 0;
        e.preventDefault();
      }
    });

    canvas.addEventListener('mouseup', (e) => {
      this.buttons &= ~(1 << e.button);

      if ((e.button === 1 || e.button === 2) && this._isPanning) {
        this._isPanning = false;
        this._panStart = null;
      }
    });

    canvas.addEventListener('wheel', (e) => {
      this.wheelDelta += e.deltaY > 0 ? -1 : 1;
      e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this._panDeltaX = 0;
    this._panDeltaY = 0;
  }

  isDown(button) {
    return (this.buttons & (1 << button)) !== 0;
  }

  isLeft()  { return this.isDown(0); }
  isMiddle(){ return this.isDown(1); }
  isRight(){ return this.isDown(2); }

  /** Get pan delta since last call (in pixels). Resets each call. */
  getPanDelta() {
    const dx = this._panDeltaX;
    const dy = this._panDeltaY;
    this._panDeltaX = 0;
    this._panDeltaY = 0;
    return { dx, dy };
  }

  /** Get accumulated wheel delta. Resets after read. */
  consumeWheel() {
    const d = this.wheelDelta;
    this.wheelDelta = 0;
    return d;
  }
}
