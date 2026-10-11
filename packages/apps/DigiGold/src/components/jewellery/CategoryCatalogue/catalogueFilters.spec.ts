import { product } from '../testUtils';
import {
  applyFilters,
  buildFilterGroups,
  paramsFromState,
  purityList,
  selectedFromParams,
  sortProducts,
} from './catalogueFilters';

describe('catalogue filters', () => {
  it('offers a weight bucket for light designs too', () => {
    const groups = buildFilterGroups([
      product({ id: 'light', weight: 6 }),
      product({ id: 'heavy', weight: 60 }),
    ]);
    const weight = groups.find((group) => group.key === 'weight');

    expect(weight?.options.map((option) => option.label)).toEqual([
      'Under 10 gm',
      'Over 50 gm',
    ]);
  });

  it('takes attribute options from the data, in a natural order', () => {
    const groups = buildFilterGroups([
      product({ id: 'a', carat: '9KT Gold' }),
      product({ id: 'b', carat: '22KT Gold' }),
      product({ id: 'c', carat: '18KT Gold' }),
    ]);

    expect(
      groups
        .find((group) => group.key === 'carat')
        ?.options.map((option) => option.value),
    ).toEqual(['9KT Gold', '18KT Gold', '22KT Gold']);
  });

  it('ignores a selection no option knows, e.g. from an old link', () => {
    const products = [
      product({ id: 'a', carat: '22KT Gold' }),
      product({ id: 'b', carat: '18KT Gold' }),
    ];
    const groups = buildFilterGroups(products);

    expect(
      applyFilters(products, groups, { carat: ['14KT Gold'] }),
    ).toHaveLength(2);
  });

  it('keeps the catalogue order for Featured and ties', () => {
    const products = [
      product({ id: 'x', price: 5, isNew: false }),
      product({ id: 'y', price: 5, isNew: true }),
      product({ id: 'z', price: 1, isNew: false }),
    ];

    expect(sortProducts(products, 'featured').map((p) => p.id)).toEqual([
      'x',
      'y',
      'z',
    ]);
    expect(sortProducts(products, 'price-low').map((p) => p.id)).toEqual([
      'z',
      'x',
      'y',
    ]);
    expect(sortProducts(products, 'newest').map((p) => p.id)).toEqual([
      'y',
      'x',
      'z',
    ]);
  });

  it('lists purities without "Gold", lightest first', () => {
    expect(
      purityList([
        product({ id: 'a', carat: '22KT Gold' }),
        product({ id: 'b', carat: '9KT Gold' }),
        product({ id: 'c', carat: '22KT Gold' }),
      ]),
    ).toEqual(['9KT', '22KT']);
  });

  it('round-trips filters and sort through the query string', () => {
    const params = paramsFromState(
      { carat: ['18KT Gold', '22KT Gold'], price: ['0-100000'] },
      'price-high',
    );

    expect(params.toString()).toBe(
      'price=0-100000&carat=18KT+Gold&carat=22KT+Gold&sort=price-high',
    );
    expect(selectedFromParams(params)).toEqual({
      price: ['0-100000'],
      carat: ['18KT Gold', '22KT Gold'],
    });
    expect(paramsFromState({}, 'featured').toString()).toBe('');
  });
});
