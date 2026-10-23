import { render, screen } from '@testing-library/react';
import { bandTone, SectionBand } from './SectionBand';

describe('bandTone', () => {
  it('starts gray and alternates', () => {
    expect([0, 1, 2, 3, 4].map(bandTone)).toEqual(['gray', 'white', 'gray', 'white', 'gray']);
  });
});

describe('SectionBand', () => {
  it('wraps its content and differs between neighbouring bands', () => {
    render(
      <>
        <SectionBand index={0}>
          <p>first</p>
        </SectionBand>
        <SectionBand index={1}>
          <p>second</p>
        </SectionBand>
      </>
    );

    const first = screen.getByText('first').parentElement as HTMLElement;
    const second = screen.getByText('second').parentElement as HTMLElement;
    expect(first.className).not.toBe(second.className);
  });
});
