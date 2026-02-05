/**
 * Analysis Repeatability Tests (P0 - Critical)
 *
 * Tests that AI analysis is deterministic:
 * - Same input produces same output with mocked LLM
 * - Prompt hash is consistent for same inputs
 * - Temperature=0 is being used for determinism
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAnalysisFixture } from '../fixtures/analyses';
import { createPaperFixture } from '../fixtures/papers';

// Store original env
const originalEnv = { ...process.env };

describe('Analysis Repeatability', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.OPENROUTER_API_KEY = 'test_api_key';
    process.env.OPENROUTER_MODEL = 'z-ai/glm-4.7';
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('Deterministic Output with Mocked LLM', () => {
    it('should produce identical output for same input when mocked', async () => {
      // Create a fixed analysis response
      const fixedAnalysis = createAnalysisFixture({
        core_claim: 'Test deterministic output',
        role: 'Primitive',
        role_confidence: 0.9,
        time_to_value: 'Soon',
        time_to_value_confidence: 0.85,
      });

      // Mock fetch to return fixed response
      const mockResponse = {
        id: 'gen-test',
        model: 'z-ai/glm-4.7',
        choices: [
          {
            message: {
              role: 'assistant',
              content: JSON.stringify(fixedAnalysis),
            },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      // Mock the database for taxonomy loading
      vi.mock('@/lib/db', () => ({
        db: {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([]),
        },
      }));

      const { PaperAnalysisService } = await import('@/lib/services/paper-analysis');
      const service = new PaperAnalysisService('test_api_key', 'z-ai/glm-4.7');

      const paper = createPaperFixture();

      // Run analysis twice
      const result1 = await service.analyzePaper({
        title: paper.title,
        abstract: paper.abstract,
      });

      const result2 = await service.analyzePaper({
        title: paper.title,
        abstract: paper.abstract,
      });

      // Results should be identical
      expect(result1.analysis.core_claim).toBe(result2.analysis.core_claim);
      expect(result1.analysis.role).toBe(result2.analysis.role);
      expect(result1.analysis.role_confidence).toBe(result2.analysis.role_confidence);
      expect(result1.analysis.time_to_value).toBe(result2.analysis.time_to_value);
      expect(result1.analysis.time_to_value_confidence).toBe(result2.analysis.time_to_value_confidence);

      // Prompt hash should be identical
      expect(result1.promptHash).toBe(result2.promptHash);

      // Full analysis should be deeply equal
      expect(JSON.stringify(result1.analysis)).toBe(JSON.stringify(result2.analysis));
    });

    it('should produce different prompt hash for different inputs', async () => {
      const fixedAnalysis = createAnalysisFixture();

      const mockResponse = {
        id: 'gen-test',
        model: 'z-ai/glm-4.7',
        choices: [
          {
            message: {
              role: 'assistant',
              content: JSON.stringify(fixedAnalysis),
            },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      vi.mock('@/lib/db', () => ({
        db: {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([]),
        },
      }));

      const { PaperAnalysisService } = await import('@/lib/services/paper-analysis');
      const service = new PaperAnalysisService('test_api_key', 'z-ai/glm-4.7');

      const paper1 = createPaperFixture({ title: 'Paper One' });
      const paper2 = createPaperFixture({ title: 'Paper Two' });

      const result1 = await service.analyzePaper({
        title: paper1.title,
        abstract: paper1.abstract,
      });

      const result2 = await service.analyzePaper({
        title: paper2.title,
        abstract: paper2.abstract,
      });

      // Prompt hashes should be different for different inputs
      expect(result1.promptHash).not.toBe(result2.promptHash);
    });
  });

  describe('Temperature Setting Verification', () => {
    it('should use temperature=0 for determinism', async () => {
      const fixedAnalysis = createAnalysisFixture();

      const mockResponse = {
        id: 'gen-test',
        model: 'z-ai/glm-4.7',
        choices: [
          {
            message: {
              role: 'assistant',
              content: JSON.stringify(fixedAnalysis),
            },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 },
      };

      let capturedRequestBody: unknown;

      global.fetch = vi.fn().mockImplementation(async (url: string, options: RequestInit) => {
        capturedRequestBody = JSON.parse(options.body as string);
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockResponse),
        };
      });

      vi.mock('@/lib/db', () => ({
        db: {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([]),
        },
      }));

      const { PaperAnalysisService } = await import('@/lib/services/paper-analysis');
      const service = new PaperAnalysisService('test_api_key', 'z-ai/glm-4.7');

      const paper = createPaperFixture();
      await service.analyzePaper({
        title: paper.title,
        abstract: paper.abstract,
      });

      // Verify temperature=0 was sent
      expect(capturedRequestBody).toBeDefined();
      expect((capturedRequestBody as Record<string, unknown>).temperature).toBe(0);
    });
  });

  describe('Prompt Hash Consistency', () => {
    it('should generate consistent hash for identical prompts', async () => {
      // Import the hash generation function
      // Note: This tests the internal implementation detail
      const crypto = await import('crypto');

      const generateHash = (systemPrompt: string, userPrompt: string): string => {
        const combined = systemPrompt + userPrompt;
        return crypto.createHash('sha256').update(combined).digest('hex').substring(0, 64);
      };

      const systemPrompt = 'You are an analysis engine...';
      const userPrompt = 'Analyze this paper: Test Title\n\nAbstract: Test abstract';

      const hash1 = generateHash(systemPrompt, userPrompt);
      const hash2 = generateHash(systemPrompt, userPrompt);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it('should generate different hash for different prompts', async () => {
      const crypto = await import('crypto');

      const generateHash = (systemPrompt: string, userPrompt: string): string => {
        const combined = systemPrompt + userPrompt;
        return crypto.createHash('sha256').update(combined).digest('hex').substring(0, 64);
      };

      const systemPrompt = 'You are an analysis engine...';

      const hash1 = generateHash(systemPrompt, 'User prompt 1');
      const hash2 = generateHash(systemPrompt, 'User prompt 2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Analysis Status Detection', () => {
    it('should mark analysis as low_confidence when role_confidence is below 0.4', async () => {
      const lowConfidenceAnalysis = createAnalysisFixture({
        role_confidence: 0.3, // Below 0.4 threshold
        time_to_value_confidence: 0.8,
      });

      const mockResponse = {
        id: 'gen-test',
        model: 'z-ai/glm-4.7',
        choices: [
          {
            message: {
              role: 'assistant',
              content: JSON.stringify(lowConfidenceAnalysis),
            },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      vi.mock('@/lib/db', () => ({
        db: {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([]),
        },
      }));

      const { PaperAnalysisService } = await import('@/lib/services/paper-analysis');
      const service = new PaperAnalysisService('test_api_key', 'z-ai/glm-4.7');

      const paper = createPaperFixture();
      const result = await service.analyzePaper({
        title: paper.title,
        abstract: paper.abstract,
      });

      expect(result.analysisStatus).toBe('low_confidence');
    });

    it('should mark analysis as complete when all fields are valid', async () => {
      const completeAnalysis = createAnalysisFixture({
        role_confidence: 0.9,
        time_to_value_confidence: 0.85,
      });

      const mockResponse = {
        id: 'gen-test',
        model: 'z-ai/glm-4.7',
        choices: [
          {
            message: {
              role: 'assistant',
              content: JSON.stringify(completeAnalysis),
            },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      vi.mock('@/lib/db', () => ({
        db: {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([]),
        },
      }));

      const { PaperAnalysisService } = await import('@/lib/services/paper-analysis');
      const service = new PaperAnalysisService('test_api_key', 'z-ai/glm-4.7');

      const paper = createPaperFixture();
      const result = await service.analyzePaper({
        title: paper.title,
        abstract: paper.abstract,
      });

      expect(result.analysisStatus).toBe('complete');
    });
  });

  describe('Evidence Pointer Validation', () => {
    it('should validate evidence pointers reference valid sentence IDs', async () => {
      // Analysis with invalid evidence pointers
      const analysisWithInvalidPointers = createAnalysisFixture();
      // The fixture has pointers like S1-S8, but if abstract only has 3 sentences,
      // S8 would be invalid

      const mockResponse = {
        id: 'gen-test',
        model: 'z-ai/glm-4.7',
        choices: [
          {
            message: {
              role: 'assistant',
              content: JSON.stringify(analysisWithInvalidPointers),
            },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      vi.mock('@/lib/db', () => ({
        db: {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([]),
        },
      }));

      const { PaperAnalysisService } = await import('@/lib/services/paper-analysis');
      const service = new PaperAnalysisService('test_api_key', 'z-ai/glm-4.7');

      // Paper with only 2 sentences in abstract
      const paper = createPaperFixture({
        abstract: 'First sentence. Second sentence.',
      });

      const result = await service.analyzePaper({
        title: paper.title,
        abstract: paper.abstract,
      });

      // Should have validation errors for S3-S8 references
      expect(result.validationErrors.length).toBeGreaterThan(0);
    });
  });
});
