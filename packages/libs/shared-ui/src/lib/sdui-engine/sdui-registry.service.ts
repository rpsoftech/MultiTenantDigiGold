import { Injectable, Type } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SduiRegistryService {
  private registry = new Map<string, Type<any>>();

  register(componentKey: string, componentClass: Type<any>) {
    this.registry.set(componentKey, componentClass);
  }

  getComponent(type: string, variant: string): Type<any> | null {
    const key = `${type}_${variant}`;
    return this.registry.get(key) || null;
  }
}
