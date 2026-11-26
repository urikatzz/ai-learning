(() => {
  'use strict';
  // Click-or-drag painting. The first pixel touched decides whether the stroke paints or erases.
  class PixelPainter {
    constructor(grid, { canPaint, read, paint }) {
      this._grid = grid;
      this._canPaint = canPaint;
      this._read = read;
      this._paint = paint;
      this._stroke = null;
      grid.addEventListener('pointerdown', event => this._start(event));
      // Hit-testing by position also works for touch, which keeps events on the first element.
      window.addEventListener('pointermove', event => this._move(event));
      ['pointerup', 'pointercancel', 'blur'].forEach(type => window.addEventListener(type, () => { this._stroke = null; }));
      // Keyboard activation reports detail 0; pointer clicks are already handled on pointerdown.
      grid.addEventListener('click', event => { if (event.detail === 0) this._toggle(this._indexOf(event.target)); });
    }
    _indexOf(element) {
      const cell = element?.closest('[data-index]');
      return cell && this._grid.contains(cell) ? Number(cell.dataset.index) : null;
    }
    _toggle(index) {
      if (index === null || !this._canPaint()) return null;
      const value = 1 - this._read(index);
      this._paint(index, value);
      return value;
    }
    _start(event) {
      if (event.button !== 0) return;
      this._stroke = this._toggle(this._indexOf(event.target));
    }
    _move(event) {
      if (this._stroke === null || !this._canPaint()) return;
      const index = this._indexOf(document.elementFromPoint(event.clientX, event.clientY));
      if (index !== null && this._read(index) !== this._stroke) this._paint(index, this._stroke);
    }
  }
  window.PixelPainter = PixelPainter;
})();
