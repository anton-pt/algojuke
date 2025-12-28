import { describe, test, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { TidalTokenService } from '../../src/services/tidalTokenService.js';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('TidalTokenService', () => {
  let tokenService: TidalTokenService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up environment variables
    process.env.TIDAL_CLIENT_ID = 'test-client-id';
    process.env.TIDAL_CLIENT_SECRET = 'test-client-secret';
    process.env.TIDAL_TOKEN_URL = 'https://login.tidal.com/oauth2/token';

    tokenService = new TidalTokenService();
  });

  describe('getValidToken', () => {
    test('fetches new token when cache is empty', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          access_token: 'test-token',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      });

      const token = await tokenService.getValidToken();

      expect(token).toBe('test-token');
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    test('returns cached token when still valid', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          access_token: 'cached-token',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      });

      // First call - fetches new token
      const token1 = await tokenService.getValidToken();
      expect(token1).toBe('cached-token');
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);

      // Second call - should use cached token
      const token2 = await tokenService.getValidToken();
      expect(token2).toBe('cached-token');
      expect(mockedAxios.post).toHaveBeenCalledTimes(1); // Not called again
    });

    test('refreshes token when close to expiry', async () => {
      vi.useFakeTimers();

      mockedAxios.post
        .mockResolvedValueOnce({
          data: { access_token: 'token1', expires_in: 3600 },
        })
        .mockResolvedValueOnce({
          data: { access_token: 'token2', expires_in: 3600 },
        });

      // First call
      const token1 = await tokenService.getValidToken();
      expect(token1).toBe('token1');

      // Advance time to 56 minutes (4 minutes before expiry, within 5-minute buffer)
      vi.advanceTimersByTime(56 * 60 * 1000);

      // Second call - should fetch new token
      const token2 = await tokenService.getValidToken();
      expect(token2).toBe('token2');
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    test('sends correct OAuth2 request', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { access_token: 'test-token', expires_in: 3600 },
      });

      await tokenService.getValidToken();

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://login.tidal.com/oauth2/token',
        expect.any(URLSearchParams),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10000,
        })
      );

      const callArgs = mockedAxios.post.mock.calls[0];
      const params = callArgs[1] as URLSearchParams;
      expect(params.get('grant_type')).toBe('client_credentials');
      expect(params.get('client_id')).toBe('test-client-id');
      expect(params.get('client_secret')).toBe('test-client-secret');
    });
  });

  describe('error handling', () => {
    test('throws error when token response is invalid', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { error: 'invalid_response' },
      });

      await expect(tokenService.getValidToken()).rejects.toThrow();
    });

    test('throws error on 401 unauthorized', async () => {
      const axiosError = new Error('Unauthorized') as any;
      axiosError.isAxiosError = true;
      axiosError.response = { status: 401 };
      axiosError.message = 'Unauthorized';

      mockedAxios.post.mockRejectedValueOnce(axiosError);
      mockedAxios.isAxiosError = vi.fn().mockReturnValue(true);

      await expect(tokenService.getValidToken()).rejects.toThrow('Invalid Tidal API credentials');
    });

    test('throws error on timeout', async () => {
      const axiosError = new Error('timeout') as any;
      axiosError.isAxiosError = true;
      axiosError.code = 'ECONNABORTED';
      axiosError.message = 'timeout';

      mockedAxios.post.mockRejectedValueOnce(axiosError);
      mockedAxios.isAxiosError = vi.fn().mockReturnValue(true);

      await expect(tokenService.getValidToken()).rejects.toThrow('Tidal authentication service timeout');
    });

    test('throws error when credentials are missing', () => {
      delete process.env.TIDAL_CLIENT_ID;
      delete process.env.TIDAL_CLIENT_SECRET;

      expect(() => new TidalTokenService()).toThrow('Tidal API credentials not configured');
    });
  });

  describe('clearCache', () => {
    test('clears cached token', async () => {
      mockedAxios.post
        .mockResolvedValueOnce({
          data: { access_token: 'token1', expires_in: 3600 },
        })
        .mockResolvedValueOnce({
          data: { access_token: 'token2', expires_in: 3600 },
        });

      // First call - fetches token1
      await tokenService.getValidToken();
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);

      // Clear cache
      tokenService.clearCache();

      // Second call - should fetch token2
      await tokenService.getValidToken();
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });
  });
});
