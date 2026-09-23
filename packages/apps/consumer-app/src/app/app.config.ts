import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  APP_INITIALIZER,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { appRoutes } from './app.routes';
import {
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser';
import { TenantConfigService } from '@dg/services';

// Factory function to initialize the app state before rendering
export function initializeApp(tenantConfig: TenantConfigService) {
  return (): Promise<any> => {
    return tenantConfig.loadTenantConfig();
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withFetch()),
    provideClientHydration(withEventReplay()),
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      deps: [TenantConfigService],
      multi: true,
    },
  ],
};
