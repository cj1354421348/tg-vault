import type { Api } from 'telegram';

export interface TelegramChannelScanParams {
    mode?: string;
    tag?: string;
    startDateIso?: string;
    endDateIso?: string;
}

export interface TelegramChannelPageRequest {
    limit: number;
    offsetId: number;
    offsetDate?: number;
    search?: string;
}

export async function scanTelegramChannelPage(
    params: TelegramChannelScanParams,
    offsetId: number,
    limit: number,
    getMessages: (request: TelegramChannelPageRequest) => Promise<Api.Message[]>,
    matchesMessage: (message: Api.Message) => boolean,
) {
    const startDateTimestamp = Date.parse(params.startDateIso || '');
    const endDateTimestamp = Date.parse(params.endDateIso || '');
    const batch = await getMessages({
        limit,
        offsetId,
        // Date ranges already contain the inclusive UTC end from parseTelegramDateRange.
        // Telegram's second-resolution offsetDate is exclusive; resume by ID only.
        ...(params.mode === 'date' && offsetId === 0
            ? { offsetDate: Math.floor(endDateTimestamp / 1000) + 1 }
            : {}),
        ...(params.mode === 'tag' ? { search: params.tag } : {}),
    });
    let done = false;
    let nextOffsetId = offsetId;
    let messagesScanned = 0;
    let lastMessageTimestamp: number | undefined;
    const messages: Api.Message[] = [];
    for (const message of batch) {
        nextOffsetId = message.id;
        messagesScanned += 1;
        lastMessageTimestamp = (message.date || 0) * 1000;
        if (params.mode === 'date') {
            if (lastMessageTimestamp > endDateTimestamp) continue;
            if (lastMessageTimestamp < startDateTimestamp) { done = true; break; }
        }
        if (matchesMessage(message)) messages.push(message);
    }
    return {
        messages,
        // Retain this page only, so album siblings already fetched need no second RPC.
        pageMessages: batch,
        messagesScanned,
        lastMessageDate: lastMessageTimestamp === undefined ? undefined : new Date(lastMessageTimestamp).toISOString(),
        done: done || batch.length < limit,
        nextOffsetId,
    };
}

export function messageGroupId(message: Api.Message | undefined): string | undefined {
    const groupedId = message?.groupedId;
    return groupedId ? groupedId.toString() : undefined;
}

export async function expandTelegramMediaGroups(
    messages: Api.Message[],
    pageMessages: Api.Message[],
    getMessages: (ids: number[]) => Promise<Array<Api.Message | undefined>>,
    hasMedia: (message: Api.Message) => boolean,
): Promise<Api.Message[]> {
    const byId = new Map<number, Api.Message>();
    const groups = new Set<string>();
    const nearbyIds = new Set<number>();
    const pageIds = new Set(pageMessages.map(message => message.id));
    for (const message of messages) {
        pageIds.add(message.id);
        if (hasMedia(message)) byId.set(message.id, message);
        const groupId = messageGroupId(message);
        if (!groupId || groups.has(groupId)) continue;
        groups.add(groupId);
        for (let id = Math.max(1, message.id - 20); id <= message.id + 20; id++) {
            nearbyIds.add(id);
        }
    }
    const addGroupMember = (message: Api.Message | undefined) => {
        if (!message || !hasMedia(message)) return;
        const groupId = messageGroupId(message);
        if (groupId && groups.has(groupId)) byId.set(message.id, message);
    };
    for (const message of pageMessages) addGroupMember(message);
    const ids = Array.from(nearbyIds).filter(id => !pageIds.has(id)).sort((a, b) => a - b);
    // GramJS paginates IDs internally above 100; bound every account-wrapped request.
    for (let offset = 0; offset < ids.length; offset += 100) {
        const nearby = await getMessages(ids.slice(offset, offset + 100));
        for (const message of nearby) addGroupMember(message);
    }
    return Array.from(byId.values()).sort((a, b) => a.id - b.id);
}
