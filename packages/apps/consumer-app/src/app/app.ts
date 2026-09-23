import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SduiRendererComponent } from '@dg/ui';
import { TenantConfigService } from '@dg/services';

@Component({
  standalone: true,
  imports: [RouterModule, SduiRendererComponent],
  selector: 'app-root',
  template: `
    <div class="min-h-screen bg-gray-50 flex flex-col font-sans pb-20">
      @if (tenantService.config()) {
        @for (comp of tenantService.config()!.ui_json_config; track comp.id) {
          <!-- We dynamically merge the tenant branding into Header props! -->
          <dg-sdui-renderer
            [config]="comp.type === 'Header' ? injectBranding(comp) : comp"
            [class.mb-6]="comp.type !== 'Header'"
          >
          </dg-sdui-renderer>
        }
      }
    </div>
  `,
  styleUrl: './app.scss',
})
export class App {
  public tenantService = inject(TenantConfigService);

  // Helper to inject the global tenant branding into the header component
  injectBranding(comp: any) {
    const config = this.tenantService.config();
    if (!config) return comp;

    return {
      ...comp,
      props: {
        ...comp.props,
        brandName: config.full_name,
      },
    };
  }
}
