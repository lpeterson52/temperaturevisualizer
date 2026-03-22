async function createResponseError(action, response) {
    let detail = response.statusText || 'Request failed.';

    try {
        const responseBody = await response.json();
        if (typeof responseBody?.detail === 'string') {
            detail = responseBody.detail;
        } else if (typeof responseBody?.error === 'string') {
            detail = responseBody.error;
        }
    } catch {
        // Ignore invalid JSON in error responses.
    }

    return new Error(`${action} failed (${response.status}): ${detail}`);
}

function buildUrl(apiUrl, path, query) {
    const params = new URLSearchParams(query);
    return `${apiUrl}${path}?${params.toString()}`;
}

export default class FetchJob {
    constructor(startDate, endDate, apiUrl) {
        this.startDate = startDate;
        this.endDate = endDate;
        this.apiUrl = apiUrl;
        this.jobId = null;
    }

    async startFetchJob() {
        const url = buildUrl(this.apiUrl, '/start-merge', {
            start_date: this.startDate,
            end_date: this.endDate,
        });
        const response = await fetch(url, { method: 'POST' });
        if (!response.ok) {
            throw await createResponseError('startFetchJob', response);
        }

        const responseJson = await response.json();
        this.jobId = responseJson.job_id;
        return Boolean(this.jobId);
    }

    async getStatus() {
        if (!this.jobId) {
            throw new Error('No valid jobId');
        }

        const url = buildUrl(this.apiUrl, '/merge-status', { job_id: this.jobId });
        const response = await fetch(url);
        if (!response.ok) {
            throw await createResponseError('Status check', response);
        }

        return response.json();
    }

    async fetchResult() {
        if (!this.jobId) {
            throw new Error('No valid jobId');
        }

        const url = buildUrl(this.apiUrl, '/merge-result', { job_id: this.jobId });
        const response = await fetch(url);
        if (!response.ok) {
            throw await createResponseError('Result fetch', response);
        }

        return response.json();
    }
}
