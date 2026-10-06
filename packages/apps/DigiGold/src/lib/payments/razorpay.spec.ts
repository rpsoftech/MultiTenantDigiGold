// Marks this file as a module so its helpers do not leak into other specs.
export {};

type RazorpayModule = typeof import('./razorpay');

// The loader caches its promise at module level, so each test gets a fresh module.
async function freshModule(): Promise<RazorpayModule> {
  jest.resetModules();
  return import('./razorpay');
}

function findScript(): HTMLScriptElement | null {
  return document.querySelector(
    'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
  );
}

describe('loadRazorpayScript', () => {
  beforeEach(() => {
    delete window.Razorpay;
    document.body.innerHTML = '';
  });

  it('resolves straight away when Razorpay is already on the page', async () => {
    const existing = jest.fn();
    window.Razorpay = existing as unknown as typeof window.Razorpay;
    const { loadRazorpayScript } = await freshModule();

    await expect(loadRazorpayScript()).resolves.toBe(existing);
    expect(findScript()).toBeNull();
  });

  it('injects the checkout script and resolves once it has loaded', async () => {
    const { loadRazorpayScript } = await freshModule();

    const pending = loadRazorpayScript();
    const script = findScript();
    expect(script).not.toBeNull();
    expect(script?.async).toBe(true);

    const ctor = jest.fn();
    window.Razorpay = ctor as unknown as typeof window.Razorpay;
    script?.onload?.(new Event('load'));

    await expect(pending).resolves.toBe(ctor);
  });

  it('shares one script tag between concurrent callers', async () => {
    const { loadRazorpayScript } = await freshModule();

    const first = loadRazorpayScript();
    const second = loadRazorpayScript();

    expect(first).toBe(second);
    expect(document.querySelectorAll('script[src*="razorpay"]')).toHaveLength(
      1,
    );
    window.Razorpay = jest.fn() as unknown as typeof window.Razorpay;
    findScript()?.onload?.(new Event('load'));
    await first;
  });

  it('rejects when the script fails to load, and can be retried', async () => {
    const { loadRazorpayScript } = await freshModule();

    const failed = loadRazorpayScript();
    findScript()?.onerror?.(new Event('error'));
    await expect(failed).rejects.toThrow(
      'Failed to load Razorpay checkout script',
    );

    document.body.innerHTML = '';
    const retry = loadRazorpayScript();
    expect(findScript()).not.toBeNull();
    const ctor = jest.fn();
    window.Razorpay = ctor as unknown as typeof window.Razorpay;
    findScript()?.onload?.(new Event('load'));
    await expect(retry).resolves.toBe(ctor);
  });

  it('rejects when the script loads but did not define Razorpay', async () => {
    const { loadRazorpayScript } = await freshModule();

    const pending = loadRazorpayScript();
    findScript()?.onload?.(new Event('load'));

    await expect(pending).rejects.toThrow('window.Razorpay is unavailable');
  });
});

describe('openRazorpayCheckout', () => {
  it('creates the checkout with the options and opens it', async () => {
    const { openRazorpayCheckout } = await freshModule();
    const open = jest.fn();
    const Ctor = jest.fn().mockImplementation(() => ({ open, on: jest.fn() }));
    const options = {
      key: 'rzp_test',
      amount: 700000,
      currency: 'INR',
      order_id: 'order_1',
      handler: jest.fn(),
    };

    const instance = openRazorpayCheckout(Ctor as never, options);

    expect(Ctor).toHaveBeenCalledWith(options);
    expect(open).toHaveBeenCalledTimes(1);
    expect(instance.open).toBe(open);
  });
});
