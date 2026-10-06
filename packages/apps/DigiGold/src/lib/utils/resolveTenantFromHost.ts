const REGISTRABLE_LABEL_COUNT = 2; // assumes label.tld, e.g. "digigold.com"
const LOOPBACK_HOSTNAME_PATTERN = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * Resolves a retailer code from a request's Host header. Pure and Next.js-free so it stays
 * trivially unit-testable — call it from the root layout via `next/headers`'s `headers()`.
 *
 * TODO: use a public-suffix-list package (e.g. `psl`) if multi-part TLDs (e.g. digigold.co.in)
 * are ever needed — this assumes every registrable domain is exactly `label.tld`.
 */
export function resolveTenantFromHost(
  hostHeader: string | null,
  defaultTenant: string
): string {
  if (!hostHeader) return defaultTenant;

  const hostname = hostHeader.split(':')[0].trim().toLowerCase();
  if (!hostname || hostname === 'localhost' || LOOPBACK_HOSTNAME_PATTERN.test(hostname)) {
    return defaultTenant;
  }

  const labels = hostname.split('.').filter(Boolean);
  if (labels.length <= REGISTRABLE_LABEL_COUNT) {
    return defaultTenant; // bare domain, e.g. "digigold.com"
  }

  const subdomainLabels = labels.slice(0, labels.length - REGISTRABLE_LABEL_COUNT);
  const [first, ...rest] = subdomainLabels;
  if (first === 'www') {
    return rest.length > 0 ? rest[0] : defaultTenant;
  }

  return first;
}
