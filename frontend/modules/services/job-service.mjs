class FatalJobError extends Error {}

function defaultSleep(milliseconds) {
    return new Promise(resolve => {
        setTimeout(resolve, milliseconds);
    });
}

function formatErrorMessage(error) {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return String(error);
}

export function wakeupServer({ backendUrl, wakeupEnabled, logger = console }) {
    if (!wakeupEnabled) {
        return;
    }

    void fetch(backendUrl).catch(error => {
        logger.warn('Backend wakeup failed.', error);
    });
}

export async function pollJobStatus(fetchJob, options = {}) {
    const {
        intervalMs = 800,
        timeoutMs = 300_000,
        maxConsecutiveErrors = 5,
        onProgress = () => {},
        logger = console,
        sleep = defaultSleep,
        now = () => Date.now(),
    } = options;

    const startedAt = now();
    let consecutiveErrors = 0;

    while (true) {
        if (now() - startedAt > timeoutMs) {
            throw new Error(`Polling timed out after ${Math.ceil(timeoutMs / 1000)} seconds.`);
        }

        try {
            const status = await fetchJob.getStatus();
            const progress = typeof status.progress === 'number'
                ? Math.max(0, Math.min(100, status.progress))
                : 0;

            consecutiveErrors = 0;
            onProgress(progress, status);

            if (status.status === 'complete') {
                onProgress(100, { ...status, progress: 100 });
                return status;
            }

            if (status.status === 'failed') {
                throw new FatalJobError(status.error || 'Job failed.');
            }
        } catch (error) {
            if (error instanceof FatalJobError) {
                throw error;
            }

            consecutiveErrors += 1;
            logger.warn('pollJobStatus error, retrying', error);

            if (consecutiveErrors >= maxConsecutiveErrors) {
                throw new Error(
                    `Polling failed after ${consecutiveErrors} consecutive errors: ${formatErrorMessage(error)}`,
                );
            }
        }

        await sleep(intervalMs);
    }
}

export async function runMergeJob(startDate, endDate, options) {
    const {
        apiUrl,
        createFetchJob,
        intervalMs = 800,
        timeoutMs = 300_000,
        maxConsecutiveErrors = 5,
        onProgress = () => {},
        logger = console,
        sleep,
        now,
    } = options ?? {};

    if (typeof createFetchJob !== 'function') {
        throw new TypeError('runMergeJob requires a createFetchJob option.');
    }

    const fetchJob = createFetchJob(startDate, endDate, apiUrl);
    await fetchJob.startFetchJob();
    await pollJobStatus(fetchJob, {
        intervalMs,
        timeoutMs,
        maxConsecutiveErrors,
        onProgress,
        logger,
        sleep,
        now,
    });

    const resultResponse = await fetchJob.fetchResult();
    if (!resultResponse || !Array.isArray(resultResponse.result)) {
        throw new Error('The backend returned an invalid merge result payload.');
    }

    return resultResponse.result;
}
