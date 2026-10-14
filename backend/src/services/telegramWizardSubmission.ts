export interface TelegramWizardSubmissionState {
    submitting?: boolean;
    createdJobId?: string;
    cancelling?: boolean;
    cancelled?: boolean;
}

/** The persistence callback is the commit boundary; transport failures cannot reopen it. */
export async function submitTelegramWizard(
    state: TelegramWizardSubmissionState,
    callbacks: {
        submit: (onCreated: (jobId: string) => Promise<void>) => Promise<unknown>;
        onCreated: (jobId: string) => Promise<void>;
        onRejected: (error: unknown) => Promise<void>;
    },
): Promise<'busy' | 'created' | 'rejected'> {
    if (state.submitting || state.createdJobId || state.cancelling || state.cancelled) return 'busy';
    state.submitting = true;
    try {
        await callbacks.submit(async jobId => {
            state.createdJobId = jobId;
            await callbacks.onCreated(jobId);
        });
        if (!state.createdJobId) throw new Error('Task creation was not acknowledged');
        return 'created';
    } catch (error) {
        if (state.createdJobId) return 'created';
        await callbacks.onRejected(error);
        return 'rejected';
    } finally {
        state.submitting = false;
    }
}

/** Keep the draft retryable until its visible cancellation is committed. */
export async function cancelTelegramWizard(
    state: TelegramWizardSubmissionState,
    callbacks: { updateCard: () => Promise<unknown>; clearDraft: () => void },
): Promise<'busy' | 'cancelled'> {
    if (state.cancelled) return 'cancelled';
    if (state.cancelling || state.submitting || state.createdJobId) return 'busy';
    state.cancelling = true;
    try {
        await callbacks.updateCard();
        state.cancelled = true;
        callbacks.clearDraft();
        return 'cancelled';
    } finally {
        state.cancelling = false;
    }
}
