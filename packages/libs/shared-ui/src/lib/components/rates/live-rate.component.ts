import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LiveRateService } from '@dg/services';

@Component({
  selector: 'dg-live-rate',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="bg-white shadow-xl rounded-2xl p-6 border border-gray-100 flex flex-col md:flex-row justify-between items-center transition-all"
    >
      <div class="flex items-center gap-4 mb-4 md:mb-0">
        <div
          class="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div>
          <h3 class="text-xl font-bold text-gray-800">24K Digital Gold</h3>
          <p class="text-sm text-gray-500">Live Market Rates</p>
        </div>
      </div>

      <div class="flex gap-8 text-center">
        <div class="flex flex-col">
          <span
            class="text-sm font-semibold text-gray-500 uppercase tracking-wider"
            >Buy Price</span
          >
          @if (rateSignal()) {
            <span class="text-2xl font-black text-green-600 animate-pulse"
              >₹{{ rateSignal()?.buy_price | number: '1.2-2' }}</span
            >
          } @else {
            <span class="text-2xl font-black text-gray-300">Loading...</span>
          }
        </div>

        <div class="flex flex-col">
          <span
            class="text-sm font-semibold text-gray-500 uppercase tracking-wider"
            >Sell Price</span
          >
          @if (rateSignal()) {
            <span class="text-2xl font-black text-red-500"
              >₹{{ rateSignal()?.sell_price | number: '1.2-2' }}</span
            >
          } @else {
            <span class="text-2xl font-black text-gray-300">Loading...</span>
          }
        </div>
      </div>
    </div>
  `,
})
export class LiveRateComponent {
  private rateService = inject(LiveRateService);

  // Expose the signal directly to the template
  rateSignal = this.rateService.currentRate;
}
