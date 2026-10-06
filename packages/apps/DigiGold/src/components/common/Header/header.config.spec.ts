import { ROUTES } from '@/lib/constants/routes';
import headerConfig from './header.config.json';

type MenuItem = {
  id: string;
  url: string;
  enabled: boolean;
  order: number;
  children?: MenuItem[];
};

const menus = headerConfig.menus as MenuItem[];

describe('header menu config', () => {
  const vault = menus.find((menu) => menu.id === 'vault');

  it('lists Redeem Gold under the Vault menu pointing at the redemptions route', () => {
    const redemptions = vault?.children?.find(
      (item) => item.id === 'redemptions',
    );

    expect(redemptions).toBeDefined();
    expect(redemptions?.url).toBe(ROUTES.redemptions);
    expect(redemptions?.enabled).toBe(true);
  });

  it('keeps Vault child ordering unique', () => {
    const orders = (vault?.children ?? []).map((item) => item.order);

    expect(new Set(orders).size).toBe(orders.length);
  });

  it('does not expose a sell action anywhere in the menu', () => {
    const urls = menus.flatMap((menu) => [
      menu.url,
      ...(menu.children ?? []).map((c) => c.url),
    ]);

    expect(urls.some((url) => /sell/i.test(url))).toBe(false);
  });
});
