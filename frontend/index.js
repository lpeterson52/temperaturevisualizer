import { createApp } from './modules/app.mjs';
import { getTodayIsoDate, validateDateRange } from './modules/data.mjs';

const domRefs = {
    chartContainer: document.getElementById('chart-container'),
    clearMarkersBtn: document.getElementById('clear-markers-btn'),
    customLegend: document.getElementById('custom-legend'),
    dateForm: document.getElementById('dateForm'),
    emptyState: document.getElementById('empty-state'),
    endDate: document.getElementById('endDate'),
    instructions: document.getElementById('instructions'),
    markerBar: document.getElementById('marker-bar'),
    markerBarContent: document.getElementById('marker-bar-content'),
    overlayCanvas: document.getElementById('overlay-canvas'),
    resetZoomBtn: document.getElementById('reset-zoom-btn'),
    startDate: document.getElementById('startDate'),
    statsPanel: document.getElementById('stats-panel'),
    statsSelectorRow: document.getElementById('stats-selector-row'),
    submitBtn: document.getElementById('submitBtn'),
    uplotContainer: document.getElementById('uplot-container'),
};

const app = createApp(domRefs);
app.init();

domRefs.resetZoomBtn?.addEventListener('click', () => {
    app.resetZoom();
});

domRefs.dateForm?.addEventListener('submit', async event => {
    event.preventDefault();

    const startDate = domRefs.startDate?.value ?? '';
    const endDate = domRefs.endDate?.value ?? '';
    const validationError = validateDateRange(startDate, endDate, getTodayIsoDate());
    if (validationError) {
        app.showValidationError(validationError);
        return;
    }

    app.clearValidationError();
    domRefs.emptyState.classList.add('hidden');
    domRefs.submitBtn.disabled = true;
    try {
        await app.loadRange(startDate, endDate);
    } finally {
        domRefs.submitBtn.disabled = false;
    }
    return;
});

domRefs.startDate?.addEventListener('change', () => {
    if (domRefs.endDate && !domRefs.endDate.value) {
        domRefs.endDate.value = domRefs.startDate.value;
    }
});
