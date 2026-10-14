import { Api, TelegramClient } from 'telegram';
import { query } from '../db/index.js';
import { channelRuntimeView } from './telegramChannelRuntimeView.js';
import { getChannelExecutionGroup } from './telegramUpload.js';
import { channelTaskCenterItem, buildTaskCenterDetail } from './telegramTaskCenter.js';
import { registerProgressCard, taskCenterCardKey, taskCenterCardOwners } from './telegramProgressControls.js';
import { getTelegramUserLocaleOrDefault } from './telegramLocalePreferences.js';
import { formatBytes, t, type TelegramLocale } from '../i18n/telegram.js';

export function channelProgressText(row: Record<string, unknown>, locale: TelegramLocale): string {
    const runtime = String(row.runtime_status || row.status);
    const state = ['completed', 'completed_with_errors'].includes(runtime)
        ? t(locale, runtime === 'completed' ? 'bot.subscription.result.completed' : 'bot.subscription.result.partial')
        : t(locale, runtime === 'cancelled' ? 'bot.callback.cancelled' : runtime === 'paused' ? 'taskCenter.state.paused'
            : runtime === 'pausing' ? 'taskCenter.state.pausing' : runtime === 'failed' ? 'taskCenter.state.failed'
                : runtime === 'cooling' ? 'taskCenter.state.cooling' : row.scan_status !== 'done' ? 'bot.legacy.state.scanning'
                    : Number(row.downloading_count) > 0 ? 'bot.legacy.state.downloading' : 'taskCenter.state.waiting');
    const params = row.params && typeof row.params === 'object' ? row.params as Record<string, unknown> : {};
    const total = Math.max(Number(row.total_count || 0), Number(row.item_count || 0));
    const completed = Math.max(Number(row.success_count || 0), row.finished_at ? Number(row.enqueued_count || 0) : 0);
    const skipped = Math.max(Number(row.skipped_count_items || 0), row.finished_at ? Number(row.skipped_count || 0) : 0);
    const done = completed + Number(row.failed_count || 0) + skipped;
    const scanProgressText = channelTaskCenterItem(row, locale)?.scanProgressText;
    const lines = [
        `${state} · ${String(row.source)}`,
        params.tag || (params.startDate && params.endDate ? `${params.startDate} → ${params.endDate}` : ''),
        scanProgressText,
        t(locale, 'channelCard.progress', { done, total }),
        t(locale, 'channelCard.queue', { active: Number(row.downloading_count || 0), pending: Number(row.pending_count || 0) }),
        Number(row.failed_count) > 0 ? t(locale, 'channelCard.failures', { count: Number(row.failed_count) }) : '',
        Number(row.skipped_count_items) > 0 ? t(locale, 'channelCard.skipped', { count: Number(row.skipped_count_items) }) : '',
        Number(row.downloading_count) > 0 ? t(locale, 'bot.legacy.speed', { speed: formatBytes(Number(row.speed_bytes_per_second || 0), locale) }) : '',
        runtime === 'pausing' ? t(locale, 'taskCenter.note.pausing') : '',
        row.error ? String(row.error) : '',
        t(locale, 'channelCard.updated', { time: new Date().toLocaleTimeString(locale, { hour12: false, timeZone: 'Asia/Shanghai' }) }),
    ];
    return lines.filter(Boolean).join('\n');
}

let timer: NodeJS.Timeout | undefined;
let updating: Promise<void> | undefined;
const rendered = new Map<string, { signature: string; at: number; retryAt: number }>();

