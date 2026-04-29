const logger = require('../utils/logger');
const { decrypt } = require('../utils/encryption');

/**
 * Mock service to simulate publishing to social media platforms.
 * In a real application, this would use the official SDKs/APIs (e.g., twitter-api-v2, linkedin-api).
 */
const publish = async (socialAccount, content, postType) => {
  const { platform, accountId, accessToken } = socialAccount;
  const token = decrypt(accessToken);
  
  logger.info(`[SocialMediaService] Simulating publish to ${platform} for account ${accountId}`);
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Simulate random failures for testing retry logic (10% chance)
  if (Math.random() < 0.1) {
    throw new Error(`Failed to publish to ${platform}: Network timeout`);
  }

  // Return a mock external ID
  return `ext_${platform.toLowerCase()}_${Math.random().toString(36).substring(7)}`;
};

module.exports = { publish };
