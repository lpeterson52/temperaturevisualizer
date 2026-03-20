import {
    fitDualContrast,
    hexToRgba,
} from './theme.mjs';

export const BACKEND_URL = 'https://temperaturevisualizer.onrender.com/';
export const LOCAL_API_URL = 'http://localhost:8000/api';
export const DEFAULT_POLL_OPTIONS = Object.freeze({
    intervalMs: 800,
    timeoutMs: 300_000,
    maxConsecutiveErrors: 5,
});

export const CHART_FONT = '11px Inter, system-ui, sans-serif';
export const TOOLTIP_FONT = '0.78rem Inter, system-ui, sans-serif';
export const TANK_LETTERS = Object.freeze(['A', 'B', 'C', 'D']);
export const TANK_STATES = Object.freeze(['Warm', 'Cool']);
export const STAT_PERCENTILES = Object.freeze([1, 5, 10, 25, 50, 75, 90, 95, 99]);
const DARK_BG = '#1a1d27';
const LIGHT_BG = '#ecece0';
const MIN_UI_CONTRAST = 3; // WCAG non-text UI contrast target

const COLOR_SEEDS = Object.freeze([
    '#e6194b', '#3cb44b', '#ffe119', '#4f8ef7', '#f58231', '#911eb4', '#46f0f0', '#f032e6',
    '#d2f53c', '#fabebe', '#008080', '#e6beff', '#aa6e28', '#ff7f0e', '#800000', '#aaffc3',
    '#808000', '#ffd8b1', '#000080', '#808080', '#0057e7', '#a0a0a0', '#a9a9a9', '#b22222',
    '#228b22', '#4682b4', '#daa520', '#9932cc', '#ff69b4', '#cd5c5c', '#20b2aa', '#b8860b',
]);

export const COLOR_PAIRS = Object.freeze(
    COLOR_SEEDS.map((seed) => {
        const stroke = fitDualContrast(seed, {
            darkBg: DARK_BG,
            lightBg: LIGHT_BG,
            minContrast: MIN_UI_CONTRAST,
        });
        return [stroke, hexToRgba(stroke)];
    }),
);

function buildTankSeries() {
    const series = [];
    let colorIndex = 0;

    for (const letter of TANK_LETTERS) {
        for (let tankNumber = 1; tankNumber <= 4; tankNumber += 1) {
            for (const state of TANK_STATES) {
                const [stroke, fill] = COLOR_PAIRS[colorIndex];
                series.push({
                    id: `${letter}${tankNumber}-${state.toLowerCase()}`,
                    letter,
                    tankNumber,
                    state,
                    legendGroup: `Tank ${letter}`,
                    legendLabel: `${tankNumber} ${state}`,
                    sourceKey: `Tank ${letter}${tankNumber} ${state} (C)`,
                    label: `Tank ${letter}${tankNumber} ${state} (°C)`,
                    stroke,
                    fill,
                });
                colorIndex += 1;
            }
        }
    }

    return series;
}

export const TANK_SERIES = Object.freeze(buildTankSeries());

export function resolveRuntimeConfig(location = globalThis.location) {
    const hostname = location?.hostname ?? '';
    const protocol = location?.protocol ?? '';
    const isLocalDev =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        protocol === 'file:';

    return {
        isLocalDev,
        backendUrl: BACKEND_URL,
        apiUrl: isLocalDev ? LOCAL_API_URL : `${BACKEND_URL}api`,
        wakeupEnabled: !isLocalDev,
    };
}
