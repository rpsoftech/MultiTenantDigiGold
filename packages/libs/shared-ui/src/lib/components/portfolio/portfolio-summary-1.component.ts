import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LiveRateService } from '@dg/services';

@Component({
  selector: 'dg-portfolio-summary-1',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="w-full bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden"
    >
      <!-- Decorative background blur -->
      <div
        class="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-yellow-500 opacity-20 blur-2xl"
      ></div>

      <div class="relative z-10 flex flex-col h-full justify-between">
        <div class="flex justify-between items-start mb-6">
          <div>
            <p class="text-slate-400 text-sm font-medium tracking-wide mb-1">
              Total Gold Balance
            </p>
            <div class="flex items-baseline gap-2">
              <h2 class="text-4xl font-black">
                {{ goldGrams | number: '1.4-4' }}
              </h2>
              <span class="text-yellow-500 font-bold">gm</span>
            </div>
          </div>
          <div
            class="bg-slate-800/80 backdrop-blur-sm border border-slate-700 px-3 py-1.5 rounded-full flex items-center gap-2 shadow-inner"
          >
            <span
              class="w-2 h-2 rounded-full bg-green-400 animate-pulse"
            ></span>
            <span class="text-xs font-semibold text-slate-300">24K 99.99%</span>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4 pt-6 border-t border-slate-700/50">
          <div>
            <p
              class="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1"
            >
              Current Value
            </p>
            @if (rateSignal()) {
              <p class="text-xl font-bold text-white">
                ₹{{ goldGrams * rateSignal()!.sell_price | number: '1.2-2' }}
              </p>
            } @else {
              <p class="text-xl font-bold text-slate-500">Loading...</p>
            }
          </div>
          <div>
            <p
              class="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1"
            >
              Total Returns
            </p>
            <p class="text-xl font-bold text-green-400 flex items-center gap-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="3"
                  d="M5 10l7-7m0 0l7 7m-7-7v18"
                />
              </svg>
              12.4%
            </p>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class PortfolioSummary1Component {
  private rateService = inject(LiveRateService);
  rateSignal = this.rateService.currentRate;

  // In a real app, this would be an Input or fetched from a PortfolioService Signal
  @Input() goldGrams: number = 42.5832;
}
