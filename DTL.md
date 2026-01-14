# DTL-P: Deterministic Translation Layer for Public Audiences

> Full specification for the paper analysis and visualization system.

---

## High-level Outcome

For every paper, compute and store a structured "Paper Card" analysis. Visualize it in the UI. Maintain a persistent evolving taxonomy registry so the analysis agent can reuse existing labels and propose new ones under strict rules.

---

## Core Concepts

### 1. Forced Labels

Every paper must have these two labels:

- **Role** (forced choice): `Primitive` | `Platform` | `Proof` | `Provocation`
- **Time-to-value** (forced choice): `Now` | `Soon` | `Later` | `Unknown`

These must always be present, even if confidence is low.

### 2. Interestingness Scoring

Every paper gets a 6-part score. Each part is scored 0/1/2 and must include:
- A short answer (1–2 sentences)
- At least one evidence pointer (table/figure/section identifier, or "not available in provided text")

**Total score**: 0–12

**Interest tiers**:
- 0–3: Low
- 4–6: Moderate
- 7–9: High
- 10–12: Very High

### 3. Taxonomy-backed Use-case Mapping

We maintain a persistent taxonomy of use-cases. For each paper, map it to 0–5 use-cases from the taxonomy, each with:
- `use_case_id`
- `fit_confidence`: low | med | high
- `because`: one sentence tied to evidence

If no use-case fits, allow empty mapping.

### 4. Controlled Taxonomy Evolution

The analysis agent must:
1. Attempt to match existing taxonomy first
2. Only propose a new taxonomy entry if it cannot map to existing ones with a one-sentence "because"
3. New entries start as `provisional`
4. Require admin action before promotion to `active`

---

## Data Schema

### PaperCardAnalysis Fields

```
analysis_version: string (e.g., "dtlp_v1")
paper_id: existing internal ID
created_at, updated_at: timestamps

role: enum (Primitive | Platform | Proof | Provocation)
role_confidence: float 0–1

time_to_value: enum (Now | Soon | Later | Unknown)
time_to_value_confidence: float 0–1

interestingness:
  total_score: int 0–12
  tier: enum (low | moderate | high | very_high)
  checks: array of 6, each:
    check_id: one of:
      - business_primitive_impact
      - delta_specificity
      - comparison_credibility
      - real_world_plausibility
      - evidence_strength
      - failure_disclosure
    score: 0 | 1 | 2
    answer: 1–2 sentences
    evidence_pointers: array of strings (e.g., "Table 2", "Figure 3", "Section 4.1", or "Not available")
    notes: optional string for nuance

business_primitives:
  selected: array of 0–2 from (cost | reliability | speed | quality | risk | new_capability)
  justification: string (1–2 sentences)
  evidence_pointers: array of strings

key_numbers: array of up to 3, each:
  metric_name: string
  value: string
  direction: up | down
  baseline: optional string
  conditions: string (dataset/task/setup)
  evidence_pointer: string

constraints: array of up to 3, each:
  constraint: string
  why_it_matters: string
  evidence_pointer: string

failure_modes: array of up to 3, each:
  failure_mode: string
  why_it_matters: string
  evidence_pointer: string

what_is_missing: array of strings (uncertainty missing, no robustness, weak baselines, etc.)

readiness_level: enum (research_only | prototype_candidate | deployable_with_work)
readiness_justification: string
readiness_evidence_pointers: array of strings

use_case_mapping: array of 0–5, each:
  use_case_id: string
  use_case_name: string (denormalized for display)
  fit_confidence: low | med | high
  because: string
  evidence_pointers: array of strings

taxonomy_proposals: array (can be empty), each:
  type: "use_case"
  proposed_name: string
  definition: 1–3 sentences
  inclusions: array of strings
  exclusions: array of strings
  synonyms: array of strings
  examples: array of 3 strings
  rationale: why existing taxonomy doesn't fit

public_views:
  hook_sentence: 1 sentence with a number + condition where possible
  30s_summary: 3–5 bullets
  3m_summary: 2–3 short paragraphs + bullets
  8m_operator_addendum: optional structured notes (test plan, risks)
```

All summaries must be derivable from the canonical data. No new claims.

### TaxonomyEntry Fields

```
id: stable string (uuid or slug)
type: "use_case"
name: string
definition: string
inclusions: array of strings
exclusions: array of strings
examples: array of 3 strings
synonyms: array of strings
status: active | deprecated | provisional
parent_id: optional (for future hierarchy)
created_at, updated_at: timestamps
version: int
usage_count: int (increment when used)
```

### Initial Taxonomy Seed (Active)

1. Customer support and service automation
2. Enterprise search and retrieval
3. Personalization and recommendations
4. Marketing content and lifecycle automation
5. Document processing (contracts, invoices, compliance)
6. Analytics and forecasting
7. Fraud, risk, and anomaly detection
8. Engineering productivity (coding, testing)
9. Agentic workflows (multi-step automation)

---

## Taxonomy Evolution Rules (Hard Constraints)

1. Always attempt mapping to existing entries first
2. New entry allowed only if:
   - It cannot be mapped to any existing entry with a one-sentence "because"
   - AND it is not a trivial synonym
3. New entries must be created as `provisional`
4. Promotion from provisional to active must NOT happen automatically (admin action required)
5. If two active entries overlap heavily (>50% same paper mappings), flag for merge suggestion

---

## Deterministic Scoring Definitions

### Check 1: business_primitive_impact
- **0**: No clear primitive impacted
- **1**: Plausible but vague or weak evidence
- **2**: Clear primitive impact with specific evidence

