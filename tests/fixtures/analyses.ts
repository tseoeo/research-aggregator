/**
 * Analysis Test Fixtures
 *
 * Sample DTL-P analysis data for testing.
 */

import type { PaperCardAnalysisResponse } from '@/lib/services/paper-analysis';

export function createAnalysisFixture(
  overrides: Partial<PaperCardAnalysisResponse> = {}
): PaperCardAnalysisResponse {
  return {
    core_claim: overrides.core_claim || 'The paper introduces a novel attention mechanism that reduces transformer inference time by 40% while maintaining accuracy.',
    role: overrides.role || 'Primitive',
    role_confidence: overrides.role_confidence ?? 0.85,
    time_to_value: overrides.time_to_value || 'Soon',
    time_to_value_confidence: overrides.time_to_value_confidence ?? 0.75,
    interestingness: overrides.interestingness || {
      total_score: 8,
      tier: 'high',
      checks: [
        {
          check_id: 'business_primitive_impact',
          score: 2,
          answer: 'Clear impact on speed and efficiency of transformer models.',
          evidence_pointers: ['S1', 'S2'],
        },
        {
          check_id: 'delta_specificity',
          score: 2,
          answer: '40% reduction in inference time with quantitative benchmarks.',
          evidence_pointers: ['S3'],
        },
        {
          check_id: 'comparison_credibility',
          score: 1,
          answer: 'Compared against standard transformer baseline.',
          evidence_pointers: ['S4'],
        },
        {
          check_id: 'real_world_plausibility',
          score: 1,
          answer: 'Feasible for production deployment with standard hardware.',
          evidence_pointers: ['S5'],
        },
        {
          check_id: 'evidence_strength',
          score: 1,
          answer: 'Tested on two translation benchmarks.',
          evidence_pointers: ['S6'],
        },
        {
          check_id: 'failure_disclosure',
          score: 1,
          answer: 'Limitations mentioned for very long sequences.',
          evidence_pointers: ['S7'],
        },
      ],
    },
    business_primitives: overrides.business_primitives || {
      selected: ['speed', 'cost'],
      justification: 'Faster inference reduces compute costs and improves latency.',
      evidence_pointers: ['S1', 'S3'],
    },
    key_numbers: overrides.key_numbers || [
      {
        metric_name: 'Inference time reduction',
        value: '40%',
        direction: 'down',
        baseline: 'Standard transformer',
        conditions: 'Tested on IWSLT 2014 German-English',
        evidence_pointer: 'S3',
      },
    ],
    constraints: overrides.constraints || [
      {
        constraint: 'Sequence length limited to 512 tokens',
        why_it_matters: 'Cannot handle long documents without chunking.',
        evidence_pointer: 'S7',
      },
    ],
    failure_modes: overrides.failure_modes || [
      {
        failure_mode: 'Performance degrades on out-of-domain text',
        why_it_matters: 'May require domain-specific fine-tuning.',
        evidence_pointer: 'S8',
      },
    ],
    what_is_missing: overrides.what_is_missing || [
      'Comparison with more recent efficient transformer variants',
      'Memory usage analysis',
    ],
    readiness_level: overrides.readiness_level || 'prototype_candidate',
    readiness_justification: overrides.readiness_justification || 'Code is available and results are reproducible, but requires engineering effort for production.',
    readiness_evidence_pointers: overrides.readiness_evidence_pointers || ['S4', 'S5'],
    use_case_mapping: overrides.use_case_mapping || [
      {
        use_case_id: 'uc-001',
        use_case_name: 'Real-time translation',
        fit_confidence: 'high',
        because: 'Directly addresses latency requirements for real-time applications.',
        evidence_pointers: ['S1', 'S3'],
      },
    ],
    taxonomy_proposals: overrides.taxonomy_proposals || [],
    public_views: overrides.public_views || {
      hook_sentence: 'A new approach to make AI language models 40% faster.',
      '30s_summary': [
        'Introduces a more efficient attention mechanism for transformers.',
        'Achieves 40% faster inference without sacrificing accuracy.',
        'Ready for prototype development in production systems.',
      ],
      '3m_summary': 'This paper presents a novel optimization to the transformer architecture that significantly reduces inference time. By redesigning the attention computation, the authors achieve a 40% speedup on standard benchmarks while maintaining comparable translation quality. The approach is particularly relevant for applications requiring low-latency responses.',
      '8m_operator_addendum': 'The technique modifies the query-key attention computation to use approximate nearest neighbors, trading off a small amount of precision for significant speed gains. Implementation requires changes to the attention layer but is compatible with existing transformer codebases.',
    },
  };
}

/**
 * Mock OpenRouter response for analysis
 */
export function createMockOpenRouterAnalysisResponse(analysis: PaperCardAnalysisResponse = createAnalysisFixture()) {
  return {
    id: 'gen-test-123',
    model: 'z-ai/glm-4.7',
    choices: [
      {
        message: {
          role: 'assistant',
          content: JSON.stringify(analysis),
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 1500,
      completion_tokens: 2000,
      total_tokens: 3500,
    },
  };
}
