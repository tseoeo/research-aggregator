-- Add missing columns to paper_card_analyses table
-- Run this manually on production database to fix the schema

-- Add core_claim column if it doesn't exist
ALTER TABLE paper_card_analyses ADD COLUMN IF NOT EXISTS core_claim text;

-- Add prompt_hash column if it doesn't exist
ALTER TABLE paper_card_analyses ADD COLUMN IF NOT EXISTS prompt_hash varchar(64);

-- Add analysis_status column if it doesn't exist
ALTER TABLE paper_card_analyses ADD COLUMN IF NOT EXISTS analysis_status varchar(50) DEFAULT 'complete';

-- Add validation_errors column if it doesn't exist
ALTER TABLE paper_card_analyses ADD COLUMN IF NOT EXISTS validation_errors text[];

-- Verify the columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'paper_card_analyses'
AND column_name IN ('core_claim', 'prompt_hash', 'analysis_status', 'validation_errors');
