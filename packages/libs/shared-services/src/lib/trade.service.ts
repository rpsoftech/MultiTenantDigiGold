import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { TenantConfigService } from './tenant-config.service';
import { API_BASE_URL } from './tokens';

export interface TradeExecutionRequest {
  action: 'BUY' | 'SELL';
  requested_rate_per_gram: number;
  weight_grams: number;
  total_amount_inr: number;
  payment_mode: 'ONLINE_PG' | 'COUNTER_CASH' | 'COUNTER_UPI';
}

@Injectable({
  providedIn: 'root',
})
export class TradeService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private tenant = inject(TenantConfigService);
  private apiBase = inject(API_BASE_URL);

  public isTradeModalOpen = signal(false);
  public tradeAction = signal<'BUY' | 'SELL'>('BUY');

  private get API_URL() {
    return `${this.apiBase}/api/v1/trade`;
  }

  private get headers() {
    return {
      'X-Tenant-Id': this.tenant.config()?.tenant_uuid || 'fallback',
      Authorization: `Bearer ${this.auth.state().token || ''}`,
    };
  }

  async initiateBuy(req: Omit<TradeExecutionRequest, 'action'>) {
    return firstValueFrom(
      this.http.post<{
        success: boolean;
        order_id: string;
        pg_order_id?: string;
      }>(
        `${this.API_URL}/buy/initiate`,
        { ...req, action: 'BUY' },
        { headers: this.headers },
      ),
    );
  }

  async executeSell(req: Omit<TradeExecutionRequest, 'action'>) {
    return firstValueFrom(
      this.http.post<{ success: boolean; transaction_id: string }>(
        `${this.API_URL}/sell`,
        { ...req, action: 'SELL' },
        { headers: this.headers },
      ),
    );
  }
}
