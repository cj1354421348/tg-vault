-- completed_with_errors exceeds the former VARCHAR(20) limit and prevents job finalization.
ALTER TABLE telegram_background_jobs
    ALTER COLUMN status TYPE TEXT;

-- Preserve completed-card authorization, task mappings and failures after UI cleanup.
CREATE TABLE IF NOT EXISTS telegram_task_receipts (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    user_id BIGINT NOT NULL,
    job_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    group_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    failures JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
