import { query } from '../db/index.js';
import { getSetting } from '../utils/settings.js';

export type TelegramDownloadHistoryPolicy = 'errors_only' | 'all';

export const DEFAULT_TELEGRAM_DOWNLOAD_HISTORY_POLICY: TelegramDownloadHistoryPolicy = 'errors_only';
export const TELEGRAM_DOWNLOAD_HISTORY_POLICY_SETTING = 'telegram_download_history_policy';

export function normalizeTelegramDownloadHistoryPolicy(value: unknown): TelegramDownloadHistoryPolicy {
    return value === 'all' ? 'all' : DEFAULT_TELEGRAM_DOWNLOAD_HISTORY_POLICY;
}

export function terminalStatusesToDelete(policy: TelegramDownloadHistoryPolicy): Array<'success' | 'skipped'> {
    return policy === 'errors_only' ? ['success', 'skipped'] : [];
}

export async function getTelegramDownloadHistoryPolicy(): Promise<TelegramDownloadHistoryPolicy> {
    return normalizeTelegramDownloadHistoryPolicy(await getSetting(
        TELEGRAM_DOWNLOAD_HISTORY_POLICY_SETTING,
        DEFAULT_TELEGRAM_DOWNLOAD_HISTORY_POLICY,
    ));
}

export async function compactTelegramDownloadHistory(jobId?: string): Promise<number> {
    const policy = await getTelegramDownloadHistoryPolicy();
    const statuses = terminalStatusesToDelete(policy);
    if (statuses.length === 0) return 0;
    await query(`UPDATE telegram_background_jobs j SET params = j.params || jsonb_build_object(
        'completedBytes', COALESCE((SELECT SUM(total_size) FROM telegram_download_items WHERE job_id=j.id AND status='success'),0),
        'savedUnknownCount', (SELECT COUNT(*) FROM telegram_download_items WHERE job_id=j.id AND status='success' AND COALESCE(total_size,0)<=0))
        WHERE j.finished_at IS NOT NULL AND ($1::uuid IS NULL OR j.id=$1::uuid)
          AND EXISTS (SELECT 1 FROM telegram_download_items WHERE job_id=j.id AND status='success')`, [jobId || null]);
    const result = await query(
        `DELETE FROM telegram_download_items i
         USING telegram_background_jobs j
         WHERE i.job_id = j.id
           AND i.status = ANY($1::varchar[])
           AND j.finished_at IS NOT NULL
           AND ($2::uuid IS NULL OR j.id = $2::uuid)`,
        [statuses, jobId || null],
    );
    return result.rowCount || 0;
}
