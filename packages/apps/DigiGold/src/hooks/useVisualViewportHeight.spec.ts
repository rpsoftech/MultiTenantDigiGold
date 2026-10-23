import { act, renderHook } from '@testing-library/react';
import { useVisualViewportHeight } from './useVisualViewportHeight';

type FakeViewport = {
  height: number;
  addEventListener: jest.Mock;
  removeEventListener: jest.Mock;
};

function installViewport(height: number): FakeViewport {
  const viewport: FakeViewport = {
    height,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: viewport,
  });
  return viewport;
}

afterEach(() => {
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: undefined,
  });
});

describe('useVisualViewportHeight', () => {
  it('returns null when the Visual Viewport API is unavailable', () => {
    const { result } = renderHook(() => useVisualViewportHeight());
    expect(result.current).toBeNull();
  });

  it('returns the visible height and follows keyboard resizes', () => {
    const viewport = installViewport(800);
    const { result } = renderHook(() => useVisualViewportHeight());
    expect(result.current).toBe(800);

    viewport.height = 420.4;
    const onResize = viewport.addEventListener.mock.calls[0][1] as () => void;
    act(() => onResize());
    expect(result.current).toBe(420);
  });

  it('does not listen while disabled and cleans up on unmount', () => {
    const viewport = installViewport(800);
    const disabled = renderHook(() => useVisualViewportHeight(false));
    expect(disabled.result.current).toBeNull();
    expect(viewport.addEventListener).not.toHaveBeenCalled();

    const enabled = renderHook(() => useVisualViewportHeight(true));
    enabled.unmount();
    expect(viewport.removeEventListener).toHaveBeenCalledWith(
      'resize',
      expect.any(Function),
    );
  });
});
