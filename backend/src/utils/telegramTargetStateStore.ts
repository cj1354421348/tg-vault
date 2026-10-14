import { query } from '../db/index.js';

export type TelegramTargetMode = 'once' | 'session';
export interface TelegramTargetSelection {
    provider: string;
    accountId: string | null;
    mode: TelegramTargetMode;
    version?: string;
}

export type TelegramTargetStateQuery = (
    sql: string,
    params: unknown[],
) => Promise<{ rows: any[]; rowCount: number | null }>;

const defaultQuery: TelegramTargetStateQuery = (sql, params) => query(sql, params) as any;

export async function setTelegramTargetState(
    runQuery: TelegramTargetStateQuery = defaultQuery,
    chatId: string,
    mode: TelegramTargetMode,
    provider: string,
    accountId: string | null,
    expiresAt: Date,
): Promise<void> {
    await runQuery(
        `INSERT INTO telegram_target_states (chat_id, mode, provider, account_id, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (chat_id, mode)
         DO UPDATE SET provider = EXCLUDED.provider, account_id = EXCLUDED.account_id,
                       expires_at = EXCLUDED.expires_at, updated_at = NOW()`,
        [chatId, mode, provider, accountId, expiresAt],
    );
}

function mapRow(row: any): TelegramTargetSelection | null {
    if (!row) return null;
    return {
        provider: String(row.provider),
        accountId: row.account_id == null ? null : String(row.account_id),
        mode: String(row.mode) as TelegramTargetMode,
        ...(row.version == null ? {} : { version: String(row.version) }),
    };
}

export async function consumeTelegramTargetState(
    runQuery: TelegramTargetStateQuery = defaultQuery,
    chatId: string,
): Promise<TelegramTargetSelection | null> {
    const result = await runQuery(
        `DELETE FROM telegram_target_states
         WHERE chat_id = $1 AND mode = 'once' AND expires_at > NOW()
         RETURNING provider, account_id, mode`,
        [chatId],
    );
    return mapRow(result.rows[0]);
}

export async function getTelegramTargetState(
    runQuery: TelegramTargetStateQuery = defaultQuery,
    chatId: string,
    mode: TelegramTargetMode = 'session',
): Promise<TelegramTargetSelection | null> {
    const result = await runQuery(
        `SELECT provider, account_id, mode, xmin::text AS version FROM telegram_target_states
         WHERE chat_id = $1 AND mode = $2 AND expires_at > NOW()`,
        [chatId, mode],
    );
    return mapRow(result.rows[0]);
}

export async function consumeOrGetTelegramTargetState(chatId: string): Promise<TelegramTargetSelection | null> {
    return await consumeTelegramTargetState(undefined, chatId)
        || await getTelegramTargetState(undefined, chatId, 'session');
}

export async function peekTelegramTargetState(
    chatId: string,
    runQuery: TelegramTargetStateQuery = defaultQuery,
): Promise<TelegramTargetSelection | null> {
    return await getTelegramTargetState(runQuery, chatId, 'once')
        || await getTelegramTargetState(runQuery, chatId, 'session');
}

// A confirmation owns only the selection it displayed, never a newer /target choice.
export async function consumeConfirmedTelegramTargetState(
    chatId: string,
    selection: TelegramTargetSelection | null | undefined,
    runQuery: TelegramTargetStateQuery = defaultQuery,
): Promise<boolean> {
    if (selection?.mode !== 'once' || !selection.version) return false;
    const result = await runQuery(
        `DELETE FROM telegram_target_states
         WHERE chat_id = $1 AND mode = 'once' AND xmin::text = $2
           AND provider = $3 AND account_id IS NOT DISTINCT FROM $4
         RETURNING provider`,
        [chatId, selection.version, selection.provider, selection.accountId],
    );
    return (result.rowCount || 0) > 0;
}

export async function clearTelegramTargetState(chatId: string): Promise<void> {
    await defaultQuery('DELETE FROM telegram_target_states WHERE chat_id = $1', [chatId]);
}