export async function syncTelegramChannelCards(client: TelegramClient): Promise<void> {
    const rows = await query(`SELECT j.*,
        COUNT(i.id)::int AS item_count,
        COUNT(i.id) FILTER (WHERE i.status='success')::int AS success_count,
        COUNT(i.id) FILTER (WHERE i.status='failed')::int AS failed_count,
        COUNT(i.id) FILTER (WHERE i.status='skipped')::int AS skipped_count_items,
        COUNT(i.id) FILTER (WHERE i.status='pending')::int AS pending_count,
        COUNT(i.id) FILTER (WHERE i.status='downloading')::int AS downloading_count
        FROM telegram_background_jobs j LEFT JOIN telegram_download_items i ON i.job_id=j.id
        WHERE j.kind IN ('date_range','tag_download')
          AND (j.params->>'progressMessageId' IS NOT NULL OR j.finished_at IS NULL)
          AND (j.finished_at IS NULL OR j.updated_at > NOW()-INTERVAL '24 hours')
        GROUP BY j.id ORDER BY j.created_at`);
    const seen = new Set<string>();
    for (const original of rows.rows) {
        const id = String(original.id);
        seen.add(id);
        const row = channelRuntimeView(original, getChannelExecutionGroup(id));
        const locale = await getTelegramUserLocaleOrDefault(Number(row.user_id));
        const chatId = String(row.chat_id || row.user_id);
        let messageId = Number(row.params?.progressMessageId || 0);
        const owner = messageId ? taskCenterCardOwners.get(taskCenterCardKey(chatId, messageId)) : undefined;
        if (owner?.interactive && (owner.interactiveUntil || 0) > Date.now()) continue;
        if (owner) owner.interactive = false;
        const signature = JSON.stringify([row.status, row.runtime_status, row.scan_status, row.total_count, row.success_count,
            row.failed_count, row.skipped_count_items, row.pending_count, row.downloading_count,
            Math.round(row.speed_bytes_per_second / 1024), row.scan_cursor, row.error]);
        const previous = rendered.get(id);
        if (previous && (previous.retryAt > Date.now() || (previous.signature === signature
            && (row.finished_at || Date.now() - previous.at < 30_000)))) continue;
        const text = channelProgressText(row, locale);
        const terminal = ['completed','cancelled'].includes(row.status);
        const item = terminal ? null : channelTaskCenterItem(row, locale);
        const buttons = item ? new Api.ReplyInlineMarkup({ rows: buildTaskCenterDetail(item, 0, { locale }).rows.map(buttons =>
            new Api.KeyboardButtonRow({ buttons: buttons.map(button => new Api.KeyboardButtonCallback({ text: button.text, data: Buffer.from(button.data) })) })) }) : undefined;
        try {
            if (messageId) {
                try { await client.editMessage(chatId, { message: messageId, text, buttons, linkPreview: false }); }
                catch (error) {
                    const code = String(error && typeof error === 'object' && 'errorMessage' in error ? error.errorMessage : error);
                    if (/MESSAGE_NOT_MODIFIED/.test(code)) { /* Same content is already visible. */ }
                    else if (/MESSAGE_ID_INVALID|MESSAGE_EDIT_TIME_EXPIRED/.test(code)) messageId = 0;
                    else throw error;
                }
            }
            if (!messageId) {
                const message = await client.sendMessage(chatId, { message: text, buttons, linkPreview: false });
                messageId = message.id;
                await query(`UPDATE telegram_background_jobs SET params=jsonb_set(params,'{progressMessageId}',to_jsonb($2::int)) WHERE id=$1`, [id, messageId]);
            }
            registerProgressCard(chatId, messageId, Number(row.user_id));
            rendered.set(id, { signature, at: Date.now(), retryAt: 0 });
        } catch (error) {
            const seconds = Math.max(5, Number(error && typeof error === 'object' && 'seconds' in error ? error.seconds : 15) || 15);
            rendered.set(id, { signature: previous?.signature || '', at: previous?.at || 0, retryAt: Date.now() + seconds * 1000 });
            console.warn('Telegram progress card update failed', { jobId: id, messageId, error: String(error) });
        }
    }
    for (const id of rendered.keys()) if (!seen.has(id)) rendered.delete(id);
}

export function startTelegramChannelCards(client: TelegramClient): void {
    clearInterval(timer);
    const tick = () => {
        if (updating) return;
        updating = syncTelegramChannelCards(client).catch(error => console.warn('Telegram card sync failed:', error))
            .finally(() => { updating = undefined; });
    };
    tick();
    timer = setInterval(tick, 5000);
}
export async function stopTelegramChannelCards(): Promise<void> {
    clearInterval(timer);
    timer = undefined;
    await updating;
    rendered.clear();
}
