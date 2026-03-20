import test from 'node:test';
import assert from 'node:assert/strict';

import {
    pollJobStatus,
    runMergeJob,
    wakeupServer,
} from '../modules/services/job-service.mjs';

test('wakeupServer swallows rejected wakeup fetches and logs them', async () => {
    const originalFetch = globalThis.fetch;
    let warned = false;

    globalThis.fetch = () => Promise.reject(new Error('offline'));
    wakeupServer({
        backendUrl: 'https://example.com/',
        wakeupEnabled: true,
        logger: {
            warn(message, error) {
                warned = message === 'Backend wakeup failed.' && error instanceof Error;
            },
        },
    });

    await Promise.resolve();
    await Promise.resolve();
    assert.equal(warned, true);

    globalThis.fetch = originalFetch;
});

test('pollJobStatus times out when the job never completes', async () => {
    let nowValue = 0;

    await assert.rejects(
        pollJobStatus(
            {
                async getStatus() {
                    return { status: 'running', progress: 25 };
                },
            },
            {
                intervalMs: 1_000,
                timeoutMs: 2_500,
                maxConsecutiveErrors: 5,
                now: () => nowValue,
                sleep: async milliseconds => {
                    nowValue += milliseconds;
                },
                logger: { warn() {} },
            },
        ),
        /timed out/i,
    );
});

test('pollJobStatus stops after too many consecutive transient errors', async () => {
    await assert.rejects(
        pollJobStatus(
            {
                async getStatus() {
                    throw new Error('temporary failure');
                },
            },
            {
                intervalMs: 10,
                timeoutMs: 1_000,
                maxConsecutiveErrors: 3,
                sleep: async () => {},
                now: () => 0,
                logger: { warn() {} },
            },
        ),
        /3 consecutive errors/i,
    );
});

test('runMergeJob wraps start, poll, and result fetch into one lifecycle', async () => {
    const calls = [];

    const rows = await runMergeJob('2026-02-22', '2026-02-23', {
        apiUrl: 'http://localhost:8000/api',
        createFetchJob() {
            return {
                async startFetchJob() {
                    calls.push('start');
                },
                async getStatus() {
                    calls.push('status');
                    return { status: 'complete', progress: 100 };
                },
                async fetchResult() {
                    calls.push('result');
                    return { result: [{ 'Date-Time': '02/22/2026 00:00:36' }] };
                },
            };
        },
        intervalMs: 10,
        timeoutMs: 1_000,
        maxConsecutiveErrors: 2,
        sleep: async () => {},
        now: () => 0,
        logger: { warn() {} },
    });

    assert.deepEqual(calls, ['start', 'status', 'result']);
    assert.equal(rows.length, 1);
});
