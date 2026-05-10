/**
 * SIMKL OAuth 2.0 Authentication Service
 * Handles OAuth flow for SIMKL API authentication
 */

const SIMKL_AUTH_URL = 'https://simkl.com/oauth/authorize';
const SIMKL_TOKEN_URL = 'https://api.simkl.com/oauth/token';
const SIMKL_PIN_URL = 'https://api.simkl.com/oauth/pin';
const STORAGE_KEY = 'simkl_access_token';
const USER_CODE_KEY = 'simkl_user_code';

class SimklAuthService {
  constructor() {
    this.clientId = import.meta.env.VITE_SIMKL_CLIENT_ID;
    this.redirectUri = import.meta.env.VITE_SIMKL_REDIRECT_URI;
    this.clientSecret = import.meta.env.VITE_SIMKL_CLIENT_SECRET;
  }

  /**
   * Get stored access token
   */
  getAccessToken() {
    return localStorage.getItem(STORAGE_KEY);
  }

  /**
   * Store access token
   */
  setAccessToken(token) {
    localStorage.setItem(STORAGE_KEY, token);
  }

  /**
   * Clear stored token
   */
  clearToken() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USER_CODE_KEY);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.getAccessToken();
  }

  /**
   * Initiate OAuth 2.0 authorization flow (redirect method)
   * Redirects user to SIMKL authorization page
   */
  initiateAuth() {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
    });

    window.location.href = `${SIMKL_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   * Called after redirect back from SIMKL
   */
  async exchangeCodeForToken(code) {
    try {
      const response = await fetch(SIMKL_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to exchange code for token');
      }

      const data = await response.json();
      this.setAccessToken(data.access_token);
      
      return {
        success: true,
        accessToken: data.access_token,
      };
    } catch (error) {
      console.error('Token exchange error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * PIN Authentication Flow - Step 1: Get user code
   * Alternative to OAuth redirect for apps that can't handle redirects
   */
  async getPinCode() {
    try {
      const response = await fetch(`${SIMKL_PIN_URL}?client_id=${this.clientId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get PIN code');
      }

      const data = await response.json();
      localStorage.setItem(USER_CODE_KEY, data.user_code);
      
      return {
        success: true,
        userCode: data.user_code,
        verificationUrl: data.verification_url,
        expiresIn: data.expires_in,
      };
    } catch (error) {
      console.error('PIN code error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * PIN Authentication Flow - Step 2: Check authorization status
   * Poll this endpoint to check if user has authorized the app
   */
  async checkPinAuthorization(userCode) {
    try {
      const response = await fetch(`${SIMKL_PIN_URL}/${userCode}?client_id=${this.clientId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 400) {
          return {
            success: false,
            pending: true,
            message: 'User has not authorized yet',
          };
        }
        throw new Error('Failed to check authorization');
      }

      const data = await response.json();
      
      if (data.access_token) {
        this.setAccessToken(data.access_token);
        localStorage.removeItem(USER_CODE_KEY);
        
        return {
          success: true,
          accessToken: data.access_token,
        };
      }

      return {
        success: false,
        pending: true,
      };
    } catch (error) {
      console.error('PIN authorization check error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Logout - clear all stored authentication data
   */
  logout() {
    this.clearToken();
  }
}

export default new SimklAuthService();
