import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  standalone: true,
  selector: 'dg-admin-layout',
  imports: [RouterModule],
  template: `
    <div class="flex h-screen bg-gray-50 font-sans text-gray-900">
      <!-- Sidebar -->
      <aside class="w-64 bg-slate-900 text-white flex flex-col">
        <div class="h-16 flex items-center px-6 border-b border-slate-800">
          <span class="text-2xl font-bold tracking-wider text-yellow-500"
            >DIGI<span class="text-white">GOLD</span></span
          >
          <span
            class="ml-2 text-xs font-semibold bg-blue-600 px-2 py-0.5 rounded-full"
            >ADMIN</span
          >
        </div>
        <nav class="flex-1 overflow-y-auto py-4">
          <ul class="space-y-1 px-3">
            <li>
              <a
                routerLink="/dashboard"
                routerLinkActive="bg-slate-800 text-white"
                class="flex items-center px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <svg
                  class="w-5 h-5 mr-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                  />
                </svg>
                Dashboard
              </a>
            </li>
            <li>
              <a
                routerLink="/kyc"
                routerLinkActive="bg-slate-800 text-white"
                class="flex items-center px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <svg
                  class="w-5 h-5 mr-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
                KYC Verifications
              </a>
            </li>
            <li>
              <a
                routerLink="/sdui-builder"
                routerLinkActive="bg-slate-800 text-white"
                class="flex items-center px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <svg
                  class="w-5 h-5 mr-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                  />
                </svg>
                UI Builder
              </a>
            </li>
          </ul>
        </nav>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 flex flex-col min-w-0 overflow-hidden">
        <!-- Header -->
        <header
          class="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6"
        >
          <h1 class="text-xl font-semibold text-gray-800">Admin Portal</h1>
          <div class="flex items-center gap-4">
            <span class="text-sm font-medium text-gray-600">Master Admin</span>
            <div
              class="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold"
            >
              A
            </div>
          </div>
        </header>

        <!-- Dynamic Page Content -->
        <div class="flex-1 overflow-y-auto p-6">
          <router-outlet></router-outlet>
        </div>
      </main>
    </div>
  `,
})
export class AdminLayoutComponent {}
