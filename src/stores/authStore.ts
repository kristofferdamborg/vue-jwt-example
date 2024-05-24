import { defineStore } from 'pinia';
import { useStorage } from '@vueuse/core';
import jwtDecode from 'jwt-decode';
import api from '@/services/api';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

const useAuthStore = defineStore('auth', {
  state: () => ({
    accessToken: useStorage<string | null>(ACCESS_TOKEN_KEY, null),
    refreshToken: useStorage<string | null>(REFRESH_TOKEN_KEY, null),
  }),
  getters: {
    isAuthenticated: (state) => state.accessToken !== null,
  },
  actions: {
    setTokens(access: string | null, refresh: string | null) {
      this.accessToken = access;
      this.refreshToken = refresh;
    },
    async login(username: string, password: string) {
      try {
        const response = await api.post('/login', { username, password });

        const accessToken = response[ACCESS_TOKEN_KEY];
        const refreshToken = response[REFRESH_TOKEN_KEY];

        this.setTokens(accessToken, refreshToken);
        this.scheduleTokenRefresh(accessToken);
      } catch (err) {
        // TODO: Handle login errors
      }
    },
    logout() {
      this.setTokens(null, null);

      this.router.push({ name: 'Login' });
    },
    scheduleTokenRefresh(token: string) {
      const decodedToken = jwtDecode(token) as { exp: number };
      const currentTime = Date.now() / 1000;
      const expiresIn = decodedToken.exp - currentTime;

      // Set a safety margin to refresh the token before it expires
      const safetyMargin = 30; // 30 seconds
      const refreshTime = (expiresIn - safetyMargin) * 1000;

      setTimeout(async () => {
        try {
          await this.refreshTokens();
        } catch (err) {
          this.logout();
        }
      }, refreshTime);
    },
    async refreshTokens() {
      try {
        const response = await api.post('/refresh-token', { refreshToken: this.refreshToken });

        const accessToken = response[ACCESS_TOKEN_KEY];
        const refreshToken = response[REFRESH_TOKEN_KEY];

        this.setTokens(accessToken, refreshToken);

        return response;
      } catch (err) {
        this.logout();
      }
    },
  },
});

const authStore = useAuthStore();

if (authStore.accessToken) {
  authStore.scheduleTokenRefresh(authStore.accessToken);
}

export default useAuthStore;
