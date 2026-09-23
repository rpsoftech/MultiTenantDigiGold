import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SDUIComponentConfig } from '@dg/angular-core';
import { SduiRegistryService } from './sdui-registry.service';

@Component({
  selector: 'dg-sdui-renderer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <ng-container
      *ngComponentOutlet="resolvedComponent; inputs: componentInputs"
    ></ng-container>

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

  ngOnInit() {
    if (this.config) {
      this.resolvedComponent = this.registry.getComponent(
        this.config.type,
        this.config.variant,
      );
      if (!this.resolvedComponent) {
        console.warn(
          `[SDUI] Component not found in registry: ${this.config.type}_${this.config.variant}`,
        );
      }
      // Pass the props as @Input bindings to the resolved component
      this.componentInputs = { ...this.config.props };
    }
  }
}
