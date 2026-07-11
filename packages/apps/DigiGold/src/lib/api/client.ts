import axios, { type AxiosError } from 'axios';

export type NormalizedApiError = { message: string; code: string; status: number | null };

function normalizeApiError(error: AxiosError): NormalizedApiError {
  return {
    message: error.message,
    code: error.code ?? 'UNKNOWN_ERROR',
    status: error.response?.status ?? null,
  };
}

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
  timeout: 15000,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => Promise.reject(normalizeApiError(error))
);
