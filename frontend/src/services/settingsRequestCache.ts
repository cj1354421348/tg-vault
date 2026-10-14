const entries = new Map<string, { expiresAt: number; response: Promise<Response> }>();
let generation = 0;

export function invalidateSettingsRequests(): void {
    generation += 1;
    entries.clear();
}

// Only small settings responses; never login tokens, file lists or live Bot status.
const lifetimes: Record<string, number | undefined> = {
    '/api/storage/config': 5_000,
    '/api/storage/config/advanced-tasks': 15_000,
    '/api/storage/config/telegram-user/accounts': 5_000,
};

export async function fetchSettingsRequest(url: string, init: RequestInit): Promise<Response> {
    const method = (init.method || 'GET').toUpperCase();
    const mutation = method !== 'GET' && method !== 'HEAD';
    if (mutation) invalidateSettingsRequests();
    const ttl = lifetimes[new URL(url, window.location.href).pathname];
    if (mutation || !ttl || init.signal || init.cache === 'no-store') {
        try { return await fetch(url, init); }
        finally { if (mutation) invalidateSettingsRequests(); }
    }
    const key = JSON.stringify([url, init.credentials, [...new Headers(init.headers).entries()].sort()]);
    const cached = entries.get(key);
    if (cached && cached.expiresAt > Date.now()) return (await cached.response).clone();
    const version = generation;
    const response = fetch(url, init).then(response => {
        if (!response.ok || version !== generation) {
            if (entries.get(key) === entry) entries.delete(key);
        } else { entry.expiresAt = Date.now() + ttl; }
        return response;
    }).catch(error => {
        if (entries.get(key) === entry) entries.delete(key);
        throw error;
    });
    const entry = { expiresAt: Infinity, response };
    entries.set(key, entry);
    return (await entry.response).clone();
}
