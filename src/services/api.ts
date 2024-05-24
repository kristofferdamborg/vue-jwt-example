import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { useRouter } from 'vue-router';
import useAuthStore from '@/stores/authStore';
import * as Cookies from 'js-cookie';

const api = axios.create({
  baseURL: 'https://your-api-base-url.com',
});

enum StatusCode {
    UNAUTHORIZED = 401,
    FORBIDDEN = 403,
};

let isRefreshing = false;
let requestQueue: (() => Promise<AxiosResponse<any>> | null)[] = [];

function processQueue(accessToken: string | null) {
    if (accessToken) {
        requestQueue.forEach((callback) => {
            callback();
        });
    }

    requestQueue = [];
};

async function refreshToken(authStore: ReturnType<typeof useAuthStore>) {
    isRefreshing = true;

    try {
        const newToken = await authStore.refreshTokens();

        processQueue(newToken);
    } catch (err) {
        processQueue(null);
    }

    isRefreshing = false;
}

api.interceptors.request.use(async (config: AxiosRequestConfig) => {
  const authStore = useAuthStore();
  const token = authStore.accessToken;
  const csrftoken = Cookies.get('csrftoken');

  config.headers = config.headers || {};

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (csrftoken) {
    config.headers['X-CSRFToken'] = csrftoken;
  }

  if (isRefreshing) {
    return new Promise((resolve, reject) => {
      requestQueue.push(async () => {
        try {
          const response = await api(config);

          resolve(response);
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  return config;
}, (err: AxiosError) => {
  return Promise.reject(err);
});

api.interceptors.response.use((response: AxiosResponse) => {
  return response.data;
}, async (err: AxiosError) => {
    const originalRequest: err.config;
    const response = err.response;
    const authStore = useAuthStore();
    const router = useRouter();

    if (response?.status === StatusCode.UNAUTHORIZED && !originalRequest.isRetry) {
        originalRequest.isRetry = true;

        if (!isRefreshing) {
            await refreshToken(authStore);
        }

        return new Promise((resolve, reject) => {
            requestQueue.push(async () => {
                try {
                    const response = await api(originalRequest);

                    resolve(response);
                } catch (requestError) {
                    reject(requestError);
                }
            });
        });
    }

    if (response?.status === StatusCode.FORBIDDEN) {
        router.push({ name: 'Login' });

        // TODO: Consider showing toast message here
    }

    return Promise.reject(err);
});

export default api;
