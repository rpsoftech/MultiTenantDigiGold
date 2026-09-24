import {
  Injectable,
  inject,
  PLATFORM_ID,
  makeStateKey,
  TransferState,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformServer } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { SDUIComponentConfig } from '@dg/angular-core';
import { API_BASE_URL } from './tokens';

export interface TenantInfo {
  tenant_uuid: string;
  full_name: string;
  short_name: string;
  domain: string;
  ui_json_config: SDUIComponentConfig[];
}

const TENANT_STATE_KEY = makeStateKey<TenantInfo>('tenantInfo');

@Injectable({
  providedIn: 'root',
})
export class TenantConfigService {
  private http = inject(HttpClient);
  private transferState = inject(TransferState);
  private platformId = inject(PLATFORM_ID);
  private apiBase = inject(API_BASE_URL);

  // A reactive signal holding the hydrated config
  readonly config = signal<TenantInfo | null>(null);

  // Expose an explicit init method to hook into APP_INITIALIZER
  async loadTenantConfig(): Promise<void> {
    // 1. Check if the state was already transferred from the SSR Node server
    if (this.transferState.hasKey(TENANT_STATE_KEY)) {
      const cached = this.transferState.get(TENANT_STATE_KEY, null);
      if (cached) {
        this.config.set(cached);
        // Clean up memory
        this.transferState.remove(TENANT_STATE_KEY);
        return;
      }
    }

    // 2. Fetch from the Go API
    // In SSR, this must be an absolute URL. In a real environment, you'd pull the URL from an env variable.
    const apiUrl = `${this.apiBase}/api/v1/tenant/info`;

    // In production, we would inject the incoming `Host` header here via Angular SSR Request object
    // and pass it as the X-Tenant-Id header to dynamically resolve the tenant.
    const headers = {
      'X-Tenant-Id': 'e82a3c20-56b0-45d2-9781-dfb542095f2d', // Dummy master tenant
    };

    try {
      const response = await firstValueFrom(
        this.http.get<TenantInfo>(apiUrl, { headers }),
      );

      this.config.set(response);

      // 3. If running on the Node server, serialize this response into the HTML for the browser
      if (isPlatformServer(this.platformId)) {
        this.transferState.set(TENANT_STATE_KEY, response);
      }
    } catch (err) {
      console.error(
        '[TenantConfigService] Failed to load tenant configuration',
        err,
      );
      // Fallback for local development when Go backend might be down
      this.config.set(this.getFallbackConfig());
    }
  }

  private getFallbackConfig(): TenantInfo {
    return {
      tenant_uuid: 'fallback-uuid',
      full_name: 'Fallback Jewellers',
      short_name: 'Fallback',
      domain: 'fallback.com',
      ui_json_config: [
        {
          id: 'fallback_hero',
          type: 'Hero',
          variant: '1',
          props: {
            title: 'Backend Offline',
            subtitle: 'Showing fallback SSR state.',
            backgroundColor: '#334155',
          },
        },
      ],
    };
  }
}
