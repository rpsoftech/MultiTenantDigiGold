import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'dg-quick-actions-1',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="grid grid-cols-4 gap-4 w-full p-4 bg-white rounded-2xl shadow-sm border border-gray-100"
    >
      <!-- BUY -->
      <button
        class="flex flex-col items-center justify-center gap-3 p-2 group transition-transform active:scale-95"
      >
        <div
          class="w-14 h-14 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center group-hover:bg-green-100 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-7 w-7"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
        </div>
        <span class="text-xs font-semibold text-gray-700">Buy</span>
      </button>

      <!-- SELL -->
      <button
        class="flex flex-col items-center justify-center gap-3 p-2 group transition-transform active:scale-95"
      >
        <div
          class="w-14 h-14 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center group-hover:bg-red-100 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-7 w-7"
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
        <span class="text-xs font-semibold text-gray-700">Sell</span>
      </button>

      <!-- SIP -->
      <button
        class="flex flex-col items-center justify-center gap-3 p-2 group transition-transform active:scale-95"
      >
        <div
          class="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-100 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-7 w-7"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
        <span class="text-xs font-semibold text-gray-700">Auto SIP</span>
      </button>

      <!-- DELIVERY -->
      <button
        class="flex flex-col items-center justify-center gap-3 p-2 group transition-transform active:scale-95"
      >
        <div
          class="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-purple-100 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-7 w-7"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
        </div>
        <span class="text-xs font-semibold text-gray-700">Delivery</span>
      </button>
    </div>
  `,
})
export class QuickActions1Component {
  // Can accept JSON props to hide/show specific buttons or change their links!
  @Input() showDelivery: boolean = true;
}
