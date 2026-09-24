import { mockLiveRateStream } from './market.mock';
import { parseRateFrameToPrice } from './market.utils';
import { MARKET_PURITY_LABEL } from './market.types';
import type { MarketConnectionStatus, MarketRate } from './market.types';

// GET /api/v1/rates/stream — Server-Sent Events over plain HTTP.
//
// Why SSE and not WebSocket/polling for a live rate ticker:
// - It's one-directional (server → client); SSE is the standard fit, WebSocket's
//   bidirectional channel and custom heartbeat/reconnect plumbing would be unused overhead.
// - The browser's native EventSource reconnects on its own (honoring the server's `retry:`
//   hint, ~3s by default) — no hand-rolled backoff loop to get wrong.
// - It multiplexes fine over HTTP/2 and works through the same proxies/load balancers as
//   the rest of the API, unlike WebSocket upgrades which sometimes need separate handling.
// - It replaces the previous 30s-poll approach entirely, cutting request volume from one
//   poll per client per 30s to a single held-open connection per client.
const USE_MOCK_MARKET = process.env.NEXT_PUBLIC_USE_MOCK_MARKET === 'true';

// Coalesces bursty ticks so the UI never re-renders faster than a human can read a price.
const MIN_TICK_INTERVAL_MS = 250;

export type LiveRateListener = {
  onTick: (rate: MarketRate) => void;
  onStatusChange: (status: MarketConnectionStatus) => void;
};

let eventSource: EventSource | null = null;
let stopMockStream: (() => void) | null = null;
let lastTickAt = 0;
let currentStatus: MarketConnectionStatus = 'connecting';
const listeners = new Set<LiveRateListener>();

function buildStreamUrl(): string | null {
  // EventSource can't reuse the axios instance, so this mirrors apiClient's baseURL
  // convention directly (same env var, same lack of trailing-slash handling) rather than
  // introducing a second way of resolving the API origin.
  const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseURL) return null;
  return `${baseURL.replace(/\/+$/, '')}/rates/stream`;
}

function setStatus(status: MarketConnectionStatus) {
  currentStatus = status;
  listeners.forEach((listener) => listener.onStatusChange(status));
}

function emitFrame(rawFrame: string) {
  const now = Date.now();
  if (now - lastTickAt < MIN_TICK_INTERVAL_MS) return;

  const price = parseRateFrameToPrice(rawFrame);
  if (price === null) return;

  lastTickAt = now;
  const rate: MarketRate = {
    pricePerGramInr: price,
    purityLabel: MARKET_PURITY_LABEL,
    updatedAt: new Date().toISOString(),
  };
  listeners.forEach((listener) => listener.onTick(rate));
}

function connect() {
  if (typeof window === 'undefined' || eventSource || stopMockStream) return;

  if (USE_MOCK_MARKET) {
    setStatus('open');
    stopMockStream = mockLiveRateStream(emitFrame);
    return;
  }

  const url = buildStreamUrl();
  if (!url) {
    setStatus('error');
    return;
  }

  setStatus('connecting');
  const source = new EventSource(url);
  eventSource = source;

  source.onopen = () => setStatus('open');
  source.onmessage = (event) => emitFrame(event.data);
  source.onerror = () => {
    // The browser retries automatically; just reflect the transient state so the UI
    // can show a "reconnecting" hint instead of treating this as a fatal error.
    setStatus(source.readyState === EventSource.CONNECTING ? 'connecting' : 'error');
  };
}

function disconnect() {
  eventSource?.close();
  eventSource = null;
  stopMockStream?.();
  stopMockStream = null;
  currentStatus = 'closed';
}

// Ref-counted singleton: no matter how many components call useLiveRate(), exactly one
// physical stream connection is ever open, and it's closed once nobody's listening.
export function subscribeToLiveRate(listener: LiveRateListener): () => void {
  listeners.add(listener);
  listener.onStatusChange(currentStatus);
  connect();

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) disconnect();
  };
}
