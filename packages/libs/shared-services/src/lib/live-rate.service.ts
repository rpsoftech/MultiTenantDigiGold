import {
  Injectable,
  signal,
  PLATFORM_ID,
  inject,
  DestroyRef,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { API_BASE_URL } from './tokens';

export interface GoldRate {
  buy_price: number;
  sell_price: number;
  timestamp: string;
}

@Injectable({
  providedIn: 'root',
})
export class LiveRateService {
  // Angular Signal to hold the absolute latest rate. UI updates will be surgical and instant!
  readonly currentRate = signal<GoldRate | null>(null);

  private eventSource: EventSource | null = null;
  private apiBase = inject(API_BASE_URL);
  private get STREAM_URL() {
    return `${this.apiBase}/api/v1/rates/stream`;
  }
  private platformId = inject(PLATFORM_ID);
  private destroyRef = inject(DestroyRef);
  private retryTimeout: any;

  constructor() {
    // ONLY connect to SSE in the Browser to prevent NodeJS SSR errors (EventSource is not defined on server)
    if (isPlatformBrowser(this.platformId)) {
      this.connectToSse();
      this.destroyRef.onDestroy(() => {
        if (this.retryTimeout) clearTimeout(this.retryTimeout);
        if (this.eventSource) this.eventSource.close();
      });
    }
  }

  private connectToSse() {
    this.eventSource = new EventSource(this.STREAM_URL);

    this.eventSource.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        this.currentRate.set({
          buy_price: data.ask, // Map to backend format
          sell_price: data.bid,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.error('[LiveRateService] Failed to parse SSE payload', err);
      }
    };

    this.eventSource.onerror = (err: any) => {
      console.error('[LiveRateService] SSE connection error. Retrying...', err);
      this.eventSource?.close();
      this.retryTimeout = setTimeout(() => this.connectToSse(), 5000);
    };
  }
}
