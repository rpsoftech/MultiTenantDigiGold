import { Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import {
  SduiRendererComponent,
  SduiRegistryService,
  Hero1Component,
} from '@dg/ui';
import { SDUIComponentConfig } from '@dg/angular-core';

@Component({
  standalone: true,
  imports: [RouterModule, SduiRendererComponent],
  selector: 'app-root',
  template: `
    <main class="min-h-screen bg-gray-50 flex flex-col items-center p-8">
      <!-- 
        This is where the magic happens!
        The entire layout is rendered purely from the JSON below.
      -->
      <div class="w-full max-w-4xl space-y-8">
        @for (comp of pageLayout; track comp.id) {
          <dg-sdui-renderer [config]="comp"></dg-sdui-renderer>
        }
      </div>
    </main>
  `,
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private sduiRegistry = inject(SduiRegistryService);

  // In production, this JSON comes directly from the Go Backend (posgrest) based on the current X-Tenant-Id
  pageLayout: SDUIComponentConfig[] = [
    {
      id: 'comp_1',
      type: 'Hero',
      variant: '1',
      props: {
        title: 'DigiGold JSON Engine Active',
        subtitle:
          'This entire UI is being driven by a raw JSON tree from the backend.',
        ctaText: 'Start Trading Gold',
        backgroundColor: '#0f172a', // Tenant specific brand color injection
      },
    },
  ];

  ngOnInit() {
    // Register the component variants explicitly so the Tree-shaker doesn't strip them
    this.sduiRegistry.register('Hero_1', Hero1Component);
  }
}
