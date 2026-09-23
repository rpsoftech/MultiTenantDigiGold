import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TradeService, LiveRateService, AuthService } from '@dg/services';

@Component({
  selector: 'dg-trade-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (isOpen()) {
      <div
        class="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4 transition-all duration-300"
      >
        <div
          class="bg-white w-full sm:w-[420px] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden transform transition-all duration-300 relative"
        >
          <button
            (click)="isOpen.set(false)"
            class="absolute top-4 right-4 p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition-colors z-10"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          <!-- Action Toggle -->
          <div class="flex border-b border-slate-100">
            <button
              (click)="action.set('BUY')"
              class="flex-1 py-4 text-center font-black text-lg transition-colors border-b-2"
              [class.text-green-600]="action() === 'BUY'"
              [class.border-green-600]="action() === 'BUY'"
              [class.text-slate-400]="action() !== 'BUY'"
              [class.border-transparent]="action() !== 'BUY'"
            >
              Buy Gold
            </button>
            <button
              (click)="action.set('SELL')"
              class="flex-1 py-4 text-center font-black text-lg transition-colors border-b-2"
              [class.text-red-500]="action() === 'SELL'"
              [class.border-red-500]="action() === 'SELL'"
              [class.text-slate-400]="action() !== 'SELL'"
              [class.border-transparent]="action() !== 'SELL'"
            >
              Sell Gold
            </button>
          </div>

          <div class="p-6">
            <!-- Live Rate Display -->
            <div
              class="flex justify-between items-center mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100"
            >
              <div class="flex items-center gap-2">
                <span
                  class="w-2 h-2 rounded-full bg-green-500 animate-pulse"
                ></span>
                <span
                  class="text-xs font-bold text-slate-500 uppercase tracking-wider"
                  >Live Rate / gm</span
                >
              </div>
              <div class="text-xl font-black text-slate-800">
                ₹{{ currentRateStr() }}
              </div>
            </div>

            <!-- Input Mode Toggle -->
            <div class="flex bg-slate-100 rounded-lg p-1 mb-6">
              <button
                (click)="inputMode.set('INR')"
                class="flex-1 py-1.5 text-sm font-bold rounded-md transition-all"
                [class.bg-white]="inputMode() === 'INR'"
                [class.shadow-sm]="inputMode() === 'INR'"
                [class.text-slate-800]="inputMode() === 'INR'"
                [class.text-slate-500]="inputMode() !== 'INR'"
              >
                In Rupees
              </button>
              <button
                (click)="inputMode.set('GRAMS')"
                class="flex-1 py-1.5 text-sm font-bold rounded-md transition-all"
                [class.bg-white]="inputMode() === 'GRAMS'"
                [class.shadow-sm]="inputMode() === 'GRAMS'"
                [class.text-slate-800]="inputMode() === 'GRAMS'"
                [class.text-slate-500]="inputMode() !== 'GRAMS'"
              >
                In Grams
              </button>
            </div>

            <!-- Dynamic Input -->
            <div class="mb-6">
              <div class="relative">
                <span
                  class="absolute left-4 top-3.5 text-slate-400 font-bold text-xl"
                >
                  {{ inputMode() === 'INR' ? '₹' : '' }}
                </span>

                <input
                  type="number"
                  [ngModel]="displayValue()"
                  (ngModelChange)="onInputChange($event)"
                  [placeholder]="inputMode() === 'INR' ? '1000' : '0.1500'"
                  class="w-full px-8 py-3 bg-white border-2 rounded-xl focus:ring-0 focus:outline-none transition-all font-black text-slate-800 text-2xl text-center"
                  [class.border-green-500]="action() === 'BUY'"
                  [class.border-red-400]="action() === 'SELL'"
                  [class.border-slate-200]="!displayValue()"
                />

                <span class="absolute right-4 top-4 text-slate-400 font-bold">
                  {{ inputMode() === 'GRAMS' ? 'gm' : '' }}
                </span>
              </div>

              <!-- Equivalent Value Text -->
              <p class="text-center text-sm font-semibold mt-3 text-slate-500">
                @if (displayValue() > 0) {
                  Equivalent to
                  <span class="text-slate-800 font-black">
                    {{
                      inputMode() === 'INR'
                        ? (grams() | number: '1.4-4') + ' gm'
                        : '₹' + (inr() | number: '1.2-2')
                    }}
                  </span>
                } @else {
                  Enter an amount to continue
                }
              </p>
            </div>

            <!-- Execution Button -->
            <button
              (click)="executeTrade()"
              [disabled]="inr() <= 0 || isLoading()"
              class="w-full py-4 text-white font-black text-lg rounded-xl shadow-md transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex justify-center items-center"
              [class.bg-green-600]="action() === 'BUY'"
              [class.hover:bg-green-700]="action() === 'BUY'"
              [class.bg-red-500]="action() === 'SELL'"
              [class.hover:bg-red-600]="action() === 'SELL'"
            >
              @if (isLoading()) {
                <span class="animate-pulse">Processing...</span>
              } @else {
                {{ action() === 'BUY' ? 'Quick Buy' : 'Confirm Sell' }}
              }
            </button>

            @if (errorMsg()) {
              <p class="text-red-500 text-sm font-bold text-center mt-3">
                {{ errorMsg() }}
              </p>
            }

            <p
              class="text-[10px] text-center text-slate-400 mt-4 font-medium uppercase tracking-wider"
            >
              Prices lock automatically for 3 seconds before execution
            </p>
          </div>
        </div>
      </div>
    }
  `,
})
export class TradeModalComponent {
  private tradeService = inject(TradeService);
  private liveRate = inject(LiveRateService);
  private auth = inject(AuthService);

  isOpen = this.tradeService.isTradeModalOpen;
  action = this.tradeService.tradeAction;
  inputMode = signal<'INR' | 'GRAMS'>('INR');

  // The raw numeric value typed by the user
  displayValue = signal<number>(0);

  isLoading = signal(false);
  errorMsg = signal('');

  currentRateStr = computed(() => {
    const rate = this.liveRate.currentRate();
    if (!rate) return '0.00';
    return this.action() === 'BUY'
      ? rate.buy_price.toFixed(2)
      : rate.sell_price.toFixed(2);
  });

  currentRateNum = computed(() => {
    const rate = this.liveRate.currentRate();
    if (!rate) return 0;
    return this.action() === 'BUY' ? rate.buy_price : rate.sell_price;
  });

  inr = computed(() => {
    if (this.inputMode() === 'INR') return this.displayValue();
    return this.displayValue() * this.currentRateNum();
  });

  grams = computed(() => {
    if (this.currentRateNum() === 0) return 0;
    if (this.inputMode() === 'GRAMS') return this.displayValue();
    return this.displayValue() / this.currentRateNum();
  });

  onInputChange(val: number) {
    this.displayValue.set(val || 0);
    this.errorMsg.set('');
  }

  async executeTrade() {
    if (!this.auth.state().isAuthenticated) {
      this.isOpen.set(false);
      this.auth.isLoginModalOpen.set(true);
      return;
    }

    this.isLoading.set(true);
    this.errorMsg.set('');

    try {
      const payload = {
        requested_rate_per_gram: this.currentRateNum(),
        weight_grams: Number(this.grams().toFixed(4)),
        total_amount_inr: Number(this.inr().toFixed(2)),
        payment_mode: 'ONLINE_PG' as const,
      };

      if (this.action() === 'BUY') {
        const res = await this.tradeService.initiateBuy(payload);
        // Normally redirect to PG here. For now we simulate success.
        alert(`Buy Initiated! Order ID: ${res.order_id}`);
      } else {
        const res = await this.tradeService.executeSell(payload);
        alert(`Sell Executed! Transaction: ${res.transaction_id}`);
      }

      this.isOpen.set(false);
      this.displayValue.set(0);
    } catch (e: any) {
      this.errorMsg.set(e?.error?.message || 'Trade Execution Failed');
    }

    this.isLoading.set(false);
  }
}
