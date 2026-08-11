import { auth } from "../../util/firebase/firebase";

async function getAuthHeader() {
  const user = auth.currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

class SimklAuthService {
  /**
   * Fetches the current Simkl connection status from Strive backend.
   * Returns { connected: boolean, simklUserId: string|null, connectedAt: string|null }
   */
  async getStatus() {
    try {
      const headers = await getAuthHeader();
      const response = await fetch("/api/simkl/status", { headers });
      if (!response.ok) {
        return { connected: false, simklUserId: null, connectedAt: null };
      }
      return await response.json();
    } catch (err) {
      console.warn("Failed to fetch Simkl connection status:", err);
      return { connected: false, simklUserId: null, connectedAt: null };
    }
  }

  /**
   * Initiates the OAuth flow by requesting a signed state and authorization URL from the server.
   */
  async initiateAuth() {
    try {
      const headers = await getAuthHeader();
      const response = await fetch("/api/simkl/auth-url", { headers });
      if (!response.ok) {
        throw new Error("Failed to generate Simkl authorization URL");
      }
      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (err) {
      console.error("Failed to initiate Simkl OAuth:", err);
      throw err;
    }
  }

  /**
   * Exchanges authorization code and state for server-side protected token storage.
   */
  async exchangeCodeForToken(code, state) {
    try {
      const headers = await getAuthHeader();
      const response = await fetch("/api/simkl/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify({
          code,
          state,
          redirectUri: `${window.location.origin}/simkl/callback`,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "Failed to exchange code for token");
      }

      return await response.json();
    } catch (error) {
      console.error("Token exchange error:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Disconnects the user's Simkl account by purging protected credentials on server.
   */
  async disconnect() {
    try {
      const headers = await getAuthHeader();
      const response = await fetch("/api/simkl/disconnect", {
        method: "POST",
        headers,
      });

      if (!response.ok) {
        throw new Error("Failed to disconnect Simkl account");
      }

      return await response.json();
    } catch (err) {
      console.error("Disconnect error:", err);
      return { success: false, error: err.message };
    }
  }
}

export default new SimklAuthService();
