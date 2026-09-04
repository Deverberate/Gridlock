/**
 * Camera controls: ties keyboard + mouse input to Camera movement.
 */

const PAN_SPEED = 600; // pixels/sec

export class CameraControls {
  constructor(camera, keyboard, mouse) {
    this.camera = camera;
    this.keyboard = keyboard;
    this.mouse = mouse;
  }

  update(dt) {
    const { camera, keyboard, mouse } = this;

    // WASD/arrow key panning
    const dir = keyboard.getMovementDir();
    if (dir.dx !== 0 || dir.dy !== 0) {
      const px = dir.dx * PAN_SPEED * dt;
      const py = dir.dy * PAN_SPEED * dt;
      camera.pan(px, py);
    }

    // Right-drag panning (middle-click is the eyedropper)
    if (mouse.isRight()) {
      const pan = mouse.getPanDelta();
      if (pan.dx !== 0 || pan.dy !== 0) {
        camera.pan(pan.dx, pan.dy);
      }
    }

    // Mouse wheel zoom
    const wheel = mouse.consumeWheel();
    if (wheel !== 0) {
      const factor = wheel > 0 ? 1.15 : 1 / 1.15;
      camera.zoomAt(mouse.x, mouse.y, factor);
    }
  }
}
