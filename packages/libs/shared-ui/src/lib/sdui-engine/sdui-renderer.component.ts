import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SDUIComponentConfig } from '@dg/angular-core';
import { SduiRegistryService } from './sdui-registry.service';

@Component({
  selector: 'dg-sdui-renderer',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (resolvedComponent) {
      <ng-container
        *ngComponentOutlet="resolvedComponent; inputs: componentInputs"
      ></ng-container>
    } @else {
      <!-- Optional skeletal loader could go here while the chunk is downloaded -->
    }

    <!-- Render children recursively if they exist -->
    @if (config?.children && config!.children!.length > 0) {
      <div class="sdui-children-container">
        @for (child of config!.children; track child.id) {
          <dg-sdui-renderer [config]="child"></dg-sdui-renderer>
        }
      </div>
    }
  `,
})
export class SduiRendererComponent implements OnInit {
  @Input({ required: true }) config!: SDUIComponentConfig;

  private registry = inject(SduiRegistryService);

  resolvedComponent: any = null;
  componentInputs: Record<string, unknown> = {};

  async ngOnInit() {
    if (this.config) {
      const loader = this.registry.getComponentLoader(
        this.config.type,
        this.config.variant,
      );
      if (loader) {
        try {
          this.resolvedComponent = await loader();
          // Pass the props as @Input bindings to the resolved component
          this.componentInputs = { ...this.config.props };
        } catch (err) {
          console.error(
            `[SDUI] Failed to lazy load chunk for: ${this.config.type}_${this.config.variant}`,
            err,
          );
        }
      } else {
        console.warn(
          `[SDUI] Component not found in registry: ${this.config.type}_${this.config.variant}`,
        );
      }
    }
  }
}
