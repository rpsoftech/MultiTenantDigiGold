import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '@dg/services';

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
            @if (auth.state().isAuthenticated) {
              <div class="flex items-center gap-3">
                <span class="text-sm font-bold text-slate-700 hidden sm:block">
                  Hi,
                  {{ auth.state().user?.fullName || auth.state().user?.phone }}
                </span>
                <button
                  (click)="auth.logout()"
                  class="text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-full transition-colors"
                >
                  Logout
                </button>
              </div>
            } @else {
              <button
                (click)="auth.isLoginModalOpen.set(true)"
                class="hidden md:inline-flex items-center justify-center px-6 py-2.5 border border-transparent text-sm font-bold rounded-full text-white shadow-md transition-all hover:shadow-lg transform hover:-translate-y-0.5"
                [ngStyle]="{ 'background-color': primaryColor }"
              >
                Login
              </button>
            }

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
  public auth = inject(AuthService);

  @Input() brandName: string = 'DIGIGOLD';
  @Input() logoUrl?: string;
  @Input() primaryColor: string = '#d97706';
}
