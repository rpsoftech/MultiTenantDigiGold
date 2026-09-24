import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '@dg/services';

@Component({
  selector: 'dg-kyc-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (isOpen()) {
      <div
        class="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 transition-all duration-300"
      >
        <div
          class="bg-white w-full sm:w-[450px] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden transform transition-all duration-300 relative"
        >
          <button
            (click)="isOpen.set(false)"
            class="absolute top-4 right-4 p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors z-10"
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

          <div class="bg-slate-50 p-6 sm:p-8 border-b border-gray-100">
            <div
              class="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-4"
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
                  d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"
                />
              </svg>
            </div>
            <h2 class="text-2xl font-black text-slate-800 tracking-tight">
              Complete KYC
            </h2>
            <p class="text-sm text-slate-500 mt-2 font-medium">
              As per RBI guidelines, PAN card verification is mandatory for
              transactions above ₹2,00,000.
            </p>
          </div>

          <div class="p-6 sm:p-8 space-y-5">
            <div>
              <label class="block text-sm font-bold text-slate-700 mb-1"
                >PAN Number</label
              >
              <input
                type="text"
                [(ngModel)]="panNumber"
                maxlength="10"
                placeholder="ABCDE1234F"
                class="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-bold text-slate-800 uppercase"
              />
            </div>

            <div>
              <label class="block text-sm font-bold text-slate-700 mb-1"
                >Upload Document (Optional for instant API)</label
              >
              <div
                class="w-full border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-8 w-8 mx-auto text-slate-400 mb-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
                <span class="text-sm font-semibold text-blue-600"
                  >Click to upload</span
                >
                <span class="text-xs text-slate-500 block mt-1"
                  >PNG, JPG, PDF up to 5MB</span
                >
              </div>
            </div>

            <button
              (click)="submitKyc()"
              [disabled]="panNumber().length !== 10 || isLoading()"
              class="w-full py-4 bg-blue-600 text-white font-bold rounded-xl shadow-md transition-all active:scale-[0.98] disabled:opacity-50 flex justify-center items-center hover:bg-blue-700"
            >
              @if (isLoading()) {
                <span class="animate-pulse">Verifying...</span>
              } @else {
                Verify Automatically
              }
            </button>

            @if (errorMsg()) {
              <p class="text-red-500 text-sm font-bold text-center mt-2">
                {{ errorMsg() }}
              </p>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class KycModalComponent {
  public auth = inject(AuthService);

  // In a real app this would be triggered via a signal or a service call
  isOpen = this.auth.isKycModalOpen;

  panNumber = signal('');
  isLoading = signal(false);
  errorMsg = signal('');

  async submitKyc() {
    this.isLoading.set(true);
    // Fake delay
    await new Promise((r) => setTimeout(r, 1500));
    this.isLoading.set(false);
    this.isOpen.set(false);
  }
}
