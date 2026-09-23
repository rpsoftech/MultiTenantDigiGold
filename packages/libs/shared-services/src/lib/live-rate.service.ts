import {
  Injectable,
  signal,
  OnDestroy,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface GoldRate {
  buy_price: number;
  sell_price: number;
  timestamp: string;
}

@Injectable({
  providedIn: 'root',
})
export class LiveRateService implements OnDestroy {
  // Angular Signal to hold the absolute latest rate. UI updates will be surgical and instant!
  readonly currentRate = signal<GoldRate | null>(null);

  private eventSource: EventSource | null = null;
  private readonly STREAM_URL = 'http://localhost:8080/api/v1/rates/stream'; // Base URL can be dynamic via env
  private platformId = inject(PLATFORM_ID);

  constructor() {
    // ONLY connect to SSE in the Browser to prevent NodeJS SSR errors (EventSource is not defined on server)
    if (isPlatformBrowser(this.platformId)) {
      this.connectToSse();
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
    };
  }

  ngOnDestroy() {
    if (this.eventSource) {
      this.eventSource.close();
    }
  }
}