### Check 2: delta_specificity
- **0**: No measurable delta
- **1**: Qualitative delta only
- **2**: Quantitative delta with conditions

### Check 3: comparison_credibility
- **0**: Unclear or strawman baseline
- **1**: Baseline exists but questionable
- **2**: Strong baselines and fair comparison

### Check 4: real_world_plausibility
- **0**: Unrealistic resources or constraints not stated
- **1**: Feasible for some, unclear broadly
- **2**: Broadly plausible or explicitly designed for practical constraints

### Check 5: evidence_strength
- **0**: Single dataset, no robustness/ablations/error analysis
- **1**: Some strengthening signals
- **2**: Multiple datasets or strong robustness, ablations, variance, error breakdown

### Check 6: failure_disclosure
- **0**: None discussed
- **1**: Vague limitations
- **2**: Concrete failures or boundary tests

**Tier mapping**:
- 0–3: low
- 4–6: moderate
- 7–9: high
- 10–12: very_high

---

## Analysis Pipeline Requirements

### Inputs Available
- paper.title, paper.authors, paper.year, paper.venue, paper.url
- paper.abstract (always available)
- paper.full_text or extracted text (when available)
- Possibly structured sections, tables, figures

Use what exists. If only abstract is available, evidence pointers can be best-effort. If pointers are unknown, set "Not available" but explain.

### Deterministic Analysis Steps (per paper)

1. Load taxonomy registry into memory
2. Produce PaperCardAnalysis via the analysis agent (LLM) with strict JSON output
3. Validate JSON against schema. If invalid, retry with a stricter prompt. If still invalid, store an error object
4. Persist analysis linked to paper
5. Update taxonomy usage counts for used entries
6. If taxonomy_proposals exists, persist them as provisional entries (do not auto-activate)

### Idempotency

If analysis exists for a paper and `analysis_version` matches, do not recompute unless explicitly requested.

### Re-analysis

Allow "Re-run analysis" button for a paper, and a batch job for re-analyzing multiple papers.

---

## UI Requirements: Paper Card Visualization

### 1. Header
- Title, venue/year
- Role label badge (Primitive/Platform/Proof/Provocation)
- Time-to-value badge (Now/Soon/Later/Unknown)
- Interest tier badge + total score (0–12)

### 2. Interestingness Breakdown (6 checks)
Compact list or table:
- Check name
- Score 0/1/2
- 1–2 sentence answer
- Evidence pointer chips

### 3. Business Primitives
Selected primitives (0–2) with justification + evidence pointers

### 4. Key Numbers (top 3)
Each as a small card: metric, value, baseline, conditions, evidence pointer

### 5. Constraints and Failure Modes
Two columns:
- Constraints (top 3)
- Failure modes (top 3)
Each with why it matters + evidence pointer

### 6. Use-case Mapping
List 0–5 use-cases with confidence and "because" line

### 7. What's Missing
Bulleted list

### 8. Public Outputs
Tabs:
- Hook sentence
- 30-second summary
- 3-minute summary
- 8-minute operator addendum (if any)

### 9. Taxonomy Proposals (Admin)
Show proposed categories with status provisional, and an "Admin: promote to active" action if admin mode enabled.

---

## LLM Agent Design

### A. Strict JSON Contract
The agent must output JSON only, no prose, matching the schema exactly.

### B. Evidence Discipline
For every key claim, include an evidence pointer. If not available, explicitly say "Not available" and downgrade relevant scores.

### C. Controlled Creativity
The agent can simplify language for summaries, but must not invent claims. All "implications" must be marked as implications and must not affect scores unless backed by paper evidence.

### D. Prompt Template

```
SYSTEM:
You are an analysis engine that produces a structured PaperCardAnalysis for a public business audience. You must be accurate, skeptical, and never invent results. Output strict JSON matching the schema. If evidence pointers are unknown, use "Not available". Prefer conservative scoring.

USER INPUT:
- Paper metadata (title, authors, venue, year)
- Abstract and/or full text
- Existing taxonomy entries (active + provisional) with names, definitions, synonyms

TASK:
1. Assign role (forced choice) + confidence
2. Assign time-to-value (forced choice) + confidence
3. Select up to 2 business primitives affected, or none
4. Score 6 interestingness checks (0/1/2) with 1–2 sentence answers and evidence pointers
5. Extract up to 3 key numbers with conditions and evidence pointers
6. List up to 3 constraints and up to 3 failure modes with evidence pointers
7. List what's missing
8. Decide readiness level with justification and evidence pointers
9. Map to 0–5 existing use-cases with confidence and evidence-backed "because"
10. If no existing use-case fits, propose at most 1 new provisional use-case entry
11. Produce public views (hook, 30s, 3m, 8m) derived from the canonical data

OUTPUT:
JSON only, matching PaperCardAnalysis schema exactly.
```

### E. Taxonomy Proposal Constraints (embedded in prompt)
- Must try to map first
- Propose at most 1 new use-case per paper
- Proposals must be provisional
- Proposals must include non-overlapping inclusions/exclusions

---

## Implementation Checklist

- [ ] Add database tables for PaperCardAnalysis and TaxonomyEntry
- [ ] Seed initial taxonomy entries
- [ ] Implement analysis runner with JSON schema validation
- [ ] Create analysis worker with queue
- [ ] Add UI Paper Card panel
- [ ] Add "Re-run analysis" button
- [ ] Add admin actions for taxonomy proposals
- [ ] Add tests for validation and idempotency

---

*Last updated: January 14, 2026*
