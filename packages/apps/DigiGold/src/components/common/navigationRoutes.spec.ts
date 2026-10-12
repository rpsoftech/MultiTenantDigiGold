import fs from 'fs';
import path from 'path';
import headerConfig from './Header/header.config.json';
import footerConfig from './Footer/footer.config.json';
import essentialsConfig from '../dashboard/DashboardEssentials/dashboard-essentials.config.json';
import promoConfig from '../dashboard/PromoCarousel/promo-carousel.config.json';
import trendingConfig from '../dashboard/TrendingJewelry/trending-jewelry.config.json';

// Every link the header, footer and home page sections show must lead to a page this app
// actually builds. Entries for pages that don't exist yet stay in the configs with
// `"enabled": false`.

const APP_DIR = path.resolve(__dirname, '../../app');

// URL patterns for every page.tsx under src/app. Route groups like (main) are not part of
// the URL; [param] segments match any value.
function appRoutes(dir = APP_DIR, segments: string[] = []): RegExp[] {
  const routes: RegExp[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const isGroup = /^\(.*\)$/.test(entry.name);
      routes.push(
        ...appRoutes(
          path.join(dir, entry.name),
          isGroup ? segments : [...segments, entry.name],
        ),
      );
    } else if (entry.name === 'page.tsx') {
      const pattern = segments
        .map((segment) =>
          /^\[.+\]$/.test(segment)
            ? '[^/]+'
            : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        )
        .join('/');
      routes.push(new RegExp(`^/${pattern}/?$`));
    }
  }
  return routes;
}

type NavItem = {
  url: string;
  enabled: boolean;
  children?: NavItem[];
  links?: NavItem[];
};

// Visible links only: a disabled parent hides its children.
function enabledUrls(items: NavItem[]): string[] {
  return items
    .filter((item) => item.enabled)
    .flatMap((item) => [
      item.url,
      ...enabledUrls(item.children ?? []),
      ...enabledUrls(item.links ?? []),
    ]);
}

const isInternalPage = (url: string) => url.startsWith('/');

describe('navigation links', () => {
  const routes = appRoutes();

  it('finds the app pages', () => {
    expect(routes.some((route) => route.test('/home'))).toBe(true);
  });

  it.each([
    [
      'header',
      [
        headerConfig.logo.url,
        ...enabledUrls(headerConfig.menus),
        ...enabledUrls(headerConfig.actions),
      ],
    ],
    [
      'footer',
      enabledUrls(
        footerConfig.columns.map((column) => ({ ...column, url: '#' })),
      ),
    ],
    ['dashboard card', enabledUrls(essentialsConfig.items)],
    [
      'promo slide',
      promoConfig.slides
        .filter((slide) => slide.enabled)
        .flatMap((slide) =>
          'linkUrl' in slide && slide.linkUrl ? [slide.linkUrl] : [],
        ),
    ],
    ['trending "View All"', [trendingConfig.viewAllUrl]],
  ])('every enabled %s link leads to an existing page', (_, urls) => {
    const missing = urls
      .filter(isInternalPage)
      .filter(
        (url) => !routes.some((route) => route.test(url.split(/[?#]/)[0])),
      );

    expect(missing).toEqual([]);
  });
});
