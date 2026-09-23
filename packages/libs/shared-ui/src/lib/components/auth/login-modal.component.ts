import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, TenantConfigService } from '@dg/services';

@Component({
  selector: 'dg-login-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (auth.isLoginModalOpen()) {
      <div
        class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 transition-all duration-300"
      >
        <!-- Modal Container -->
        <div
          class="bg-white w-full sm:w-[400px] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden transform transition-all duration-300 translate-y-0 sm:scale-100 relative"
        >
          <!-- Close Button -->
          <button
            (click)="auth.isLoginModalOpen.set(false)"
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

          <!-- Header -->
          <div
            class="bg-slate-50 p-6 sm:p-8 text-center border-b border-gray-100"
          >
            <h2 class="text-2xl font-black text-slate-800 tracking-tight">
              Welcome to
              <span [style.color]="primaryColor">{{
                tenant.config()?.full_name || 'DigiGold'
              }}</span>
            </h2>
            <p class="text-sm text-slate-500 mt-2 font-medium">
              Log in to track your portfolio
            </p>
          </div>

          <!-- Body -->
          <div class="p-6 sm:p-8">
            @if (step() === 'PHONE') {
              <div class="space-y-4">
                <label class="block text-sm font-bold text-slate-700"
                  >Mobile Number</label
                >
                <div class="flex relative">
                  <span class="absolute left-4 top-3.5 text-slate-500 font-bold"
                    >+91</span
                  >
                  <input
                    type="tel"
                    [(ngModel)]="phone"
                    maxlength="10"
                    placeholder="Enter 10-digit number"
                    class="w-full pl-14 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all font-semibold text-slate-800 text-lg placeholder:font-normal placeholder:text-base placeholder:text-slate-400"
                  />
                </div>

                <button
                  (click)="requestOtp()"
                  [disabled]="phone().length !== 10 || isLoading()"
                  class="w-full py-4 text-white font-bold rounded-xl mt-4 shadow-md transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex justify-center items-center"
                  [style.backgroundColor]="primaryColor"
                >
                  @if (isLoading()) {
                    <span class="animate-pulse">Sending OTP...</span>
                  } @else {
                    Continue with OTP
                  }
                </button>
              </div>
            }

            @if (step() === 'OTP') {
              <div class="space-y-4">
                <div class="flex justify-between items-center mb-2">
                  <label class="block text-sm font-bold text-slate-700"
                    >Enter OTP</label
                  >
                  <button
                    (click)="step.set('PHONE')"
                    class="text-xs font-bold text-blue-600 hover:underline"
                  >
                    Change Number
                  </button>
                </div>
                <p class="text-xs text-slate-500 font-medium mb-4">
                  Sent to +91 {{ phone() }}
                </p>

                <input
                  type="text"
                  [(ngModel)]="otp"
                  maxlength="6"
                  placeholder="• • • • • •"
                  class="w-full text-center tracking-[1em] px-4 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all font-black text-slate-800 text-2xl placeholder:font-normal placeholder:tracking-normal placeholder:text-base placeholder:text-slate-400"
                />

                <button
                  (click)="verifyOtp()"
                  [disabled]="otp().length !== 6 || isLoading()"
                  class="w-full py-4 text-white font-bold rounded-xl mt-4 shadow-md transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex justify-center items-center"
                  [style.backgroundColor]="primaryColor"
                >
                  @if (isLoading()) {
                    <span class="animate-pulse">Verifying...</span>
                  } @else {
                    Verify & Login
                  }
                </button>
              </div>
            }

            @if (step() === 'REGISTER') {
              <div class="space-y-4">
                <label class="block text-sm font-bold text-slate-700"
                  >Full Name</label
                >
                <input
                  type="text"
                  [(ngModel)]="fullName"
                  placeholder="As per PAN Card"
                  class="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all font-semibold text-slate-800"
                />

                <button
                  (click)="registerUser()"
                  [disabled]="!fullName() || isLoading()"
                  class="w-full py-4 text-white font-bold rounded-xl mt-4 shadow-md transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex justify-center items-center"
                  [style.backgroundColor]="primaryColor"
                >
                  @if (isLoading()) {
                    <span class="animate-pulse">Creating Account...</span>
                  } @else {
                    Complete Registration
                  }
                </button>
              </div>
            }

            @if (errorMsg()) {
              <p
                class="text-red-500 text-sm font-bold text-center mt-4 bg-red-50 p-2 rounded-lg border border-red-100"
              >
                {{ errorMsg() }}
              </p>
            }
          </div>

          <div
            class="bg-slate-50 p-4 text-center border-t border-gray-100 text-xs text-slate-400 font-medium"
          >
            By continuing, you agree to our Terms of Service.
          </div>
        </div>
      </div>
    }
  `,
})
export class LoginModalComponent {
  public auth = inject(AuthService);
  public tenant = inject(TenantConfigService);

  step = signal<'PHONE' | 'OTP' | 'REGISTER'>('PHONE');
  phone = signal('');
  otp = signal('');
  fullName = signal('');

  isLoading = signal(false);
  errorMsg = signal('');

  private registrationToken = '';

  get primaryColor() {
    // If we wanted we could parse this from the UI JSON, but we can hardcode for now
    return '#d97706';
  }

  async requestOtp() {
    this.isLoading.set(true);
    this.errorMsg.set('');
    try {
      await this.auth.requestOtp(this.phone());
      this.step.set('OTP');
    } catch (e: any) {
      this.errorMsg.set(e?.error?.message || 'Failed to request OTP');
    }
    this.isLoading.set(false);
  }

  async verifyOtp() {
    this.isLoading.set(true);
    this.errorMsg.set('');
    try {
      const res = await this.auth.verifyOtp(this.phone(), this.otp());
      if (res.is_registered) {
        // Successfully logged in! Close modal.
        this.auth.isLoginModalOpen.set(false);
        this.reset();
      } else {
        // Needs registration
        this.registrationToken = res.registration_token || '';
        this.step.set('REGISTER');
      }
    } catch (e: any) {
      this.errorMsg.set(e?.error?.message || 'Invalid OTP');
    }
    this.isLoading.set(false);
  }

  async registerUser() {
    this.isLoading.set(true);
    this.errorMsg.set('');
    try {
      await this.auth.register(this.registrationToken, this.fullName());
      this.auth.isLoginModalOpen.set(false);
      this.reset();
    } catch (e: any) {
      this.errorMsg.set(e?.error?.message || 'Registration failed');
    }
    this.isLoading.set(false);
  }

  reset() {
    this.step.set('PHONE');
    this.phone.set('');
    this.otp.set('');
    this.fullName.set('');
    this.errorMsg.set('');
  }
}
