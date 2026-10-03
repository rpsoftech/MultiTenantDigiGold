import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { OtpInputCells } from './OtpInputCells';

function Harness({ onSubmit, error }: { onSubmit?: () => void; error?: boolean }) {
  const [value, setValue] = useState('');
  return (
    <>
      <OtpInputCells value={value} onChange={setValue} onSubmit={onSubmit} error={error} />
      <output data-testid="value">{value}</output>
    </>
  );
}

const cell = (index: number) => screen.getByLabelText(`Digit ${index}`) as HTMLInputElement;
const value = () => screen.getByTestId('value').textContent;

describe('OtpInputCells', () => {
  it('renders six cells by default and a configurable number', () => {
    const { unmount } = render(<Harness />);
    expect(screen.getAllByLabelText(/^Digit \d$/)).toHaveLength(6);
    unmount();

    render(<OtpInputCells length={4} value="" onChange={() => undefined} />);
    expect(screen.getAllByLabelText(/^Digit \d$/)).toHaveLength(4);
  });

  it('shows the digits of the current value', () => {
    render(<OtpInputCells value="123" onChange={() => undefined} />);

    expect([1, 2, 3, 4].map((i) => cell(i).value)).toEqual(['1', '2', '3', '']);
  });

  it('accepts digits and moves focus to the next cell', () => {
    render(<Harness />);

    fireEvent.change(cell(1), { target: { value: '4' } });

    expect(value()).toBe('4');
    expect(document.activeElement).toBe(cell(2));
  });

  it('ignores anything that is not a digit', () => {
    render(<Harness />);

    fireEvent.change(cell(1), { target: { value: 'a' } });

    expect(value()).toBe('');
  });

  it('keeps only the latest character typed into a cell', () => {
    render(<Harness />);
    fireEvent.change(cell(1), { target: { value: '1' } });

    fireEvent.change(cell(1), { target: { value: '19' } });

    expect(value()).toBe('9');
  });

  it('moves back on Backspace from an empty cell', () => {
    render(<Harness />);
    fireEvent.change(cell(1), { target: { value: '1' } });
    cell(2).focus();

    fireEvent.keyDown(cell(2), { key: 'Backspace' });

    expect(document.activeElement).toBe(cell(1));
  });

  it('does not move back from the first cell', () => {
    render(<Harness />);
    cell(1).focus();

    fireEvent.keyDown(cell(1), { key: 'Backspace' });

    expect(document.activeElement).toBe(cell(1));
  });

  it('fills every cell from a pasted code, stripping non-digits', () => {
    render(<Harness />);

    fireEvent.paste(cell(1), { clipboardData: { getData: () => '12-34 56' } });

    expect(value()).toBe('123456');
    expect(document.activeElement).toBe(cell(6));
  });

  it('trims a pasted code that is too long', () => {
    render(<Harness />);

    fireEvent.paste(cell(1), { clipboardData: { getData: () => '1234567890' } });

    expect(value()).toBe('123456');
  });

  it('ignores a paste with no digits', () => {
    render(<Harness />);

    fireEvent.paste(cell(1), { clipboardData: { getData: () => 'abc' } });

    expect(value()).toBe('');
  });

  it('replaces the whole code when everything is selected and a digit is typed', () => {
    render(<Harness />);
    fireEvent.paste(cell(1), { clipboardData: { getData: () => '123456' } });

    fireEvent.keyDown(cell(3), { key: 'a', ctrlKey: true });
    fireEvent.change(cell(3), { target: { value: '9' } });

    expect(value()).toBe('9');
    expect(document.activeElement).toBe(cell(2));
  });

  it('clears the whole code when everything is selected and Backspace is pressed', () => {
    render(<Harness />);
    fireEvent.paste(cell(1), { clipboardData: { getData: () => '123456' } });

    fireEvent.keyDown(cell(3), { key: 'a', metaKey: true });
    fireEvent.keyDown(cell(3), { key: 'Backspace' });

    expect(value()).toBe('');
    expect(document.activeElement).toBe(cell(1));
  });

  it('submits on Enter', () => {
    const onSubmit = jest.fn();
    render(<Harness onSubmit={onSubmit} />);

    fireEvent.keyDown(cell(1), { key: 'Enter' });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not fail on Enter when there is no submit handler', () => {
    render(<Harness />);

    expect(() => fireEvent.keyDown(cell(1), { key: 'Enter' })).not.toThrow();
  });

  it('is exposed as one labelled group for assistive tech', () => {
    render(<Harness />);

    expect(screen.getByRole('group', { name: 'One-time password' })).toBeTruthy();
  });
});
