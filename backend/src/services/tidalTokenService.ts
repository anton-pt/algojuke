import axios from 'axios';
import { logger } from '../utils/logger.js';
import { TidalTokenResponse } from '../types/tidal.js';
import { ApiUnavailableError } from '../types/errors.js';

interface TokenCache {
  token: string;
  expiresAt: number;
}

/**
 * Service for managing Tidal OAuth2 tokens
 * Implements token caching and auto-refresh with 5-minute buffer
 */
export class TidalTokenService {
  private cachedToken: TokenCache | null = null;
  private readonly tokenUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor() {
    this.tokenUrl = process.env.TIDAL_TOKEN_URL || 'https://auth.tidal.com/v1/oauth2/token';
    this.clientId = process.env.TIDAL_CLIENT_ID || '';
    this.clientSecret = process.env.TIDAL_CLIENT_SECRET || '';

    if (!this.clientId || !this.clientSecret) {
      logger.error('tidal_credentials_missing', {
        hasClientId: !!this.clientId,
        hasClientSecret: !!this.clientSecret,
      });
      throw new Error('Tidal API credentials not configured');
    }
  }

  /**
   * Get a valid Tidal API token
   * Returns cached token if valid, otherwise fetches a new one
   *
   * @returns Valid access token
   */
  async getValidToken(): Promise<string> {
    // Check if cached token is still valid (with 5-minute buffer)
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
      logger.debug('using_cached_token', {
        expiresAt: new Date(this.cachedToken.expiresAt).toISOString(),
      });
      return this.cachedToken.token;
    }

    // Fetch new token
    logger.info('fetching_new_token');
    const token = await this.fetchNewToken();

    // Cache with expiry (tokens typically expire in 1 hour)
    this.cachedToken = {
      token,
      expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
    };

    return token;
  }

  /**
   * Fetch a new OAuth2 token from Tidal
   *
   * @returns Access token
   */
  private async fetchNewToken(): Promise<string> {
    try {
      const response = await axios.post<TidalTokenResponse>(
        this.tokenUrl,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 10000, // 10 second timeout
        }
      );

      if (!response.data.access_token) {
        logger.error('token_response_invalid', { response: response.data });
        throw new ApiUnavailableError('Failed to obtain Tidal API token');
      }

      logger.info('token_fetched_successfully', {
        expiresIn: response.data.expires_in,
      });

      return response.data.access_token;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.apiError(this.tokenUrl, error.response?.status ?? 0, error.message);

        if (error.code === 'ECONNABORTED') {
          throw new ApiUnavailableError('Tidal authentication service timeout');
        }

        if (error.response?.status === 401) {
          throw new ApiUnavailableError('Invalid Tidal API credentials');
        }
      }

      logger.error('token_fetch_failed', { error: String(error) });
      throw new ApiUnavailableError('Failed to authenticate with Tidal API');
    }
  }

  /**
   * Clear cached token (useful for testing or forcing refresh)
   */
  clearCache(): void {
    this.cachedToken = null;
    logger.debug('token_cache_cleared');
  }
}
