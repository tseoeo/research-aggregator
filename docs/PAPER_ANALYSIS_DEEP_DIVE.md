# Paper Analysis System Deep Dive

## Overview

This document provides a comprehensive analysis of how research papers are analyzed in the Research Aggregator codebase. The system uses AI-powered analysis to extract structured business-relevant information from academic papers, making research more accessible to non-technical audiences.

The analysis system has **two distinct layers**:
1. **Simple Summaries** (OpenRouter Service) - Quick 3-bullet summaries + ELI5 explanations
2. **DTL-P Analysis** (Paper Analysis Service) - Comprehensive structured analysis for business audiences

---

## Table of Contents

1. [DTL-P Framework](#dtl-p-framework)
2. [System Architecture](#system-architecture)
3. [Analysis Components](#analysis-components)
   - [Role Classification](#1-role-classification)
   - [Time to Value Assessment](#2-time-to-value-assessment)
   - [Interestingness Scoring](#3-interestingness-scoring)
   - [Business Primitives](#4-business-primitives-identification)
   - [Key Numbers Extraction](#5-key-numbers-extraction)
   - [Constraints Identification](#6-constraints-identification)
   - [Failure Modes](#7-failure-modes)
   - [What is Missing](#8-what-is-missing)
   - [Readiness Level](#9-readiness-level-assessment)
   - [Use Case Mappings](#10-use-case-mappings)
   - [Public Views](#11-public-views)
   - [Taxonomy Proposals](#12-taxonomy-proposals)
4. [Simple Summary System](#simple-summary-system)
5. [Database Schema](#database-schema)
6. [API Routes](#api-routes)
7. [Worker Jobs](#worker-jobs)
8. [UI Components](#ui-components)
9. [Implementation Critique](#implementation-critique)
10. [Recommendations](#recommendations)

---

## DTL-P Framework

**DTL-P stands for: Deterministic Translation Layer for Public audiences**

This is the core philosophy behind the analysis system. The goal is to translate complex academic research into structured, consistent, business-relevant information that non-technical stakeholders can understand and act upon.

### Key Principles

1. **Deterministic**: The analysis follows strict schemas and scoring rubrics to ensure consistent output
2. **Translation**: Converts academic jargon into business-relevant insights
3. **Public Audience**: Designed for business decision-makers, not researchers
4. **Structured Output**: JSON schema enforces consistent data structure

**Source File**: `/src/lib/services/paper-analysis.ts`

---

## System Architecture

```
+------------------+     +-----------------+     +------------------+
|   Paper Ingest   | --> |   Job Queues    | --> |   AI Services    |
|   (arXiv Worker) |     |   (BullMQ)      |     |   (OpenRouter)   |
+------------------+     +-----------------+     +------------------+
                                |                        |
                                v                        v
                         +-----------------+     +------------------+
                         |    Database     | <-- |  Analysis Worker |
                         |   (PostgreSQL)  |     |  Summary Worker  |
                         +-----------------+     +------------------+
                                |
                                v
                         +-----------------+
                         |   UI Display    |
                         | (React/Next.js) |
                         +-----------------+
```

### Flow of Analysis

1. **Paper Ingestion**: `arxiv-worker.ts` fetches papers from arXiv
2. **Queue Jobs**: Papers are queued for both summary and DTL-P analysis
3. **Summary Generation**: `summary-worker.ts` generates quick summaries
4. **DTL-P Analysis**: `analysis-worker.ts` generates comprehensive analysis
5. **Database Storage**: Results stored in `paper_card_analyses` table
6. **Use Case Mapping**: Mappings stored in `paper_use_case_mappings` table
7. **UI Display**: React components render the analysis data

### AI Configuration

The system uses OpenRouter as the AI gateway with configurable models:

```typescript
// Default model (from /src/lib/services/paper-analysis.ts)
this.model = model || process.env.OPENROUTER_MODEL || "z-ai/glm-4.7";

// JSON mode is only enabled for supported providers
const JSON_MODE_SUPPORTED_PREFIXES = ["openai/", "google/", "anthropic/"];
```

**AI Toggle**: `AI_ENABLED=true` must be set to enable AI processing.

---

## Analysis Components

### 1. Role Classification

**What it measures**: The fundamental type/purpose of the research paper.

**Possible Values**:

| Role | Description | Example |
|------|-------------|---------|
| **Primitive** | Introduces a fundamental new capability or building block | New algorithm, technique, or foundational method |
| **Platform** | Provides infrastructure or tools that enable other applications | Framework, library, or toolkit for developers |
| **Proof** | Demonstrates feasibility or validates a concept | Shows something is possible, benchmarks a method |
| **Provocation** | Challenges assumptions or proposes unconventional ideas | Questions established methods, proposes new directions |

**Prompt Instructions**:
```
Assign role (Primitive/Platform/Proof/Provocation) with confidence 0-1
```

**Confidence Calculation**: The LLM provides a float between 0-1 representing its certainty.

**Storage**:
- `role`: varchar(50) in `paper_card_analyses`
- `roleConfidence`: double precision in `paper_card_analyses`

**UI Display**: `RoleBadge` component with color-coded icons:
- Primitive: Blue with Lightbulb icon
- Platform: Purple with Layers icon
- Proof: Green with FlaskConical icon
- Provocation: Orange with Sparkles icon

---

### 2. Time to Value Assessment

**What it measures**: How soon this research can be applied to real business problems.

**Possible Values**:

| Time to Value | Description | Timeline |
|--------------|-------------|----------|
| **Now** | Can be applied to business problems today with existing tools | Ready to use |
| **Soon** | Requires 6-18 months of engineering/productization | 6-18 months |
| **Later** | Requires significant research/infrastructure advances | 2+ years |
| **Unknown** | Cannot determine from available information | Unclear |

**Prompt Instructions**:
```
Assign time_to_value (Now/Soon/Later/Unknown) with confidence 0-1
```

**Confidence Calculation**: Float 0-1 from LLM.

**Storage**:
- `timeToValue`: varchar(50) in `paper_card_analyses`
- `timeToValueConfidence`: double precision in `paper_card_analyses`

**UI Display**: `TimeToValueBadge` with color-coded icons:
- Now: Emerald green with Zap icon
- Soon: Amber with Timer icon
- Later: Slate with Clock icon
- Unknown: Gray with HelpCircle icon

---

### 3. Interestingness Scoring

**What it measures**: A multi-dimensional assessment of how interesting/valuable the paper is for business applications.

**Overall Structure**:
```typescript
{
  total_score: number;  // 0-12
  tier: "low" | "moderate" | "high" | "very_high";
  checks: InterestingnessCheck[];  // 6 individual checks
}
```

**The 6 Interestingness Checks**:

#### 3.1 Business Primitive Impact (`business_primitive_impact`)
**What it measures**: Does this paper clearly impact a fundamental business primitive?

| Score | Criteria |
|-------|----------|
| 0 | No clear primitive impacted |
| 1 | Plausible but vague or weak evidence |
| 2 | Clear primitive impact with specific evidence |

#### 3.2 Delta Specificity (`delta_specificity`)
**What it measures**: Are improvements quantified with specific conditions?

| Score | Criteria |
|-------|----------|
| 0 | No measurable delta |
| 1 | Qualitative delta only |
| 2 | Quantitative delta with conditions |

#### 3.3 Comparison Credibility (`comparison_credibility`)
**What it measures**: Are baselines fair and credible?

| Score | Criteria |
|-------|----------|
| 0 | Unclear or strawman baseline |
| 1 | Baseline exists but questionable |
| 2 | Strong baselines and fair comparison |

#### 3.4 Real-World Plausibility (`real_world_plausibility`)
**What it measures**: Is this feasible in production environments?

| Score | Criteria |
|-------|----------|
| 0 | Unrealistic resources or constraints not stated |
| 1 | Feasible for some, unclear broadly |
| 2 | Broadly plausible or explicitly designed for practical constraints |

#### 3.5 Evidence Strength (`evidence_strength`)
**What it measures**: How robust is the experimental evidence?

| Score | Criteria |
|-------|----------|
| 0 | Single dataset, no robustness/ablations/error analysis |
| 1 | Some strengthening signals |
| 2 | Multiple datasets or strong robustness, ablations, variance, error breakdown |

#### 3.6 Failure Disclosure (`failure_disclosure`)
**What it measures**: Are limitations and failure modes discussed?

| Score | Criteria |
|-------|----------|
| 0 | None discussed |
| 1 | Vague limitations |
| 2 | Concrete failures or boundary tests |

**Tier Calculation** (derived from total_score):
```
0-3:   low
4-6:   moderate
7-9:   high
10-12: very_high
```

**Storage**: `interestingness` JSONB column storing the complete structure including all checks with evidence pointers.

**UI Display**:
- `InterestBadge` shows tier and score
- `AnalysisScoresTab` shows detailed breakdown of each check
- `ScorePill` component shows individual check scores (0=gray, 1=amber, 2=green)

---

### 4. Business Primitives Identification

**What it measures**: Which fundamental business metrics does this research impact?

**Possible Values** (max 2 can be selected):
- `cost` - Reduces operational or resource costs
- `reliability` - Improves system/process reliability
- `speed` - Increases throughput or reduces latency
- `quality` - Improves output quality
- `risk` - Reduces business/operational risk
- `new_capability` - Enables something previously impossible

**Schema**:
```typescript
{
  selected: string[];  // max 2 from the above list
  justification: string;
  evidence_pointers: string[];
}
```

**Storage**: `businessPrimitives` JSONB column

**UI Display**: `BusinessPrimitiveBadge` with color-coded pills:
- cost: Green
- reliability: Blue
- speed: Amber
- quality: Purple
- risk: Red
- new_capability: Indigo

---

### 5. Key Numbers Extraction

**What it measures**: Up to 3 quantitative results that matter most.

**Schema**:
```typescript
{
  metric_name: string;
  value: string;
  direction: "up" | "down";
  baseline?: string;
  conditions: string;
  evidence_pointer: string;
}
```

**Prompt Instructions**:
```
Extract up to 3 key numbers with conditions
```

**Storage**: `keyNumbers` JSONB array (max 3 entries)

**UI Display**: Card grid in `AnalysisBusinessTab` with:
- Arrow up (green) or arrow down (blue) icons
- Metric value prominently displayed
- Baseline comparison if available
- Conditions in small text

---

### 6. Constraints Identification

**What it measures**: Limitations that could prevent practical adoption.

**Schema**:
```typescript
{
  constraint: string;
  why_it_matters: string;
  evidence_pointer: string;
}
```

**Storage**: `constraints` JSONB array (max 3 entries)

**UI Display**: In `AnalysisRisksTab` with AlertTriangle icon (amber)

---

### 7. Failure Modes

**What it measures**: Known ways the approach can fail.

**Schema**:
```typescript
{
  failure_mode: string;
  why_it_matters: string;
  evidence_pointer: string;
}
```

**Storage**: `failureModes` JSONB array (max 3 entries)

**UI Display**: In `AnalysisRisksTab` with XCircle icon (red), bordered cards with red tint

---

### 8. What is Missing

**What it measures**: Gaps in the paper that would be needed for practical application.

**Schema**: Array of strings

**Storage**: `whatIsMissing` text array column

**UI Display**: Bullet list in `AnalysisRisksTab` with Info icon (blue)

---

### 9. Readiness Level Assessment

**What it measures**: How ready is this research for production deployment?

**Possible Values**:

| Level | Label | Description | Recommended Action |
|-------|-------|-------------|-------------------|
| `research_only` | Research | Only proven in academic/lab settings | Monitor for future developments |
| `prototype_candidate` | Prototype | Ready for internal POC/prototype | Consider for internal pilots |
| `deployable_with_work` | Deployable | Could be deployed with reasonable engineering effort | Evaluate for production use |

**Schema**:
```typescript
{
  readinessLevel: string;
  readinessJustification: string;
  readinessEvidencePointers: string[];
}
```

**Storage**:
- `readinessLevel`: varchar(50)
- `readinessJustification`: text
- `readinessEvidencePointers`: text array

**UI Display**: `ReadinessBadge` with icons:
- research_only: Beaker icon (gray)
- prototype_candidate: Package icon (blue)
- deployable_with_work: Rocket icon (green)

---

### 10. Use Case Mappings

**What it measures**: Which existing use cases from the taxonomy does this paper apply to?

**Schema**:
```typescript
{
  use_case_id: string;
  use_case_name: string;
  fit_confidence: "low" | "med" | "high";
  because: string;
  evidence_pointers: string[];
}
```

**Prompt Instructions**:
```
Map to 0-5 existing use-cases with confidence and "because"
```

**Storage**:
- Primary analysis stored in JSONB
- Persisted to `paper_use_case_mappings` join table
- Links to `taxonomy_entries` table
- Updates `usageCount` on taxonomy entries

**UI Display**: `AnalysisUseCasesTab` with:
- Target icon
- Use case name and definition
- `FitConfidenceBadge` showing low/med/high

---

### 11. Public Views

**What it measures**: Human-readable summaries at different time depths.

**Schema**:
```typescript
{
  hook_sentence: string;      // One compelling sentence
  "30s_summary": string[];    // 1-5 bullet points
  "3m_summary": string;       // 2-3 paragraph summary
  "8m_operator_addendum"?: string;  // Optional technical deep dive
}
```

**Storage**: `publicViews` JSONB column

**UI Display**: `AnalysisSummaryTab` with:
- Hook sentence in highlighted box
- Quick takeaways as bulleted list with checkmarks
- Detailed summary as paragraphs
- Technical deep dive in muted box (if present)

---

### 12. Taxonomy Proposals

**What it measures**: When no existing use case fits, the LLM can propose new taxonomy entries.

**Schema**:
```typescript
{
  type: "use_case";
  proposed_name: string;
  definition: string;
  inclusions: string[];
  exclusions: string[];
  synonyms: string[];
  examples: string[];
  rationale: string;
}
```

**Prompt Instructions**:
```
If no existing use-case fits well, propose at most 1 new provisional entry
```

**Storage**:
- Stored in `taxonomyProposals` JSONB on analysis
- Also inserted into `taxonomy_entries` table with `status: "provisional"`

**UI Display**: Not currently displayed in UI (admin review workflow not implemented)

---

## Simple Summary System

In addition to DTL-P analysis, there's a simpler summary system:

**Source**: `/src/lib/services/openrouter.ts`

**Output Schema**:
```typescript
{
  bullets: string[];  // Exactly 3 key points
  eli5: string;       // Simple explanation (2-3 sentences)
}
```

**System Prompt**:
```
You are an expert research paper summarizer. Your task is to analyze
academic papers and provide clear, accurate summaries.

Guidelines:
- bullets: Exactly 3 key points about the paper's main contributions,
  findings, or innovations. Each bullet should be 1-2 sentences,
  clear and informative.
- eli5: A simple explanation (2-3 sentences) that a non-expert could
  understand. Avoid jargon, use analogies where helpful.
```

**Storage** (in `papers` table):
- `summaryBullets`: text array (3 bullets)
- `summaryEli5`: text
- `summaryGeneratedAt`: timestamp
- `summaryModel`: varchar(100)

---

## Database Schema

### Primary Analysis Table: `paper_card_analyses`

```sql
CREATE TABLE paper_card_analyses (
  id UUID PRIMARY KEY,
  paper_id UUID REFERENCES papers(id) ON DELETE CASCADE,
  analysis_version VARCHAR(50) DEFAULT 'dtlp_v1',

  -- Core Classification
  role VARCHAR(50) NOT NULL,
  role_confidence DOUBLE PRECISION NOT NULL,
  time_to_value VARCHAR(50) NOT NULL,
  time_to_value_confidence DOUBLE PRECISION NOT NULL,

  -- Interestingness (JSONB for flexibility)
  interestingness JSONB NOT NULL,

  -- Business Impact
  business_primitives JSONB,
  key_numbers JSONB,

  -- Risks
  constraints JSONB,
  failure_modes JSONB,
  what_is_missing TEXT[],

  -- Readiness
  readiness_level VARCHAR(50),
  readiness_justification TEXT,
  readiness_evidence_pointers TEXT[],

  -- Public Views
  public_views JSONB,

  -- Taxonomy Proposals
  taxonomy_proposals JSONB,

  -- Metadata
  analysis_model VARCHAR(100),
  tokens_used INTEGER,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(paper_id)
);
```

### Use Case Mappings Table: `paper_use_case_mappings`

```sql
CREATE TABLE paper_use_case_mappings (
  analysis_id UUID REFERENCES paper_card_analyses(id) ON DELETE CASCADE,
  taxonomy_entry_id UUID REFERENCES taxonomy_entries(id) ON DELETE CASCADE,
  fit_confidence VARCHAR(20) NOT NULL,
  because TEXT NOT NULL,
  evidence_pointers TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),

  PRIMARY KEY (analysis_id, taxonomy_entry_id)
);
```

### Taxonomy Table: `taxonomy_entries`

```sql
CREATE TABLE taxonomy_entries (
  id UUID PRIMARY KEY,
  type VARCHAR(50) DEFAULT 'use_case',
  name VARCHAR(255) UNIQUE NOT NULL,
  definition TEXT,
  inclusions TEXT[],
  exclusions TEXT[],
  examples TEXT[],
  synonyms TEXT[],
  status VARCHAR(50) DEFAULT 'active',  -- active | deprecated | provisional
  parent_id UUID,  -- For future hierarchy
  usage_count INTEGER DEFAULT 0,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## API Routes

### Analysis Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/papers/[id]/analysis` | Get DTL-P analysis by paper UUID |
| GET | `/api/papers/arxiv/[arxivId]/analysis` | Get DTL-P analysis by arXiv ID |

### Summary Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/papers/[id]/summary` | Get or generate simple summary |
| POST | `/api/papers/[id]/summary` | Force generate simple summary |

### Admin Endpoints (require `ADMIN_SECRET`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/queue-analyses` | Count papers needing analysis |
| POST | `/api/admin/queue-analyses` | Queue papers for analysis |
| GET | `/api/admin/backfill-analysis` | Get backfill status |
| POST | `/api/admin/backfill-analysis` | Start analysis backfill |

---

## Worker Jobs

### Analysis Worker (`analysis-worker.ts`)

**Queue Name**: `paper-analysis`

**Concurrency**: 1 (one at a time - analysis is expensive)

**Rate Limit**: Max 5 jobs per minute

**Job Data**:
```typescript
{
  paperId: string;
  title: string;
  abstract: string;
  authors?: string[];
  year?: number;
  force?: boolean;  // Force re-analysis
  model?: string;   // Model override
}
```

**Processing Flow**:
1. Check for existing analysis (skip if exists unless `force=true`)
2. Load taxonomy context from database
3. Call OpenRouter API with system + user prompts
4. Parse and validate JSON response with Zod
5. Normalize data (handle LLM inconsistencies)
6. Insert into `paper_card_analyses`
7. Process use-case mappings to `paper_use_case_mappings`
8. Save taxonomy proposals as provisional entries

### Summary Worker (`summary-worker.ts`)

**Queue Name**: `summary-generation`

**Concurrency**: 2

**Rate Limit**: Max 10 jobs per minute

**Job Data**:
```typescript
{
  paperId: string;
  title: string;
  abstract: string;
  model?: string;
}
```

---

## UI Components

### Badge Components (`/src/components/papers/analysis-badges.tsx`)

| Component | Props | Description |
|-----------|-------|-------------|
| `RoleBadge` | role, confidence?, showLabel? | Displays paper role with tooltip |
| `TimeToValueBadge` | ttv, confidence?, showLabel? | Time to value with tooltip |
| `InterestBadge` | tier, score, showLabel? | Interest tier with score |
| `ReadinessBadge` | level, showLabel? | Readiness level |
| `BusinessPrimitiveBadge` | primitive | Single business primitive |
| `FitConfidenceBadge` | fit | Use case fit confidence |
| `ConfidenceIndicator` | confidence, size? | Visual confidence bar |
| `AnalysisBadgesRow` | role, timeToValue, etc. | Compact row of all badges |

### Analysis Panel (`/src/components/papers/analysis-panel.tsx`)

Tabbed interface with 5 tabs:
1. **Summary** - Hook sentence + quick takeaways + detailed summary
2. **Scores** - Interestingness score breakdown
3. **Business** - Primitives, key numbers, readiness
4. **Risks** - Constraints, failure modes, what's missing
5. **Use Cases** - Mapped use cases with confidence

---

## Implementation Critique

### Strengths

1. **Well-Structured Schema**: The Zod schemas are comprehensive and well-documented
2. **Data Normalization**: The `normalizeAnalysisResponse` function handles common LLM inconsistencies gracefully
3. **Taxonomy Integration**: Use case mappings are properly linked to a taxonomy system
4. **Evidence Pointers**: Every assessment includes evidence pointers for traceability
5. **Multi-Level Summaries**: 30s/3m/8m summaries serve different audience needs
6. **Idempotency**: Workers check for existing analysis before processing
7. **Graceful Degradation**: System handles missing API keys and disabled AI

### Weaknesses

1. **Abstract-Only Analysis**: The LLM only sees title + abstract, not the full paper
   - Many key numbers, constraints, and failure modes are in the body
   - Evidence pointers reference sections the LLM hasn't seen

2. **No PDF Processing**: The system doesn't extract or analyze the actual paper content
   - Limits the depth of analysis possible
   - Evidence pointers are fabricated/guessed

3. **Confidence Without Calibration**: Confidence scores are not calibrated or validated
   - No mechanism to verify if 80% confidence actually means 80% accuracy
   - LLMs tend to be overconfident

4. **Single Model Dependency**: All analysis depends on one LLM call
   - No ensemble or cross-validation
   - Model-specific biases affect all papers

5. **Missing Version Migration**: Analysis version is stored but no migration path
   - No way to re-analyze papers when prompts improve
   - `force` flag exists but requires manual triggering

6. **Incomplete Taxonomy Workflow**: Provisional taxonomy entries have no review process
   - They accumulate without curation
   - No way to promote provisional -> active in UI

7. **No Confidence Thresholds**: Low-confidence analyses are treated same as high-confidence
   - No flagging for human review
   - No uncertainty propagation to UI

8. **Prompt Engineering Issues**:
   - System prompt is very long (may exceed optimal context)
   - JSON schema in prompt is duplicated from Zod schema
   - No few-shot examples for edge cases

9. **Business Framing Needs a Core-Claim Anchor**: Business translation is valuable, but there is no single authoritative “what the paper is about” field
   - Business primitives can dominate the narrative without a short, factual core claim
   - Readers need a one-sentence scientific summary before the business framing
10. **Missing Temporal Context**: No handling for papers that supersede others
   - No "this paper obsoletes X" tracking
   - Time-to-value doesn't account for competition

10. **No Domain Specificity**: Same prompt for all categories
    - cs.AI paper analyzed same as q-bio.NC
    - Business primitives may not apply to all domains

### Edge Cases Not Handled

1. **Survey Papers**: Papers that review many methods don't fit the single-method schema
2. **Dataset Papers**: Papers introducing datasets have different value propositions
3. **Negative Results**: Papers showing something doesn't work
4. **Position Papers**: Opinion/perspective papers without experiments
5. **Non-English Abstracts**: No language detection or translation
6. **Very Short Abstracts**: Some papers have minimal abstracts
7. **Highly Technical Papers**: May not have business-relevant insights

---

## Recommendations

### High Priority

1. **Add PDF Processing**
   - Integrate a PDF extraction service
   - Provide full paper text to LLM (with chunking if needed)
   - Validate evidence pointers against actual content

2. **Implement Confidence Thresholds**
   - Flag analyses with low confidence for human review
   - Show confidence visually in UI (not just tooltip)
   - Consider hiding low-confidence assertions

3. **Add Domain-Specific Prompts**
   - Create category-specific prompt variants
   - Adjust business primitives for non-CS domains
   - Consider different value frameworks for different fields

4. **Taxonomy Review Workflow**
   - Add admin UI for reviewing provisional entries
   - Track provenance (which papers proposed which entries)
   - Enable promotion/rejection with notes

5. **Add a Core Claim Field (Human-Usable Anchor)**
   - Require a single-sentence summary of the paper’s main scientific contribution
   - Always display this before business primitives and time-to-value
   - Makes the business framing more credible and readable

### Medium Priority

5. **Multi-Model Ensemble**
   - Run analysis with multiple models
   - Compare results and flag discrepancies
   - Use agreement as a confidence signal

6. **Prompt Optimization**
   - A/B test different prompt variations
   - Add few-shot examples for difficult cases
   - Consider chain-of-thought for complex reasoning

7. **Analysis Comparison**
   - Store multiple analysis versions per paper
   - Show how analysis changed over time
   - Track model performance by version

8. **Paper Type Detection**
   - Add pre-classification for paper types
   - Use different schemas for surveys, datasets, etc.
   - Handle special cases appropriately

### Low Priority

9. **Competitive Analysis**
   - Track related/competing papers
   - Update time-to-value based on competitive landscape
   - Show "superseded by" relationships

10. **User Feedback Loop**
    - Allow users to flag incorrect analyses
    - Use feedback to improve prompts
    - Build evaluation dataset

11. **Cost Optimization**
   - Cache common analysis patterns
   - Use smaller models for simpler papers
   - Batch similar papers for efficiency

---

## Failsafes & Guardrails (Additive)

These are pragmatic safeguards to reduce incorrect output, improve determinism, and prevent bad data from reaching users.

1. **Determinism Guardrail**
   - Set temperature to `0` for analysis calls
   - Store a `prompt_hash` and only re-run when it changes or `force=true`
   - Prevents analysis drift across repeated runs

2. **Evidence Anchoring**
   - Pre-split abstract into numbered sentences: `S1`, `S2`, `S3`, ...
   - Require evidence pointers to reference only these IDs
   - If not available, use `"Not available"`

3. **Low-Confidence Quarantine**
   - If any of the top-level confidence fields < 0.4, mark the analysis as “low confidence”
   - Hide business primitives and time-to-value from default UI view in that case

4. **Schema Integrity Checks**
   - Reject outputs with missing required fields instead of auto-coercing
   - Store a `status = partial` so failures are visible

5. **Known-Paper Type Guard**
   - If paper type is “survey” or “dataset,” skip irrelevant fields (constraints/failure modes) or mark as “not applicable”

---

## How To Know The System Works Well (Monitoring & Quality)

Add a lightweight quality dashboard using stored metadata and periodic evaluation.

1. **Determinism Rate**
   - Track how often re-running the same paper yields the same normalized output
   - Goal: > 95% match when prompt/model is unchanged

2. **Evidence Coverage**
   - Percentage of evidence pointers that reference valid `S#` anchors
   - Goal: > 90% valid evidence anchors

3. **Human Usefulness Score**
   - Add a simple user feedback toggle: “Helpful / Not helpful”
   - Track rolling 30-day helpfulness rate

4. **Confidence Distribution**
   - Monitor distribution of role/time-to-value confidence
   - If most scores cluster high, adjust prompt to be more conservative

5. **Completeness Rate**
   - Percentage of analyses that pass strict schema validation without coercion
   - Goal: > 98%

6. **Drift Alerts**
   - If a prompt/model change causes > X% shift in core fields, flag and review


---

## Appendix: Complete System Prompt

```
You are an analysis engine that produces a structured PaperCardAnalysis for
a public business audience. You must be accurate, skeptical, and never invent
results. Output strict JSON matching the schema. If evidence pointers are
unknown, use "Not available". Prefer conservative scoring.

## Scoring Guidelines

### Role (forced choice)
- Primitive: Introduces a fundamental new capability or building block
- Platform: Provides infrastructure or tools that enable other applications
- Proof: Demonstrates feasibility or validates a concept
- Provocation: Challenges assumptions or proposes unconventional ideas

### Time-to-value (forced choice)
- Now: Can be applied to business problems today with existing tools
- Soon: Requires 6-18 months of engineering/productization
- Later: Requires significant research/infrastructure advances (2+ years)
- Unknown: Cannot determine from available information

### Interestingness Checks (score 0/1/2)

1. business_primitive_impact
   - 0: No clear primitive impacted
   - 1: Plausible but vague or weak evidence
   - 2: Clear primitive impact with specific evidence

2. delta_specificity
   - 0: No measurable delta
   - 1: Qualitative delta only
   - 2: Quantitative delta with conditions

3. comparison_credibility
   - 0: Unclear or strawman baseline
   - 1: Baseline exists but questionable
   - 2: Strong baselines and fair comparison

4. real_world_plausibility
   - 0: Unrealistic resources or constraints not stated
   - 1: Feasible for some, unclear broadly
   - 2: Broadly plausible or explicitly designed for practical constraints

5. evidence_strength
   - 0: Single dataset, no robustness/ablations/error analysis
   - 1: Some strengthening signals
   - 2: Multiple datasets or strong robustness, ablations, variance, error breakdown

6. failure_disclosure
   - 0: None discussed
   - 1: Vague limitations
   - 2: Concrete failures or boundary tests

### Interest Tier (derived from total_score)
- 0-3: low
- 4-6: moderate
- 7-9: high
- 10-12: very_high

### Business Primitives
Select 0-2 from: cost, reliability, speed, quality, risk, new_capability

### Readiness Level
- research_only: Only proven in academic settings
- prototype_candidate: Ready for internal POC/prototype
- deployable_with_work: Could be deployed with reasonable engineering effort

## Required JSON Schema (follow EXACTLY)
{
  "role": "Primitive" | "Platform" | "Proof" | "Provocation",
  "role_confidence": 0.0-1.0,
  "time_to_value": "Now" | "Soon" | "Later" | "Unknown",
  "time_to_value_confidence": 0.0-1.0,
  "interestingness": {...},
  "business_primitives": {...},
  "key_numbers": [...],
  "constraints": [...],
  "failure_modes": [...],
  "what_is_missing": [...],
  "readiness_level": "...",
  "readiness_justification": "...",
  "readiness_evidence_pointers": [...],
  "use_case_mapping": [...],
  "taxonomy_proposals": [],
  "public_views": {...}
}

Output valid JSON only. No markdown, no explanations, just the JSON object.
```

---

## Appendix: Key File Locations

| Component | File Path |
|-----------|-----------|
| DTL-P Analysis Service | `/src/lib/services/paper-analysis.ts` |
| Simple Summary Service | `/src/lib/services/openrouter.ts` |
| Database Schema | `/src/lib/db/schema.ts` |
| Analysis Worker | `/src/lib/queue/workers/analysis-worker.ts` |
| Summary Worker | `/src/lib/queue/workers/summary-worker.ts` |
| arXiv Worker | `/src/lib/queue/workers/arxiv-worker.ts` |
| Queue Definitions | `/src/lib/queue/queues.ts` |
| AI Config | `/src/lib/ai/config.ts` |
| Analysis API Route | `/src/app/api/papers/[id]/analysis/route.ts` |
| Analysis Badges | `/src/components/papers/analysis-badges.tsx` |
| Analysis Panel | `/src/components/papers/analysis-panel.tsx` |
| Paper Card | `/src/components/papers/paper-card.tsx` |

---

*Document generated: February 2024*
*Analysis version: dtlp_v1*
