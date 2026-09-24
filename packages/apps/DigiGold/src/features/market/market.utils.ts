// MainServer's rate feed currently sends a raw SSE "data: <price>\n\n" frame rather than a
// structured payload, so this pulls the first numeric token out of whatever text arrives —
// it works whether the frame is a clean scalar or wrapped in extra formatting, and won't
// need to change if the framing shifts slightly on the backend.
export function parseRateFrameToPrice(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const match = raw.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  // A gold price can never be zero or negative — treat one as a bad/sentinel tick rather
  // than rendering it, e.g. if the backend ever emits an error value in this slot.
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}
