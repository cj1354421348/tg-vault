// Bot readiness does not imply user-account readiness. Incoming operations must
// await this barrier without shortening the configured startup isolation window.
let initialRecovery: Promise<void> = Promise.resolve();

export async function waitForInitialTelegramRecovery(signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted();
    if (!signal) return initialRecovery;
    await new Promise<void>((resolve, reject) => {
        const abort = () => { cleanup(); reject(signal.reason); };
        const cleanup = () => signal.removeEventListener('abort', abort);
        signal.addEventListener('abort', abort, { once: true });
        initialRecovery.then(() => { cleanup(); resolve(); }, error => { cleanup(); reject(error); });
    });
}

export function createInitialTelegramRecovery(restore: () => Promise<void>) {
    let resolve!: () => void;
    let reject!: (error: unknown) => void;
    initialRecovery = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
    // Startup logs recovery failures even if no download is awaiting readiness.
    void initialRecovery.catch(() => undefined);
    let scheduled: Promise<void> | null = null;
    return (delayMs: number): Promise<void> => {
        if (!scheduled) {
            scheduled = new Promise<void>(done => {
                const timer = setTimeout(done, delayMs);
                timer.unref?.();
            }).then(restore);
            scheduled.then(resolve, reject);
        }
        return scheduled;
    };
}
