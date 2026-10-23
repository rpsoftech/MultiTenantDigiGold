import {
  imageUrl,
  internalPath,
  parseHeaderProps,
  parseHeroProps,
  parseQuickActionsProps,
  text,
} from './layout.props';

describe('text', () => {
  it('trims, clamps and falls back', () => {
    expect(text('  hi  ', 10, 'x')).toBe('hi');
    expect(text('abcdef', 3, 'x')).toBe('abc');
    expect(text('   ', 10, 'x')).toBe('x');
    expect(text(42, 10, 'x')).toBe('x');
    expect(text(undefined, 10, 'x')).toBe('x');
  });
});

describe('internalPath', () => {
  it.each(['/home', '/vault/passbook'])('accepts %s', (path) => {
    expect(internalPath(path)).toBe(path);
  });

  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
    'home',
    '',
    7,
    null,
  ])('rejects %p', (value) => {
    expect(internalPath(value)).toBeNull();
  });
});

describe('imageUrl', () => {
  it('accepts same-site paths and https URLs', () => {
    expect(imageUrl('/brand/logo.svg')).toBe('/brand/logo.svg');
    expect(imageUrl('https://cdn.example.com/logo.png')).toBe(
      'https://cdn.example.com/logo.png',
    );
  });

  it.each([
    'http://cdn.example.com/a.png',
    'data:image/png;base64,AAAA',
    'javascript:x',
    '//x.com/a.png',
    'not a url',
    5,
  ])('rejects %p', (value) => {
    expect(imageUrl(value)).toBeNull();
  });
});

describe('parseHeroProps', () => {
  it('uses defaults for an empty props object', () => {
    const props = parseHeroProps({});

    expect(props.title).toBeTruthy();
    expect(props.subtitle).toBeTruthy();
    expect(props.ctaText).toBe('Buy Gold');
    expect(props.backgroundColor).toBeNull();
    expect(props.textColor).toBeNull();
  });

  it('keeps provided copy and clamps very long text', () => {
    const props = parseHeroProps({
      title: 'Festive offer',
      subtitle: 'x'.repeat(1000),
    });

    expect(props.title).toBe('Festive offer');
    expect(props.subtitle).toHaveLength(240);
  });

  it('accepts only hex background colours', () => {
    expect(parseHeroProps({ backgroundColor: '#1e40af' }).backgroundColor).toBe(
      '#1e40af',
    );
    expect(
      parseHeroProps({ backgroundColor: 'red; background:url(x)' })
        .backgroundColor,
    ).toBeNull();
    expect(
      parseHeroProps({ backgroundColor: 'url(javascript:x)' }).backgroundColor,
    ).toBeNull();
    expect(parseHeroProps({ backgroundColor: 12 }).backgroundColor).toBeNull();
  });

  it('picks different readable text for dark and light backgrounds', () => {
    const onDark = parseHeroProps({ backgroundColor: '#111111' }).textColor;
    const onLight = parseHeroProps({ backgroundColor: '#fafafa' }).textColor;

    expect(onDark).toBeTruthy();
    expect(onLight).toBeTruthy();
    expect(onDark).not.toBe(onLight);
  });
});

describe('parseQuickActionsProps', () => {
  it('shows delivery unless it is switched off with a boolean', () => {
    expect(parseQuickActionsProps({}).showDelivery).toBe(true);
    expect(parseQuickActionsProps({ showDelivery: false }).showDelivery).toBe(
      false,
    );
    expect(parseQuickActionsProps({ showDelivery: 'false' }).showDelivery).toBe(
      true,
    );
  });
});

describe('parseHeaderProps', () => {
  it('reads a brand name and a safe logo', () => {
    expect(
      parseHeaderProps({ brandName: 'Acme', logoUrl: 'https://x.com/l.png' }),
    ).toEqual({
      brandName: 'Acme',
      logoUrl: 'https://x.com/l.png',
    });
  });

  it('drops an unsafe logo and a missing name', () => {
    expect(parseHeaderProps({ logoUrl: 'http://x.com/l.png' })).toEqual({
      brandName: null,
      logoUrl: null,
    });
  });
});
