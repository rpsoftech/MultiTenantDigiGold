import { RenderMode, ServerRoute } from '@angular/ssr';

// Rendered per request, not prerendered at build time: the tenant comes from the request
// (TenantConfigService), and a build-time render would bake one tenant's config, or the
// API-unreachable fallback, into static HTML for everyone.
export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
