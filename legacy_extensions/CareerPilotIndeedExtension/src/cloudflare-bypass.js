/**
 * Cloudflare Bypass Utilities for CareerPilot Indeed Extension
 * 
 * This module provides helpers for detecting and bypassing Cloudflare challenges
 * across the extension's network requests and page navigation.
 */

const CLOUDFLARE_BYPASS_STRATEGIES = {
  HEADERS: {
    name: "Anti-Bot Headers",
    description: "Inject specialized headers to evade Cloudflare detection",
    enabled: true,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "DNT": "1",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Cache-Control": "max-age=0",
    }
  },
  DELAYS: {
    name: "Request Delays",
    description: "Add random delays between requests to appear more human-like",
    enabled: true,
    minDelay: 1000,
    maxDelay: 3000,
  },
  RETRY: {
    name: "Exponential Backoff Retry",
    description: "Retry failed requests with exponential backoff",
    enabled: true,
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 8000,
  },
  PAGE_WAIT: {
    name: "Extended Page Wait",
    description: "Wait longer for Cloudflare challenges to auto-resolve",
    enabled: true,
    challengeTimeoutMs: 120000, // 2 minutes
  }
};

/**
 * Get comprehensive bypass strategy config
 * @returns {Object} Strategy configuration
 */
function getBypassStrategy() {
  return CLOUDFLARE_BYPASS_STRATEGIES;
}

/**
 * Check if response indicates Cloudflare challenge
 * @param {Response|Object} response - Fetch response or response-like object
 * @returns {Object} Challenge detection result with details
 */
function analyzeCloudflareResponse(response) {
  if (!response) {
    return { isChallenge: false, confidence: 0, reason: "No response" };
  }

  const status = response.status || 0;
  const headers = response.headers || {};
  const serverHeader = (headers.get?.('server') || headers.server || '').toLowerCase();
  const cfRayId = headers.get?.('CF-Ray') || headers['CF-Ray'] || null;

  let isChallenge = false;
  let confidence = 0;
  let reasons = [];

  // Check status codes
  if (status === 403) {
    isChallenge = true;
    confidence += 0.6;
    reasons.push("HTTP 403 Forbidden");
  }
  
  if (status === 503) {
    isChallenge = true;
    confidence += 0.5;
    reasons.push("HTTP 503 Service Unavailable");
  }

  // Check Cloudflare headers
  if (serverHeader.includes('cloudflare')) {
    isChallenge = true;
    confidence += 0.4;
    reasons.push("Cloudflare server header");
  }

  if (cfRayId) {
    isChallenge = true;
    confidence += 0.3;
    reasons.push(`CF-Ray ID: ${cfRayId}`);
  }

  // Check content-type (Cloudflare challenges are usually HTML)
  const contentType = (headers.get?.('content-type') || headers['content-type'] || '').toLowerCase();
  if (status >= 400 && contentType.includes('text/html')) {
    confidence += 0.2;
  }

  return {
    isChallenge,
    confidence: Math.min(1, confidence),
    status,
    rayId: cfRayId,
    reasons,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Format error info for logging
 * @param {Object} analysis - Analysis from analyzeCloudflareResponse
 * @returns {String} Formatted error message
 */
function formatCloudflareError(analysis) {
  if (!analysis || !analysis.isChallenge) return null;

  const parts = [
    `[CareerPilot] 🚨 Cloudflare Challenge (${Math.round(analysis.confidence * 100)}% confidence)`,
    `Status: ${analysis.status}`,
  ];

  if (analysis.rayId) {
    parts.push(`Ray ID: ${analysis.rayId}`);
  }

  if (analysis.reasons.length > 0) {
    parts.push(`Reasons: ${analysis.reasons.join(', ')}`);
  }

  return parts.join(' | ');
}

/**
 * Calculate retry delay with exponential backoff
 * @param {number} attemptNumber - Current attempt (1-indexed)
 * @param {Object} config - Retry configuration
 * @returns {number} Delay in milliseconds
 */
function calculateRetryDelay(attemptNumber, config = CLOUDFLARE_BYPASS_STRATEGIES.RETRY) {
  if (!config.enabled) return 0;

  const exponentialDelay = config.initialDelayMs * Math.pow(2, attemptNumber - 1);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
  const jitterDelay = cappedDelay + Math.random() * (cappedDelay * 0.1); // 10% jitter
  
  return Math.floor(jitterDelay);
}

/**
 * Generate fetch options with bypass headers
 * @param {Object} existingOptions - Existing fetch options
 * @returns {Object} Updated fetch options with bypass headers
 */
function injectBypassHeaders(existingOptions = {}) {
  const strategy = CLOUDFLARE_BYPASS_STRATEGIES.HEADERS;
  if (!strategy.enabled) return existingOptions;

  const headers = {
    ...(existingOptions.headers || {}),
    ...strategy.headers,
  };

  return {
    ...existingOptions,
    headers,
  };
}

/**
 * Wait for Cloudflare challenge to resolve
 * @param {Function} checkFn - Function that returns true when challenge is resolved
 * @param {Object} options - Wait options
 * @returns {Promise<boolean>} True if resolved, false if timed out
 */
async function waitForChallengeResolution(checkFn, options = {}) {
  const timeout = options.timeout || CLOUDFLARE_BYPASS_STRATEGIES.PAGE_WAIT.challengeTimeoutMs;
  const checkInterval = options.checkInterval || 2000;
  
  const startTime = Date.now();

  return new Promise((resolve) => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;

      try {
        if (checkFn()) {
          clearInterval(interval);
          console.log(`[CareerPilot] ✅ Challenge resolved after ${elapsed}ms`);
          resolve(true);
          return;
        }
      } catch (err) {
        console.warn(`[CareerPilot] Check function error:`, err?.message);
      }

      if (elapsed > timeout) {
        clearInterval(interval);
        console.warn(`[CareerPilot] ⏱️ Challenge resolution timed out after ${elapsed}ms`);
        resolve(false);
      }
    }, checkInterval);
  });
}

