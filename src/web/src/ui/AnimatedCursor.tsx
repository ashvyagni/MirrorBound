import { useEffect } from 'react';

import './cursor.css';

const SHEETS = ['/game/cursor/hornbound.png', '/game/cursor/grab.png'];
const SCALE = 40 / 48;

/** One pointer for the page and canvas, also inside the fullscreen top layer. */
export function AnimatedCursor() {
  useEffect(() => {
    const fine = window.matchMedia('(any-pointer: fine)');
    const cursor = document.createElement('div');
    cursor.className = 'game-cursor';
    cursor.setAttribute('aria-hidden', 'true');
    cursor.innerHTML = '<span class="game-cursor__art"></span>';
    let loaded = false;
    let disposed = false;
    let lastPointer: PointerEvent | null = null;
    let canvas: HTMLCanvasElement | null = null;

    const hide = () => {
      cursor.hidden = true;
      cursor.dataset.pressed = 'false';
      lastPointer = null;
      document.documentElement.classList.remove('has-game-cursor');
    };
    const mount = () => {
      (document.fullscreenElement ?? document.body).appendChild(cursor);
      hide();
    };
    const move = (event: PointerEvent) => {
      if (!loaded || !fine.matches || event.pointerType !== 'mouse' || document.pointerLockElement) {
        hide();
        return;
      }
      const target = event.target instanceof Element ? event.target : null;
      // Preserve text-selection and native form cursors where they are useful.
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) {
        hide();
        return;
      }
      lastPointer = event;
      const hoveredCanvas = target instanceof HTMLCanvasElement ? target : null;
      if (hoveredCanvas !== canvas) {
        observer.disconnect();
        canvas = hoveredCanvas;
        if (canvas) observer.observe(canvas, { attributes: true, attributeFilter: ['style'] });
      }
      const interactive = Boolean(target?.closest('button:not(:disabled), a, [role="button"]'))
        || canvas?.style.cursor === 'pointer' || canvas?.style.cursor === 'grab';
      const grab = interactive || cursor.dataset.pressed === 'true';
      cursor.dataset.variant = grab ? 'grab' : 'pointer';
      cursor.dataset.interactive = String(interactive);
      cursor.style.transform = `translate3d(${event.clientX - (grab ? 8 : 4) * SCALE}px, ${event.clientY - 3 * SCALE}px, 0)`;
      cursor.hidden = false;
      document.documentElement.classList.add('has-game-cursor');
    };
    const down = (event: PointerEvent) => {
      if (event.button === 0) cursor.dataset.pressed = 'true';
      move(event);
    };
    const up = (event: PointerEvent) => { cursor.dataset.pressed = 'false'; move(event); };
    const leave = (event: PointerEvent) => { if (!event.relatedTarget) hide(); };
    const visibility = () => { if (document.hidden) hide(); };

    // Phaser updates its canvas cursor during the engine tick, after the DOM
    // pointer event. Observe that one style change so hover feedback is immediate.
    const observer = new MutationObserver(() => { if (lastPointer) move(lastPointer); });
    mount();
    let ready = 0;
    const images = SHEETS.map((src) => {
      const image = new Image();
      image.onload = () => { if (!disposed && ++ready === SHEETS.length) loaded = true; };
      image.src = src;
      return image;
    });
    document.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerdown', down, { passive: true });
    document.addEventListener('pointerup', up, { passive: true });
    document.addEventListener('pointercancel', hide);
    document.addEventListener('pointerout', leave);
    document.addEventListener('fullscreenchange', mount);
    document.addEventListener('visibilitychange', visibility);
    document.addEventListener('pointerlockchange', hide);
    window.addEventListener('blur', hide);
    fine.addEventListener('change', hide);
    return () => {
      disposed = true;
      for (const image of images) image.onload = null;
      observer.disconnect();
      hide();
      cursor.remove();
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', hide);
      document.removeEventListener('pointerout', leave);
      document.removeEventListener('fullscreenchange', mount);
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('pointerlockchange', hide);
      window.removeEventListener('blur', hide);
      fine.removeEventListener('change', hide);
    };
  }, []);
  return null;
}
