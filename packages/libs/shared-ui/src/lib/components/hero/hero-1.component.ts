import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'dg-hero-1',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="relative bg-gray-900 text-white overflow-hidden py-20 px-6 sm:px-12 rounded-xl shadow-2xl"
      [ngStyle]="{ 'background-color': backgroundColor }"
    >
      <div class="relative z-10 max-w-2xl">
        <h1 class="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
          {{ title }}
        </h1>
        <p class="text-lg sm:text-xl text-gray-300 mb-8">{{ subtitle }}</p>
        <button
          class="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 px-8 rounded-full transition-transform transform hover:scale-105"
        >
          {{ ctaText }}
        </button>
      </div>
      <!-- Background decorative element -->
      <div
        class="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-white opacity-5 blur-3xl pointer-events-none"
      ></div>
    </div>
  `,
})
export class Hero1Component {
  @Input() title: string = 'Invest in 24K Digital Gold';
  @Input() subtitle: string = 'Secure, transparent, and instantly redeemable.';
  @Input() ctaText: string = 'Start Trading';
  @Input() backgroundColor?: string;
}
