import { render, screen } from '@testing-library/react';
import type { LayoutBlock } from '@/features/layout/layout.types';
import { hasRenderableBlock, LayoutRenderer } from './LayoutRenderer';

jest.mock('./blocks/HeroBlock/HeroBlock', () => ({
  HeroBlock: ({
    props,
    context,
  }: {
    props: { title: string };
    context: { isFirstOfType: boolean };
  }) => (
    <div data-testid="hero" data-first={String(context.isFirstOfType)}>
      {props.title}
    </div>
  ),
}));
jest.mock('./blocks/LiveRateBlock/LiveRateBlock', () => ({
  LiveRateBlock: () => <div data-testid="live-rate">live rate</div>,
}));
jest.mock('./blocks/QuickActionsBlock/QuickActionsBlock', () => ({
  QuickActionsBlock: () => {
    throw new Error('boom');
  },
}));
jest.mock('./blocks/PortfolioSummaryBlock/PortfolioSummaryBlock', () => ({
  PortfolioSummaryBlock: () => <div data-testid="portfolio">portfolio</div>,
}));

const block = (over: Partial<LayoutBlock>): LayoutBlock => ({
  id: 'b',
  type: 'Hero',
  variant: '1',
  props: {},
  children: [],
  ...over,
});

describe('LayoutRenderer', () => {
  let errorSpy: jest.SpyInstance;
  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => errorSpy.mockRestore());

  it('renders blocks in their saved order with their saved props', () => {
    render(
      <LayoutRenderer
        blocks={[
          block({ id: 'a', type: 'LiveRate' }),
          block({ id: 'b', props: { title: 'Welcome' } }),
          block({ id: 'c', type: 'PortfolioSummary' }),
        ]}
      />
    );

    const order = screen.getAllByTestId(/hero|live-rate|portfolio/).map((el) => el.dataset.testid);
    expect(order).toEqual(['live-rate', 'hero', 'portfolio']);
    expect(screen.getByTestId('hero').textContent).toBe('Welcome');
  });

  it('skips unsupported types and unknown variants without breaking the rest', () => {
    render(
      <LayoutRenderer
        blocks={[
          block({ id: 'a', type: 'Carousel' }),
          block({ id: 'b', variant: '9' }),
          block({ id: 'c', type: 'LiveRate' }),
        ]}
      />
    );

    expect(screen.getByTestId('live-rate')).toBeTruthy();
    expect(screen.queryByTestId('hero')).toBeNull();
  });

  it('keeps the other blocks when one block throws', () => {
    render(
      <LayoutRenderer
        blocks={[
          block({ id: 'a', type: 'QuickActions' }),
          block({ id: 'b', type: 'LiveRate' }),
        ]}
      />
    );

    expect(screen.getByTestId('live-rate')).toBeTruthy();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('marks only the first block of a type as first', () => {
    render(
      <LayoutRenderer
        blocks={[
          block({ id: 'a', props: { title: 'One' } }),
          block({ id: 'b', props: { title: 'Two' } }),
        ]}
      />
    );

    expect(screen.getAllByTestId('hero').map((el) => el.dataset.first)).toEqual(['true', 'false']);
  });

  it('renders nested children after their parent', () => {
    render(
      <LayoutRenderer
        blocks={[
          block({ id: 'p', type: 'PortfolioSummary', children: [block({ id: 'c', type: 'LiveRate' })] }),
        ]}
      />
    );

    expect(screen.getByTestId('live-rate')).toBeTruthy();
    expect(screen.getByTestId('portfolio')).toBeTruthy();
  });

  it('renders nothing when no block is supported', () => {
    const { container } = render(<LayoutRenderer blocks={[block({ type: 'Nope' })]} />);

    expect(container.firstChild).toBeNull();
  });

  it('does not draw the Header block or let it break the gray/white alternation', () => {
    const { container } = render(
      <LayoutRenderer
        blocks={[
          block({ id: 'h', type: 'Header' }),
          block({ id: 'a', type: 'LiveRate' }),
          block({ id: 'b', type: 'PortfolioSummary' }),
          block({ id: 'c', type: 'Hero' }),
        ]}
      />
    );

    expect(container.querySelector('[data-block="Header_1"]')).toBeNull();
    // Three drawn blocks, three bands: first gray, then white, then gray again.
    const bands = Array.from(container.querySelectorAll('[data-block]')).map(
      (slot) => slot.parentElement as HTMLElement
    );
    expect(bands).toHaveLength(3);
    expect(bands[0].className).not.toBe(bands[1].className);
    expect(bands[0].className).toBe(bands[2].className);
  });
});

describe('registered dashboard sections', () => {
  it.each([
    'PromoCarousel',
    'CategoryCarousel',
    'DashboardEssentials',
    'TrendingJewelry',
    'BuyGold',
  ])('knows %s', (type) => {
    expect(hasRenderableBlock([block({ type })])).toBe(true);
  });
});

describe('hasRenderableBlock', () => {
  it('is true when at least one block draws content', () => {
    expect(hasRenderableBlock([block({ type: 'Nope' }), block({ type: 'LiveRate' })])).toBe(true);
  });

  it('is false for empty, unsupported and header-only layouts', () => {
    expect(hasRenderableBlock([])).toBe(false);
    expect(hasRenderableBlock([block({ type: 'Nope' })])).toBe(false);
    expect(hasRenderableBlock([block({ type: 'Header' })])).toBe(false);
  });
});
