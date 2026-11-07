import { afterEach, expect, it, vi } from 'vitest';
import { installFocusVisibility } from './focusVisibility';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function fixture(bottom: number, fieldTop: number, fieldBottom: number) {
  const content = document.createElement('ion-content');
  const field = document.createElement('input');
  const scroll = document.createElement('div');
  content.append(field);
  document.body.append(content);
  content.getScrollElement = async () => scroll;
  vi.spyOn(scroll, 'getBoundingClientRect').mockReturnValue({ top: 0, bottom } as DOMRect);
  vi.spyOn(field, 'getBoundingClientRect').mockReturnValue({ top: fieldTop, bottom: fieldBottom } as DOMRect);
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(fn => { fn(0); return 1; });
  return { field, scroll };
}

it('scrolls a native focused Ionic field without adding padding', async () => {
  const { field, scroll } = fixture(400, 600, 650);
  const stop = installFocusVisibility(true);
  field.focus();
  await Promise.resolve();
  expect(scroll.scrollTop).toBe(266);
  expect(scroll.style.paddingBottom).toBe('');
  stop();
});

it('adds temporary scroll space for a keyboard overlay in mobile Chrome', async () => {
  const { field, scroll } = fixture(800, 600, 650);
  scroll.style.paddingBottom = '12px';
  const previousViewport = window.visualViewport;
  const viewport = new EventTarget() as VisualViewport;
  Object.defineProperties(viewport, {
    height: { value: 500, configurable: true },
    offsetTop: { value: 0, configurable: true },
  });
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
  try {
    const stop = installFocusVisibility(false);
    field.focus();
    await Promise.resolve();
    expect(scroll.style.paddingBottom).toBe('324px');
    expect(scroll.scrollTop).toBe(166);
    stop();
    expect(scroll.style.paddingBottom).toBe('12px');
  } finally {
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: previousViewport });
  }
});

it('restores scroll padding when a web input loses focus', async () => {
  const { field, scroll } = fixture(800, 600, 650);
  const previousViewport = window.visualViewport;
  const viewport = new EventTarget() as VisualViewport;
  Object.defineProperties(viewport, {
    height: { value: 500, configurable: true },
    offsetTop: { value: 0, configurable: true },
  });
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
  try {
    const stop = installFocusVisibility(false);
    field.focus();
    await Promise.resolve();
    expect(scroll.style.paddingBottom).toBe('324px');
    field.blur();
    await Promise.resolve();
    expect(scroll.style.paddingBottom).toBe('');
    stop();
  } finally {
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: previousViewport });
  }
});

it('never scrolls a file picker or changes its value on viewport resize', () => {
  const field = document.createElement('input');
  field.type = 'file';
  document.body.append(field);
  const stop = installFocusVisibility(true);
  field.focus();
  window.dispatchEvent(new Event('resize'));
  expect(field.value).toBe('');
  stop();
});
