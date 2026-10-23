import { render, screen } from '@testing-library/react';
import { Input } from './Input';

describe('Input', () => {
  it('labels the field', () => {
    render(<Input label="Mobile Number" name="mobile" />);

    expect(screen.getByLabelText('Mobile Number')).toBeTruthy();
  });

  it('links the error to the field so a screen reader reads it with the field', () => {
    render(<Input label="PAN" name="pan" error="Enter a valid PAN" />);

    const field = screen.getByLabelText('PAN');
    const message = screen.getByRole('alert');

    expect(message.textContent).toBe('Enter a valid PAN');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(field.getAttribute('aria-describedby')).toBe(message.id);
  });

  it('has no alert or description while the field is valid', () => {
    render(<Input label="PAN" name="pan" />);

    const field = screen.getByLabelText('PAN');

    expect(screen.queryByRole('alert')).toBeNull();
    expect(field.getAttribute('aria-describedby')).toBeNull();
    expect(field.getAttribute('aria-invalid')).toBe('false');
  });

  it('keeps a description the caller passed in while valid', () => {
    render(<Input label="PAN" name="pan" aria-describedby="hint" />);

    expect(screen.getByLabelText('PAN').getAttribute('aria-describedby')).toBe(
      'hint',
    );
  });
});
