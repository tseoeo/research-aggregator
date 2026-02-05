/**
 * OpenRouter API Mock
 *
 * Mock responses for OpenRouter API calls.
 */

import { vi } from 'vitest';
import { createAnalysisFixture, createMockOpenRouterAnalysisResponse } from '../fixtures/analyses';

/**
 * Mock successful summary response
 */
export const mockSummaryResponse = {
  id: 'gen-summary-123',
  model: 'z-ai/glm-4.7',
  choices: [
    {
      message: {
        role: 'assistant',
        content: JSON.stringify({
          bullets: [
            'First key point about the research.',
            'Second key point about the methodology.',
            'Third key point about the results.',
          ],
          eli5: 'This paper explains a new way to make computers smarter at understanding text.',
        }),
      },
      finish_reason: 'stop',
    },
  ],
  usage: {
    prompt_tokens: 500,
    completion_tokens: 150,
    total_tokens: 650,
  },
};

/**
 * Mock analysis response
 */
export const mockAnalysisResponse = createMockOpenRouterAnalysisResponse();

/**
 * Mock error responses
 */
export const mockErrorResponses = {
  rateLimited: {
    error: {
      message: 'Rate limit exceeded',
      code: 'rate_limit_exceeded',
    },
  },
  unauthorized: {
    error: {
      message: 'Invalid API key',
      code: 'invalid_api_key',
    },
  },
  serverError: {
    error: {
      message: 'Internal server error',
      code: 'internal_error',
    },
  },
};

/**
 * Create a deterministic mock for repeatability tests
 * Returns the exact same response every time
 */
export function createDeterministicMock() {
  const fixedAnalysis = createAnalysisFixture({
    core_claim: 'The paper introduces a deterministic test result.',
    role: 'Primitive',
    role_confidence: 0.9,
    time_to_value: 'Soon',
    time_to_value_confidence: 0.8,
  });

  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(createMockOpenRouterAnalysisResponse(fixedAnalysis)),
  });
}

/**
 * Create a fetch mock that returns the summary response
 */
export function createSummaryFetchMock() {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(mockSummaryResponse),
  });
}

/**
 * Create a fetch mock that returns the analysis response
 */
export function createAnalysisFetchMock() {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(mockAnalysisResponse),
  });
}

/**
 * Create a fetch mock that returns an error
 */
export function createErrorFetchMock(status: number = 500, errorType: keyof typeof mockErrorResponses = 'serverError') {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    text: () => Promise.resolve(JSON.stringify(mockErrorResponses[errorType])),
    json: () => Promise.resolve(mockErrorResponses[errorType]),
  });
}
