import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Drawer } from './Drawer';

afterEach(cleanup);

describe('Drawer', () => {
  it('renders its title, description and content when open', () => {
    render(
      <Drawer open onOpenChange={jest.fn()} title="Details" description="About it">
        <p>body</p>
      </Drawer>,
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Details')).toBeTruthy();
    expect(screen.getByText('About it')).toBeTruthy();
    expect(screen.getByText('body')).toBeTruthy();
  });

  it('renders nothing when closed', () => {
    render(
      <Drawer open={false} onOpenChange={jest.fn()} title="Details">
        <p>body</p>
      </Drawer>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('asks to close from the close button', () => {
    const onOpenChange = jest.fn();
    render(
      <Drawer open onOpenChange={onOpenChange} title="Details">
        <p>body</p>
      </Drawer>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
