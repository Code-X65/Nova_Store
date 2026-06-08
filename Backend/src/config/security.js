// Admin Security Configuration
module.exports = {
  admin: {
    // Login attempt settings
    maxFailedAttempts: 3, // Stricter than regular users (5)
    lockoutDuration: 60 * 60 * 1000, // 60 minutes in ms
    
    // IP restrictions (empty array means no restrictions)
    trustedIPRanges: [], // e.g., ['192.168.1.0/24', '10.0.0.0/8']
    
    // Password complexity (same as regular users for now, but can be stricter)
    password: {
      minLength: 12,
      requireLowercase: true,
      requireUppercase: true,
      requireNumbers: true,
      requireSpecialChars: true
    },
    
    // Session settings
    session: {
      accessTokenExpiresIn: '15m', // Same as regular users
      refreshTokenExpiresIn: '30d', // Same as regular users
      // Could implement shorter sessions for admins if needed
    }
  }
};