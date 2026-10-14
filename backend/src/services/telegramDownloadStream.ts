import { setTimeout as delay } from 'node:timers/promises';
import { classifyTelegramDownloadAccountError, telegramFloodWaitSeconds } from './telegramUserClientPool.js';

export class TelegramDownloadGate {
    private cooldownUntil = 0;
    private serialUntil = 0;
    private active = 0;

    async read<T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
        while (true) {
            signal?.throwIfAborted();
            const now = Date.now();
            if (now >= this.cooldownUntil && (now >= this.serialUntil || this.active === 0)) break;
            await delay(Math.max(25, Math.min(100, this.cooldownUntil - now)), undefined, { signal });
        }
        this.active++;
        try {
            return await operation();
        } catch (error) {
            if (classifyTelegramDownloadAccountError(error) === 'flood_wait') {
                this.cooldownUntil = Math.max(this.cooldownUntil, Date.now() + telegramFloodWaitSeconds(error) * 1000);
                this.serialUntil = this.cooldownUntil + 60_000;
            }
            throw error;
        } finally {
            this.active--;
        }
    }
}

/** Keep each stripe's committed offset across FLOOD_WAIT; never restart the file. */
export async function* telegramDownloadStream<T extends { length: number }>(
    open: (offset: number) => AsyncIterable<T>,
    options: { offset: number; stride?: number; end?: number; signal?: AbortSignal; beforeRead?: () => Promise<void>; gate?: TelegramDownloadGate },
): AsyncGenerator<T> {
    let offset = options.offset;
    while (options.end === undefined || offset < options.end) {
        options.signal?.throwIfAborted();
        await options.beforeRead?.();
        const iterator = open(offset)[Symbol.asyncIterator]();
        try {
            while (options.end === undefined || offset < options.end) {
                options.signal?.throwIfAborted();
                await options.beforeRead?.();
                const next = async () => {
                    await options.beforeRead?.();
                    options.signal?.throwIfAborted();
                    return iterator.next();
                };
                const result = options.gate ? await options.gate.read(next, options.signal) : await next();
                if (result.done) return;
                options.signal?.throwIfAborted();
                await options.beforeRead?.();
                yield result.value;
                offset += options.stride ?? result.value.length;
            }
            return;
        } catch (error) {
            options.signal?.throwIfAborted();
            if (classifyTelegramDownloadAccountError(error) !== 'flood_wait') throw error;
            await delay(telegramFloodWaitSeconds(error) * 1000, undefined, { signal: options.signal });
        } finally {
            await iterator.return?.();
        }
    }
}
