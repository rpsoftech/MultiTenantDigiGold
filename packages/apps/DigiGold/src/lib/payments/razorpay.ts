// NOTE: candidate for a shared payments lib if another app in this workspace ever needs
// Razorpay Checkout — kept local to DigiGold for now.

export type RazorpaySuccessResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

export type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name?: string;
  description?: string;
  prefill?: { contact?: string; email?: string; name?: string };
  theme?: { color?: string };
  handler: (response: RazorpaySuccessResponse) => void;
  modal?: { ondismiss?: () => void };
};

export type RazorpayFailureResponse = {
  error: { code: string; description: string; reason?: string };
};

export type RazorpayInstance = {
  open: () => void;
  close: () => void;
  on: (event: 'payment.failed', handler: (response: RazorpayFailureResponse) => void) => void;
};

type RazorpayConstructor = new (options: RazorpayCheckoutOptions) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

const CHECKOUT_SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

let loadPromise: Promise<RazorpayConstructor> | null = null;

// Injects the Razorpay Checkout script once and caches the in-flight/resolved promise so
// concurrent callers (e.g. rapid double-click on Proceed) share one script tag.
export function loadRazorpayScript(): Promise<RazorpayConstructor> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<RazorpayConstructor>((resolve, reject) => {
    if (window.Razorpay) {
      resolve(window.Razorpay);
      return;
    }

    const script = document.createElement('script');
    script.src = CHECKOUT_SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      if (window.Razorpay) resolve(window.Razorpay);
      else reject(new Error('Razorpay script loaded but window.Razorpay is unavailable'));
    };
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout script'));
    document.body.appendChild(script);
  }).catch((error) => {
    loadPromise = null;
    throw error;
  });

  return loadPromise;
}

// Razorpay keeps the modal open after a failed attempt so the customer can retry with
// another method — onPaymentFailed is for surfacing why, not for ending the flow.
export function openRazorpayCheckout(
  RazorpayCtor: RazorpayConstructor,
  options: RazorpayCheckoutOptions,
  onPaymentFailed?: (response: RazorpayFailureResponse) => void,
): RazorpayInstance {
  const instance = new RazorpayCtor(options);
  if (onPaymentFailed) instance.on('payment.failed', onPaymentFailed);
  instance.open();
  return instance;
}
