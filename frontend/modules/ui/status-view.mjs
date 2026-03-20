function ensureProgressElements(chartContainerEl) {
    let containerEl = document.getElementById('merge-progress-container');
    let progressBarEl = document.getElementById('merge-progress-bar');

    if (!containerEl) {
        containerEl = document.createElement('div');
        containerEl.id = 'merge-progress-container';
        containerEl.hidden = true;
        containerEl.setAttribute('aria-live', 'polite');

        progressBarEl = document.createElement('div');
        progressBarEl.id = 'merge-progress-bar';
        progressBarEl.setAttribute('role', 'progressbar');
        progressBarEl.setAttribute('aria-valuemin', '0');
        progressBarEl.setAttribute('aria-valuemax', '100');
        progressBarEl.setAttribute('aria-valuenow', '0');

        containerEl.appendChild(progressBarEl);
        chartContainerEl?.appendChild(containerEl);
    }

    return { containerEl, progressBarEl };
}

export function createStatusView({ instructionsEl, submitBtnEl, chartContainerEl }) {
    const buttonTextEl = submitBtnEl?.querySelector('.btn-text') ?? null;
    const { containerEl, progressBarEl } = ensureProgressElements(chartContainerEl);

    function setLoading(isLoading) {
        if (!submitBtnEl || !buttonTextEl) {
            return;
        }

        submitBtnEl.disabled = isLoading;
        buttonTextEl.textContent = isLoading ? 'Loading…' : 'Load Data';
    }

    function setError(message) {
        if (!instructionsEl) {
            return;
        }

        instructionsEl.hidden = false;
        instructionsEl.textContent = message;
    }

    function clearError() {
        if (!instructionsEl) {
            return;
        }

        instructionsEl.hidden = true;
        instructionsEl.textContent = '';
    }

    function setProgress(progress) {
        if (!containerEl || !progressBarEl) {
            return;
        }

        const clampedProgress = Math.max(0, Math.min(100, progress));
        containerEl.hidden = false;
        progressBarEl.style.width = `${clampedProgress}%`;
        progressBarEl.setAttribute('aria-valuenow', String(Math.round(clampedProgress)));
    }

    function hideProgress() {
        if (!containerEl || !progressBarEl) {
            return;
        }

        containerEl.hidden = true;
        progressBarEl.style.width = '0%';
        progressBarEl.setAttribute('aria-valuenow', '0');
    }

    return {
        setLoading,
        setError,
        clearError,
        setProgress,
        hideProgress,
    };
}
