import { readableColor } from 'color2k';

// Block props come from an unvalidated JSON blob, so every block parses them down to a
// small safe shape here. A value of the wrong type falls back to the block's default
// instead of reaching the DOM.

export function text(value: unknown, max: number, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : fallback;
}

export function optionalText(value: unknown, max: number): string | null {
  const result = text(value, max, '');
  return result || null;
}

export function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function hexColor(value: unknown): string | null {
  const color = optionalText(value, 7);
  return color && /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(color) ? color : null;
}

// Same-site paths only: a protocol-relative "//host" or a "javascript:" URL must never
// become a link target.
export function internalPath(value: unknown): string | null {
  const path = optionalText(value, 200);
  return path && /^\/(?![/\\])/.test(path) ? path : null;
}

// An image may be a same-site path or an https URL; http and data: URLs are rejected.
export function imageUrl(value: unknown): string | null {
  const url = optionalText(value, 500);
  if (!url) return null;
  if (internalPath(url)) return url;
  try {
    return new URL(url).protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

export type HeroProps = {
  title: string;
  subtitle: string;
  ctaText: string;
  backgroundColor: string | null;
  textColor: string | null;
};

export function parseHeroProps(raw: Record<string, unknown>): HeroProps {
  const backgroundColor = hexColor(raw.backgroundColor);
  return {
    title: text(raw.title, 120, 'Invest in 24K Digital Gold'),
    subtitle: text(
      raw.subtitle,
      240,
      'Secure, transparent, and instantly redeemable.',
    ),
    ctaText: text(raw.ctaText, 40, 'Buy Gold'),
    backgroundColor,
    // Text stays readable on whatever background the tenant picked.
    textColor: backgroundColor ? readableColor(backgroundColor) : null,
  };
}

export type QuickActionsProps = { showDelivery: boolean };

export function parseQuickActionsProps(
  raw: Record<string, unknown>,
): QuickActionsProps {
  return { showDelivery: bool(raw.showDelivery, true) };
}

export type HeaderProps = { brandName: string | null; logoUrl: string | null };

export function parseHeaderProps(raw: Record<string, unknown>): HeaderProps {
  return {
    brandName: optionalText(raw.brandName, 60),
    logoUrl: imageUrl(raw.logoUrl),
  };
}

// LiveRate and PortfolioSummary read live state, not props. Anything saved against them
// (a stale `goldGrams`, say) is deliberately ignored.
export function parseNoProps(): Record<string, never> {
  return {};
}
