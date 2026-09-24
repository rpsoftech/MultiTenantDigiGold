import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { TenantConfigService } from './tenant-config.service';
import { API_BASE_URL } from './tokens';

export interface AuthState {
  isAuthenticated: boolean;
  user: { phone: string; fullName?: string } | null;
  token: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private tenantService = inject(TenantConfigService);
  private apiBase = inject(API_BASE_URL);
  private platformId = inject(PLATFORM_ID);

  private get API_URL() {
    return `${this.apiBase}/api/v1/auth`;
  }

  public isLoginModalOpen = signal<boolean>(false);
  public isKycModalOpen = signal<boolean>(false);

  public state = signal<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
  });

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('dg_token');
      const phone = localStorage.getItem('dg_phone');
      if (token && phone) {
        this.state.set({ isAuthenticated: true, user: { phone }, token });
      }
    }
  }

  private get headers() {
    return {
      'X-Tenant-Id': this.tenantService.config()?.tenant_uuid || 'fallback',
    };
  }

  async requestOtp(phone: string) {
    return firstValueFrom(
      this.http.post<{
        success: boolean;
        is_registered: boolean;
        message: string;
      }>(`${this.API_URL}/otp/request`, { phone }, { headers: this.headers }),
    );
  }

  async verifyOtp(phone: string, otp: string) {
    const res = await firstValueFrom(
      this.http.post<{
        success: boolean;
        is_registered: boolean;
        access_token?: string;
        registration_token?: string;
      }>(
        `${this.API_URL}/otp/verify`,
        { phone, otp },
        { headers: this.headers },
      ),
    );

    if (res.is_registered && res.access_token) {
      this.state.set({
        isAuthenticated: true,
        user: { phone },
        token: res.access_token,
      });
      if (isPlatformBrowser(this.platformId)) {
        localStorage.setItem('dg_token', res.access_token);
        localStorage.setItem('dg_phone', phone);
      }
    }

    return res;
  }

  async register(
    registration_token: string,
    full_name: string,
    phone: string,
    location: string = 'India',
  ) {
    const res = await firstValueFrom(
      this.http.post<{ success: boolean; access_token: string }>(
        `${this.API_URL}/register`,
        { registration_token, full_name, location },
        { headers: this.headers },
      ),
    );

    if (res.access_token) {
      this.state.set({
        isAuthenticated: true,
        user: { phone, fullName: full_name },
        token: res.access_token,
      });
      if (isPlatformBrowser(this.platformId)) {
        localStorage.setItem('dg_token', res.access_token);
        localStorage.setItem('dg_phone', phone);
      }
    }

    return res;
  }

  logout() {
    this.state.set({
      isAuthenticated: false,
      user: null,
      token: null,
    });
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('dg_token');
      localStorage.removeItem('dg_phone');
    }
  }
}
