import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TenantConfigService } from './tenant-config.service';

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

  // The API URL will route to our Go Backend
  private API_URL = 'http://localhost:8080/api/v1/auth';

  public isLoginModalOpen = signal<boolean>(false);

  public state = signal<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
  });

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
      // In production, save to localStorage here
    }

    return res;
  }

  async register(
    registration_token: string,
    full_name: string,
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
        user: { phone: '...', fullName: full_name },
        token: res.access_token,
      });
    }

    return res;
  }

  logout() {
    this.state.set({
      isAuthenticated: false,
      user: null,
      token: null,
    });
  }
}
