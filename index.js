import { createApp } from './modules/app.mjs';
import { getTodayIsoDate, validateDateRange } from './modules/data.mjs';

const THEME_STORAGE_KEY = 'temperature-visualizer-theme';

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
    themeToggle: document.getElementById('themeToggle'),
    uplotContainer: document.getElementById('uplot-container'),
};

function getInitialTheme() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === 'light' || savedTheme === 'dark') {
        return savedTheme;
    }

    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function setTheme(theme) {
    const isLight = theme === 'light';
    document.documentElement.setAttribute('data-theme', isLight ? 'light' : 'dark');

    if (domRefs.themeToggle) {
        const iconElement = domRefs.themeToggle.querySelector('.theme-toggle-icon');
        const textElement = domRefs.themeToggle.querySelector('.theme-toggle-text');

        if (iconElement) {
            iconElement.textContent = isLight ? '☀️' : '🌙';
        }

        if (textElement) {
            textElement.textContent = isLight ? 'Light' : 'Dark';
        }

        domRefs.themeToggle.setAttribute('aria-pressed', String(isLight));
        domRefs.themeToggle.setAttribute('title', `Switch to ${isLight ? 'dark' : 'light'} mode`);
    }

    document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: isLight ? 'light' : 'dark' } }));
}

function initThemeToggle() {
    const initialTheme = getInitialTheme();
    setTheme(initialTheme);

    domRefs.themeToggle?.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
        const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
        localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
        setTheme(nextTheme);
    });
}

initThemeToggle();

const app = createApp(domRefs);
app.init();

document.addEventListener('themechange', () => {
    app.refreshTheme();
});

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
    domRefs.submitBtn.disabled = true;
    try {
        await app.loadRange(startDate, endDate);
        domRefs.emptyState.classList.add('hidden');
    } catch (error) {
        domRefs.emptyState.classList.remove('hidden');
        throw error;
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
