/**
 * arXiv API Mock
 *
 * Mock responses for arXiv API calls.
 */

import { vi } from 'vitest';
import {
  mockArxivXmlSinglePaper,
  mockArxivXmlEmpty,
  createArxivXmlMultiplePapers,
} from '../fixtures/papers';

export {
  mockArxivXmlSinglePaper,
  mockArxivXmlEmpty,
  createArxivXmlMultiplePapers,
};

/**
 * Rate limited response
 */
export const mockRateLimitedResponse = 'Rate exceeded. Please retry after 30 seconds.';

/**
 * Create a fetch mock that returns single paper XML
 */
export function createSinglePaperFetchMock() {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: () => Promise.resolve(mockArxivXmlSinglePaper),
  });
}

/**
 * Create a fetch mock that returns empty feed
 */
export function createEmptyFeedFetchMock() {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: () => Promise.resolve(mockArxivXmlEmpty),
  });
}

/**
 * Create a fetch mock that returns multiple papers
 */
export function createMultiplePapersFetchMock(count: number = 10) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: () => Promise.resolve(createArxivXmlMultiplePapers(count)),
  });
}

/**
 * Create a fetch mock that returns rate limited response
 */
export function createRateLimitedFetchMock() {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: () => Promise.resolve(mockRateLimitedResponse),
  });
}

/**
 * Create a fetch mock that returns server error
 */
export function createServerErrorFetchMock() {
  return vi.fn().mockResolvedValue({
    ok: false,
    status: 503,
    statusText: 'Service Unavailable',
    text: () => Promise.resolve('Service temporarily unavailable'),
  });
}

/**
 * Create a fetch mock that times out
 */
export function createTimeoutFetchMock() {
  return vi.fn().mockImplementation(() =>
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 100);
    })
  );
}
