export default class FetchJob {
    constructor(startDate, endDate, apiUrl) {
        this.startDate = startDate;
        this.endDate = endDate;
        this.apiUrl = apiUrl;
        this.jobId = null;
    }

    async startFetchJob() {
        const url = `${this.apiUrl}/start-merge?start_date=${encodeURIComponent(this.startDate)}&end_date=${encodeURIComponent(this.endDate)}`;
        const response = await fetch(url, { method: 'POST' });
        if (!response.ok) throw new Error(`startFetchJob failed: ${response.status}`);
        const responseJSON = await response.json();
        this.jobId = responseJSON["job_id"];
        return !!this.jobId;
    }

    async getStatus() {
        if (!this.jobId) throw new Error("No valid jobId");
        const url = `${this.apiUrl}/merge-status?job_id=${encodeURIComponent(this.jobId)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Status check failed: ${response.status}`);
        return response.json();
    }

    async fetchResult() {
        if (!this.jobId) throw new Error("No valid jobId");
        const url = `${this.apiUrl}/merge-result?job_id=${encodeURIComponent(this.jobId)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Result fetch failed: ${response.status}`);
        return response.json();
    }

}