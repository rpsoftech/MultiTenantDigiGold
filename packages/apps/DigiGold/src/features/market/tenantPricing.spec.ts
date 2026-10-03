import { applyDefaultTenantPricing } from './tenantPricing';

describe('applyDefaultTenantPricing', () => {
  it('adds the default 100 rupee margin and then 3 percent GST on top', () => {
    const priced = applyDefaultTenantPricing(7000);

    expect(priced.mcxBaseRateInr).toBe(7000);
    expect(priced.marginAppliedInr).toBe(100);
    expect(priced.gstAppliedInr).toBeCloseTo(213, 6); // 3% of 7,100
    expect(priced.finalRatePerGramInr).toBeCloseTo(7313, 6);
  });

  it('keeps the parts consistent with the final price', () => {
    const priced = applyDefaultTenantPricing(7120.83);

    expect(priced.finalRatePerGramInr).toBeCloseTo(
      priced.mcxBaseRateInr + priced.marginAppliedInr + priced.gstAppliedInr,
      6,
    );
  });

  it('charges GST on the margin as well as the base rate', () => {
    const priced = applyDefaultTenantPricing(1000);

    expect(priced.gstAppliedInr).toBeCloseTo((1000 + 100) * 0.03, 6);
  });

  it('always applies the same flat margin regardless of the rate', () => {
    expect(applyDefaultTenantPricing(100).marginAppliedInr).toBe(100);
    expect(applyDefaultTenantPricing(100000).marginAppliedInr).toBe(100);
  });
});