/**
 * Perform retryable fetch with Cloudflare bypass
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 * @throws {Error} If all retries fail
 */
async function fetchWithBypass(url, options = {}) {
  const retryConfig = CLOUDFLARE_BYPASS_STRATEGIES.RETRY;
  const delayConfig = CLOUDFLARE_BYPASS_STRATEGIES.DELAYS;
  
  let lastError = null;
  let lastAnalysis = null;

  for (let attempt = 1; attempt <= retryConfig.maxRetries + 1; attempt++) {
    try {
      // Add random delay if enabled (except on first attempt)
      if (attempt > 1 && delayConfig.enabled) {
        const delay = Math.random() * (delayConfig.maxDelay - delayConfig.minDelay) + delayConfig.minDelay;
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Inject bypass headers
      const fetchOptions = injectBypassHeaders(options);
      
      console.log(`[CareerPilot] 📤 Fetch attempt ${attempt}/${retryConfig.maxRetries + 1}: ${url}`);
      
      const response = await fetch(url, fetchOptions);
      const analysis = analyzeCloudflareResponse(response);

      if (!analysis.isChallenge) {
        console.log(`[CareerPilot] ✅ Request successful`);
        return response;
      }

      // Log challenge detection
      lastAnalysis = analysis;
      console.warn(formatCloudflareError(analysis));

      // Don't retry on last attempt
      if (attempt >= retryConfig.maxRetries + 1) {
        return response; // Return challenge response
      }

      // Calculate retry delay
      const retryDelay = calculateRetryDelay(attempt, retryConfig);
      console.log(`[CareerPilot] ⏳ Retry in ${retryDelay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, retryDelay));

    } catch (error) {
      lastError = error;
      console.error(`[CareerPilot] ❌ Fetch error on attempt ${attempt}:`, error?.message);

      if (attempt < retryConfig.maxRetries + 1) {
        const retryDelay = calculateRetryDelay(attempt, retryConfig);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  // All retries exhausted
  const errorMsg = `Fetch failed after ${retryConfig.maxRetries + 1} attempts`;
  console.error(`[CareerPilot] 🚨 ${errorMsg}`, {
    url,
    lastError: lastError?.message,
    lastAnalysis,
  });

  throw lastError || new Error(errorMsg);
}

/**
 * Store challenge event for debugging
 * @param {Object} challengeInfo - Challenge information
 * @returns {Promise<void>}
 */
async function storeChallengeEvent(challengeInfo) {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage) return;

    const stored = await chrome.storage.local.get('cpCloudflareHistory');
    const history = stored.cpCloudflareHistory || [];

    history.unshift({
      ...challengeInfo,
      storedAt: new Date().toISOString(),
    });

    // Keep last 20 events
    if (history.length > 20) history.splice(20);

    await chrome.storage.local.set({ cpCloudflareHistory: history });
    
    console.log(`[CareerPilot] 📝 Stored challenge event (total: ${history.length})`);
  } catch (err) {
    console.warn(`[CareerPilot] Storage error:`, err?.message);
  }
}

/**
 * Get challenge history for debugging
 * @returns {Promise<Array>} Array of stored challenges
 */
async function getChallengeHistory() {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage) return [];

    const stored = await chrome.storage.local.get('cpCloudflareHistory');
    return stored.cpCloudflareHistory || [];
  } catch (err) {
    console.warn(`[CareerPilot] Could not retrieve challenge history:`, err?.message);
    return [];
  }
}

/**
 * Clear challenge history
 * @returns {Promise<void>}
 */
async function clearChallengeHistory() {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    await chrome.storage.local.remove('cpCloudflareHistory');
    console.log(`[CareerPilot] ✅ Challenge history cleared`);
  } catch (err) {
    console.warn(`[CareerPilot] Could not clear history:`, err?.message);
  }
}

// Export for use in extension modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getBypassStrategy,
    analyzeCloudflareResponse,
    formatCloudflareError,
    calculateRetryDelay,
    injectBypassHeaders,
    waitForChallengeResolution,
    fetchWithBypass,
    storeChallengeEvent,
    getChallengeHistory,
    clearChallengeHistory,
  };
}
