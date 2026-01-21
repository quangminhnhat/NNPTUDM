/**
 * JWT Authentication Utility
 * Manages JWT tokens and API authentication
 */

const AuthJWT = {
  /**
   * Get the stored JWT token
   */
  getToken() {
    return localStorage.getItem('authToken');
  },

  /**
   * Get the stored user info
   */
  getUser() {
    const user = localStorage.getItem('authUser');
    return user ? JSON.parse(user) : null;
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.getToken();
  },

  /**
   * Set auth token and user info
   */
  setAuth(token, user) {
    localStorage.setItem('authToken', token);
    localStorage.setItem('authUser', JSON.stringify(user));
  },

  /**
   * Clear auth data (logout)
   */
  clearAuth() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    localStorage.removeItem('rememberMe');
  },

  /**
   * Get authorization header
   */
  getAuthHeader() {
    const token = this.getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  },

  /**
   * Make authenticated API call
   */
  async apiCall(url, options = {}) {
    const token = this.getToken();
    
    if (!token) {
      throw new Error('No authentication token found');
    }

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
      'Authorization': `Bearer ${token}`
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    // If 401 Unauthorized, clear auth and redirect to login
    if (response.status === 401) {
      this.clearAuth();
      window.location.href = '/login';
      throw new Error('Unauthorized - redirecting to login');
    }

    return response;
  },

  /**
   * Verify token is valid by making a simple API call
   */
  async verifyToken() {
    try {
      const response = await this.apiCall('/api/classes');
      return response.ok;
    } catch (error) {
      console.error('Token verification failed:', error);
      return false;
    }
  },

  /**
   * Redirect to login if not authenticated
   */
  requireAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = '/login';
    }
  },

  /**
   * Get user role
   */
  getUserRole() {
    const user = this.getUser();
    return user ? user.role : null;
  },

  /**
   * Check if user has specific role
   */
  hasRole(role) {
    const userRole = this.getUserRole();
    if (Array.isArray(role)) {
      return role.includes(userRole);
    }
    return userRole === role;
  }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthJWT;
}
