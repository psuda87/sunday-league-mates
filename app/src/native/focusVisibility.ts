import { Capacitor } from '@capacitor/core';

// Keep the focused field visible inside Ionic's real scroll container.
// Native Android already resizes the WebView; mobile browsers may only shrink
// visualViewport while leaving the layout viewport (and ion-content) unchanged.
export function installFocusVisibility(native = Capacitor.isNativePlatform()) {
  let frame = 0;
  let alive = true;
  let padded: HTMLElement | null = null;
  let originalPadding = '';

  function clearPadding() {
    if (padded) padded.style.paddingBottom = originalPadding;
    padded = null;
    originalPadding = '';
  }

  async function reveal() {
    const field = document.activeElement;
    if (!(field instanceof HTMLElement) || !field.matches('input:not([type=file]),textarea,select,[contenteditable=true]')) {
      clearPadding();
      return;
    }
    const content = field.closest('ion-content');
    const scroller: HTMLElement | undefined = await content?.getScrollElement?.();
    if (!alive || document.activeElement !== field || !scroller) return;

    const viewport = window.visualViewport;
    const viewportTop = viewport?.offsetTop ?? 0;
    const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);

    if (!native) {
      // Chrome Android can keep the Ionic scroll host at layout-viewport height
      // when the on-screen keyboard overlays its bottom portion.
      const covered = Math.max(0, scroller.getBoundingClientRect().bottom - viewportBottom);
      const inset = covered > 120 ? Math.ceil(covered + 24) : 0;
      if (padded !== scroller) {
        clearPadding();
        padded = scroller;
        originalPadding = scroller.style.paddingBottom;
      }
      scroller.style.paddingBottom = inset ? `${inset}px` : originalPadding;
    }

    const rect = field.getBoundingClientRect();
    const bounds = scroller.getBoundingClientRect();
    const top = Math.max(bounds.top, viewportTop) + 16;
    const bottom = Math.min(bounds.bottom, viewportBottom) - 16;
    const delta = rect.bottom > bottom ? rect.bottom - bottom : rect.top < top ? rect.top - top : 0;
    if (delta) scroller.scrollTop += delta;
  }

  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => { void reveal(); });
  };
  const onFocusOut = () => {
    // A subsequent focusin will schedule its own reveal; otherwise restore
    // the original scroll geometry after the keyboard closes.
    schedule();
  };

  document.addEventListener('focusin', schedule);
  document.addEventListener('focusout', onFocusOut);
  window.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('scroll', schedule);

  return () => {
    alive = false;
    cancelAnimationFrame(frame);
    document.removeEventListener('focusin', schedule);
    document.removeEventListener('focusout', onFocusOut);
    window.removeEventListener('resize', schedule);
    window.visualViewport?.removeEventListener('resize', schedule);
    window.visualViewport?.removeEventListener('scroll', schedule);
    clearPadding();
  };
}
