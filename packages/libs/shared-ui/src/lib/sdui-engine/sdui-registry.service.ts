import { Injectable, Type } from '@angular/core';
import { SDUI_MANIFEST } from './sdui-manifest';

export type ComponentLoader = () => Promise<Type<any>>;

@Injectable({
  providedIn: 'root',
})
export class SduiRegistryService {
  private registry = new Map<string, ComponentLoader>();

  constructor() {
    // Auto-register all known variants from the manifest
    Object.entries(SDUI_MANIFEST).forEach(([key, loader]) => {
      this.registry.set(key, loader);
    });
  }

  register(componentKey: string, loader: ComponentLoader) {
    this.registry.set(componentKey, loader);
  }

  getComponentLoader(type: string, variant: string): ComponentLoader | null {
    const key = `${type}_${variant}`;
    return this.registry.get(key) || null;
  }
}
