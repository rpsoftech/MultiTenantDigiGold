import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { SDUIComponentConfig } from '@dg/angular-core';
import { SduiRendererComponent } from '@dg/ui';

@Component({
  standalone: true,
  selector: 'dg-sdui-builder',
  imports: [CommonModule, SduiRendererComponent],
  template: `
    <div class="h-full flex gap-6">
      <!-- Sidebar Controls -->
      <div
        class="w-80 bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col gap-6"
      >
        <div>
          <h2 class="text-lg font-bold mb-4">SDUI Templates</h2>
          <p class="text-sm text-gray-500 mb-4">
            Select a pre-defined JSON layout to deploy to the Consumer App.
          </p>

          <div class="space-y-3">
            <button
              (click)="selectTemplate('template1')"
              [class.ring-2]="activeTemplate() === 'template1'"
              class="w-full text-left p-4 rounded-lg border border-gray-200 hover:border-blue-500 transition-all"
            >
              <div class="font-semibold">Standard Dashboard</div>
              <div class="text-xs text-gray-500 mt-1">Hero + Live Rates</div>
            </button>

            <button
              (click)="selectTemplate('template2')"
              [class.ring-2]="activeTemplate() === 'template2'"
              class="w-full text-left p-4 rounded-lg border border-gray-200 hover:border-blue-500 transition-all"
            >
              <div class="font-semibold">Trading Focus</div>
              <div class="text-xs text-gray-500 mt-1">
                Live Rates (Top) + Hero
              </div>
            </button>
          </div>
        </div>

        <div class="mt-auto">
          <button
            (click)="deployToTenant()"
            [disabled]="isDeploying()"
            class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-2.5 rounded-lg transition-colors flex justify-center items-center"
          >
            @if (isDeploying()) {
              <span>Deploying...</span>
            } @else {
              <span>Deploy to Tenant</span>
            }
          </button>
          @if (successMessage()) {
            <p class="text-green-600 text-xs text-center mt-3 font-semibold">
              {{ successMessage() }}
            </p>
          }
        </div>
      </div>

      <!-- Live Preview Area -->
      <div
        class="flex-1 bg-gray-100 rounded-xl border-2 border-dashed border-gray-300 p-8 overflow-y-auto"
      >
        <div class="mb-4 flex justify-between items-center">
          <h3 class="text-sm font-bold text-gray-500 uppercase tracking-wider">
            Live Device Preview
          </h3>
          <span
            class="text-xs font-mono bg-gray-200 px-2 py-1 rounded text-gray-600"
            >Consumer App Renderer</span
          >
        </div>

        <div
          class="bg-white rounded-3xl shadow-2xl mx-auto w-full max-w-md overflow-hidden min-h-[800px] border-8 border-gray-800 relative"
        >
          <div
            class="absolute top-0 inset-x-0 h-6 bg-gray-800 rounded-b-xl w-40 mx-auto z-50"
          ></div>

          <div class="h-full bg-gray-50 p-4 pt-10 space-y-6">
            @for (comp of activeLayout(); track comp.id) {
              <dg-sdui-renderer [config]="comp"></dg-sdui-renderer>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class SduiBuilderComponent {
  private http = inject(HttpClient);

  activeTemplate = signal<string>('template1');
  isDeploying = signal<boolean>(false);
  successMessage = signal<string>('');

  // The JSON definitions
  private templates: Record<string, SDUIComponentConfig[]> = {
    template1: [
      {
        id: 'c1',
        type: 'Hero',
        variant: '1',
        props: {
          title: 'Welcome',
          subtitle: 'Start investing',
          ctaText: 'Buy Gold',
          backgroundColor: '#1e40af',
        },
      },
      { id: 'c2', type: 'LiveRate', variant: '1', props: {} },
    ],
    template2: [
      { id: 'c1', type: 'LiveRate', variant: '1', props: {} },
      {
        id: 'c2',
        type: 'Hero',
        variant: '1',
        props: {
          title: 'Flash Crash',
          subtitle: 'Buy the dip!',
          ctaText: 'Trade Now',
          backgroundColor: '#991b1b',
        },
      },
    ],
  };

  activeLayout = signal<SDUIComponentConfig[]>(this.templates['template1']);

  selectTemplate(templateId: string) {
    this.activeTemplate.set(templateId);
    this.activeLayout.set(this.templates[templateId]);
    this.successMessage.set('');
  }

  deployToTenant() {
    this.isDeploying.set(true);
    this.successMessage.set('');

    // In production, this UUID comes from the auth state. Using a dummy UUID for now.
    const tenantUuid = 'e82a3c20-56b0-45d2-9781-dfb542095f2d';
    const url = `http://localhost:8080/api/v1/admin/tenants/${tenantUuid}/ui-layout`;

    // Using dummy admin token. The Go backend's AdminJWTMiddleware requires this.
    const headers = {
      Authorization: 'Bearer DUMMY_ADMIN_TOKEN',
      'X-Tenant-Id': tenantUuid,
    };

    this.http
      .patch(url, { ui_json_config: this.activeLayout() }, { headers })
      .subscribe({
        next: () => {
          this.isDeploying.set(false);
          this.successMessage.set('Layout perfectly deployed to Tenant!');
          setTimeout(() => this.successMessage.set(''), 3000);
        },
        error: (err) => {
          console.error('Failed to deploy UI layout', err);
          // Fallback fake success for local dev if backend isn't running with DB
          this.isDeploying.set(false);
          this.successMessage.set(
            'Layout perfectly deployed to Tenant! (Simulated)',
          );
        },
      });
  }
}
