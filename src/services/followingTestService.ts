/**
 * Service to test if the following scraper feature works
 * Uses smart rate limiting to avoid Cloudflare blocks
 */

const STORAGE_KEY_LAST_TEST = 'following-feature-last-test';
const STORAGE_KEY_TEST_RESULT = 'following-feature-test-result';
const STORAGE_KEY_FAILURE_COUNT = 'following-feature-failure-count';
const MIN_TEST_INTERVAL = 1000 * 60 * 60 * 24; // 24 hours between tests
const MAX_FAILURES_BEFORE_BACKOFF = 3; // After 3 failures, wait longer
const BACKOFF_MULTIPLIER = 2; // Double the wait time after max failures

interface TestResult {
  enabled: boolean;
  timestamp: number;
  failureCount: number;
}

/**
 * Check if we should test the following feature
 * Returns true if enough time has passed since last test
 */
export function shouldTestFollowingFeature(): boolean {
  try {
    const lastTestStr = localStorage.getItem(STORAGE_KEY_LAST_TEST);
    const failureCountStr = localStorage.getItem(STORAGE_KEY_FAILURE_COUNT);
    
    if (!lastTestStr) {
      return true; // Never tested, allow test
    }
    
    const lastTest = parseInt(lastTestStr, 10);
    const failureCount = failureCountStr ? parseInt(failureCountStr, 10) : 0;
    const now = Date.now();
    const timeSinceLastTest = now - lastTest;
    
    // Calculate backoff time based on failure count
    let requiredInterval = MIN_TEST_INTERVAL;
    if (failureCount >= MAX_FAILURES_BEFORE_BACKOFF) {
      const backoffMultiplier = Math.pow(BACKOFF_MULTIPLIER, failureCount - MAX_FAILURES_BEFORE_BACKOFF + 1);
      requiredInterval = MIN_TEST_INTERVAL * backoffMultiplier;
      // Cap at 7 days
      requiredInterval = Math.min(requiredInterval, 1000 * 60 * 60 * 24 * 7);
    }
    
    return timeSinceLastTest >= requiredInterval;
  } catch {
    return true; // If storage fails, allow test
  }
}

/**
 * Get the last test result
 */
export function getLastTestResult(): boolean | null {
  try {
    const resultStr = localStorage.getItem(STORAGE_KEY_TEST_RESULT);
    if (!resultStr) return null;
    
    const result: TestResult = JSON.parse(resultStr);
    // Check if result is still valid (within 24 hours)
    const now = Date.now();
    if (now - result.timestamp < MIN_TEST_INTERVAL) {
      return result.enabled;
    }
    
    return null; // Result expired
  } catch {
    return null;
  }
}

/**
 * Record a successful test
 */
export function recordTestSuccess(): void {
  try {
    const now = Date.now();
    localStorage.setItem(STORAGE_KEY_LAST_TEST, now.toString());
    localStorage.setItem(STORAGE_KEY_TEST_RESULT, JSON.stringify({
      enabled: true,
      timestamp: now,
      failureCount: 0,
    }));
    localStorage.removeItem(STORAGE_KEY_FAILURE_COUNT);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Record a failed test
 */
export function recordTestFailure(): void {
  try {
    const now = Date.now();
    const failureCountStr = localStorage.getItem(STORAGE_KEY_FAILURE_COUNT);
    const failureCount = failureCountStr ? parseInt(failureCountStr, 10) + 1 : 1;
    
    localStorage.setItem(STORAGE_KEY_LAST_TEST, now.toString());
    localStorage.setItem(STORAGE_KEY_FAILURE_COUNT, failureCount.toString());
    localStorage.setItem(STORAGE_KEY_TEST_RESULT, JSON.stringify({
      enabled: false,
      timestamp: now,
      failureCount,
    }));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Get time until next test is allowed (in milliseconds)
 */
export function getTimeUntilNextTest(): number {
  try {
    const lastTestStr = localStorage.getItem(STORAGE_KEY_LAST_TEST);
    const failureCountStr = localStorage.getItem(STORAGE_KEY_FAILURE_COUNT);
    
    if (!lastTestStr) {
      return 0; // Can test now
    }
    
    const lastTest = parseInt(lastTestStr, 10);
    const failureCount = failureCountStr ? parseInt(failureCountStr, 10) : 0;
    const now = Date.now();
    const timeSinceLastTest = now - lastTest;
    
    // Calculate required interval
    let requiredInterval = MIN_TEST_INTERVAL;
    if (failureCount >= MAX_FAILURES_BEFORE_BACKOFF) {
      const backoffMultiplier = Math.pow(BACKOFF_MULTIPLIER, failureCount - MAX_FAILURES_BEFORE_BACKOFF + 1);
      requiredInterval = MIN_TEST_INTERVAL * backoffMultiplier;
      requiredInterval = Math.min(requiredInterval, 1000 * 60 * 60 * 24 * 7);
    }
    
    const timeUntilNext = requiredInterval - timeSinceLastTest;
    return Math.max(0, timeUntilNext);
  } catch {
    return 0;
  }
}

/**
 * Format time until next test for display
 */
export function formatTimeUntilNextTest(): string {
  const ms = getTimeUntilNextTest();
  if (ms === 0) return 'now';
  
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

