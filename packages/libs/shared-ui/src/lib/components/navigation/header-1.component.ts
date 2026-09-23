import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'dg-header-1',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="w-full bg-white shadow-sm sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <!-- Logo & Brand -->
          <div class="flex-shrink-0 flex items-center cursor-pointer">
            @if (logoUrl) {
              <img [src]="logoUrl" alt="Brand Logo" class="h-8 w-auto mr-2" />
            }
            <span
              class="font-black text-2xl tracking-tight"
              [ngStyle]="{ color: primaryColor }"
            >
              {{ brandName }}
            </span>
          </div>

          <!-- Desktop Navigation -->
          <nav class="hidden md:flex space-x-8">
            <a
              href="#"
              class="text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >Home</a
            >
            <a
              href="#"
              class="text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >Portfolio</a
            >
            <a
              href="#"
              class="text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >SIP</a
            >
            <a
              href="#"
              class="text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >Delivery</a
            >
          </nav>

          <!-- User Actions -->
          <div class="flex items-center space-x-4">
            <button class="text-gray-500 hover:text-gray-900 p-2 relative">
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
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              <!-- Notification Dot -->
              <span
                class="absolute top-1.5 right-1.5 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white"
              ></span>
            </button>

            <button
              class="hidden md:inline-flex items-center justify-center px-6 py-2.5 border border-transparent text-sm font-bold rounded-full text-white shadow-md transition-all hover:shadow-lg transform hover:-translate-y-0.5"
              [ngStyle]="{ 'background-color': primaryColor }"
            >
              Login
            </button>

            <!-- Mobile menu button -->
            <button class="md:hidden text-gray-500 p-2">
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
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  `,
})
export class Header1Component {
  @Input() brandName: string = 'DIGIGOLD';
  @Input() logoUrl?: string;
  @Input() primaryColor: string = '#d97706'; // Default Amber-600
}
