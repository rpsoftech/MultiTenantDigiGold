import { render, screen } from '@testing-library/react';
import { Modal } from './Modal';

function mockViewport(height: number) {
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: {
      height,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
  });
}

afterEach(() => {
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: undefined,
  });
});

describe('Modal', () => {
  it('limits the phone bottom sheet to the visible height so actions clear the keyboard', () => {
    mockViewport(410);
    render(
      <Modal open onOpenChange={jest.fn()} title="Confirm">
        <button type="button">Go</button>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.style.getPropertyValue('--modal-visible-height')).toBe(
      '410px',
    );
  });

  it('sets no height limit when the dialog is closed', () => {
    mockViewport(410);
    render(
      <Modal open={false} onOpenChange={jest.fn()} title="Confirm">
        <p>body</p>
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
