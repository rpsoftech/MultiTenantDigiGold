import {
  parseCategoryCarouselProps,
  parseDashboardEssentialsProps,
  parsePromoCarouselProps,
  parseTrendingJewelryProps,
} from './layout.sections';

describe.each([
  ['promo carousel', parsePromoCarouselProps, 'slides'],
  ['category carousel', parseCategoryCarouselProps, 'categories'],
  ['dashboard essentials', parseDashboardEssentialsProps, 'items'],
  ['trending jewellery', parseTrendingJewelryProps, 'products'],
] as const)('%s lists', (_name, parse, key) => {
  it.each([[undefined], [null], ['x'], [5], [{}], [[]], [[null, 'x', 3, {}]]])(
    'is undefined (built-in content) for %p',
    (value) => {
      expect(
        (parse({ [key]: value }) as Record<string, unknown>)[key],
      ).toBeUndefined();
    },
  );
});

describe('parsePromoCarouselProps', () => {
  it('keeps valid slides in saved order and drops unusable ones', () => {
    const { slides } = parsePromoCarouselProps({
      slides: [
        { id: 'a', imageUrl: '/a.png', imageAlt: 'A', linkUrl: '/jewellery' },
        { id: 'bad', imageUrl: 'http://insecure.example/x.png' },
        { id: 'b', imageUrl: 'https://cdn.example.com/b.png' },
      ],
    });

    expect(slides?.map((slide) => slide.id)).toEqual(['a', 'b']);
    expect(slides?.[0].linkUrl).toBe('/jewellery');
    expect(slides?.[1].imageAlt).toBe('Promotion');
  });

  it('drops an unsafe link but keeps the slide', () => {
    const { slides } = parsePromoCarouselProps({
      slides: [{ imageUrl: '/a.png', linkUrl: 'javascript:alert(1)' }],
    });

    expect(slides?.[0].linkUrl).toBeUndefined();
  });

  it('keeps ids unique and caps the number of slides', () => {
    const many = Array.from({ length: 30 }, () => ({
      id: 'same',
      imageUrl: '/a.png',
    }));
    const { slides } = parsePromoCarouselProps({ slides: many });

    expect(slides).toHaveLength(10);
    expect(new Set(slides?.map((slide) => slide.id)).size).toBe(10);
  });

  it('clamps the autoplay interval and ignores junk', () => {
    expect(
      parsePromoCarouselProps({ autoplayIntervalMs: 10 }).autoplayIntervalMs,
    ).toBe(2000);
    expect(
      parsePromoCarouselProps({ autoplayIntervalMs: 999999 })
        .autoplayIntervalMs,
    ).toBe(15000);
    expect(
      parsePromoCarouselProps({ autoplayIntervalMs: 4000 }).autoplayIntervalMs,
    ).toBe(4000);
    expect(
      parsePromoCarouselProps({ autoplayIntervalMs: '4000' })
        .autoplayIntervalMs,
    ).toBeUndefined();
    expect(
      parsePromoCarouselProps({ autoplayIntervalMs: NaN }).autoplayIntervalMs,
    ).toBeUndefined();
  });
});

describe('parseCategoryCarouselProps', () => {
  it('needs a label, a same-site url and a safe image', () => {
    const { categories, title } = parseCategoryCarouselProps({
      title: 'Collections',
      categories: [
        {
          id: 'ok',
          label: 'Rings',
          url: '/jewellery/rings',
          imageUrl: '/r.png',
        },
        { id: 'no-label', url: '/x', imageUrl: '/r.png' },
        {
          id: 'ext',
          label: 'Ext',
          url: 'https://evil.example',
          imageUrl: '/r.png',
        },
        { id: 'no-img', label: 'NoImg', url: '/x' },
      ],
    });

    expect(title).toBe('Collections');
    expect(categories?.map((category) => category.id)).toEqual(['ok']);
    expect(categories?.[0].imageAlt).toBe('Rings');
  });
});

describe('parseDashboardEssentialsProps', () => {
  it('defaults the icon, and drops unknown icons and modules', () => {
    const { items } = parseDashboardEssentialsProps({
      items: [
        { id: 'a', title: 'A', url: '/vault', icon: 'rocket', module: 'nope' },
        {
          id: 'b',
          title: 'B',
          url: '/vault',
          icon: 'coins',
          module: 'trading',
          description: 'd',
        },
        { id: 'c', title: 'C' },
      ],
    });

    expect(items).toHaveLength(2);
    expect(items?.[0]).toMatchObject({
      icon: 'gem',
      module: undefined,
      description: '',
    });
    expect(items?.[1]).toMatchObject({
      icon: 'coins',
      module: 'trading',
      description: 'd',
    });
  });
});

describe('parseTrendingJewelryProps', () => {
  const product = { id: 'p', title: 'Ring', imageUrl: '/p.png', price: 1000 };

  it('reads a valid product with sensible defaults', () => {
    const { products } = parseTrendingJewelryProps({ products: [product] });

    expect(products?.[0]).toMatchObject({
      title: 'Ring',
      price: 1000,
      currency: 'INR',
      isNew: false,
      imageAlt: 'Ring',
    });
  });

  it.each([
    ['a missing price', { ...product, price: undefined }],
    ['a negative price', { ...product, price: -1 }],
    ['a string price', { ...product, price: '1000' }],
    ['a non-finite price', { ...product, price: Infinity }],
    ['no title', { ...product, title: '' }],
    ['an unsafe image', { ...product, imageUrl: 'data:image/png;base64,AAAA' }],
  ])('drops a product with %s', (_label, bad) => {
    expect(
      parseTrendingJewelryProps({ products: [bad] }).products,
    ).toBeUndefined();
  });

  it('normalises the currency and rejects a malformed one', () => {
    const { products } = parseTrendingJewelryProps({
      products: [
        { ...product, id: 'a', currency: 'usd' },
        { ...product, id: 'b', currency: 'rupees' },
      ],
    });

    expect(products?.map((p) => p.currency)).toEqual(['USD', 'INR']);
  });

  it('only keeps same-site links', () => {
    const { products, viewAllUrl } = parseTrendingJewelryProps({
      viewAllUrl: 'https://evil.example',
      products: [{ ...product, href: '//evil.example' }],
    });

    expect(viewAllUrl).toBeUndefined();
    expect(products?.[0].href).toBeUndefined();
  });
});
