import { query } from '../db/index.js';

export interface TaskReceipt {
    id: string;
    chatId: string;
    userId: number;
    jobIds: string[];
    groupIds: string[];
    failures: string[];
}

function strings(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export async function saveTaskReceipt(receipt: TaskReceipt): Promise<void> {
    await query(`INSERT INTO telegram_task_receipts (id, chat_id, user_id, job_ids, group_ids, failures)
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb)
        ON CONFLICT (id) DO UPDATE SET job_ids = EXCLUDED.job_ids, group_ids = EXCLUDED.group_ids, failures = EXCLUDED.failures`,
    [receipt.id, receipt.chatId, receipt.userId, JSON.stringify(receipt.jobIds), JSON.stringify(receipt.groupIds), JSON.stringify(receipt.failures)]);
}

export async function getTaskReceipt(id: string, userId: number): Promise<TaskReceipt | null> {
    const result = await query('SELECT * FROM telegram_task_receipts WHERE id = $1 AND user_id = $2', [id, userId]);
    const row = result.rows[0];
    if (!row) return null;
    return { id, userId, chatId: String(row.chat_id), jobIds: strings(row.job_ids), groupIds: strings(row.group_ids), failures: strings(row.failures) };
}

export async function taskReceiptFailures(receipt: TaskReceipt): Promise<string[]> {
    if (!receipt.jobIds.length) return receipt.failures;
    const result = await query(`SELECT i.file_name, COALESCE(i.last_error, i.error) AS error
        FROM telegram_download_items i JOIN telegram_background_jobs j ON j.id = i.job_id
        WHERE j.id = ANY($1::uuid[]) AND j.user_id = $2 AND j.chat_id = $3 AND i.status = 'failed'
        ORDER BY i.updated_at DESC LIMIT 30`, [receipt.jobIds, receipt.userId, receipt.chatId]);
    return [...result.rows.map(row => `${String(row.file_name || 'Telegram file')}: ${String(row.error || '下载失败')}`), ...receipt.failures];
}
