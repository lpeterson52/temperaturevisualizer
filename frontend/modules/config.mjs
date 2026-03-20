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
export const COLOR_PAIRS = Object.freeze([
    ['#e6194b', 'rgba(230,25,75,0.15)'],
    ['#3cb44b', 'rgba(60,180,75,0.15)'],
    ['#ffe119', 'rgba(255,225,25,0.15)'],
    ['#4f8ef7', 'rgba(79,142,247,0.15)'],
    ['#f58231', 'rgba(245,130,49,0.15)'],
    ['#911eb4', 'rgba(145,30,180,0.15)'],
    ['#46f0f0', 'rgba(70,240,240,0.15)'],
    ['#f032e6', 'rgba(240,50,230,0.15)'],
    ['#d2f53c', 'rgba(210,245,60,0.15)'],
    ['#fabebe', 'rgba(250,190,190,0.15)'],
    ['#008080', 'rgba(0,128,128,0.15)'],
    ['#e6beff', 'rgba(230,190,255,0.15)'],
    ['#aa6e28', 'rgba(170,110,40,0.15)'],
    ['#ff7f0e', 'rgba(255,127,14,0.15)'],
    ['#800000', 'rgba(128,0,0,0.15)'],
    ['#aaffc3', 'rgba(170,255,195,0.15)'],
    ['#808000', 'rgba(128,128,0,0.15)'],
    ['#ffd8b1', 'rgba(255,216,177,0.15)'],
    ['#000080', 'rgba(0,0,128,0.15)'],
    ['#808080', 'rgba(128,128,128,0.15)'],
    ['#0057e7', 'rgba(0,87,231,0.15)'],
    ['#a0a0a0', 'rgba(160,160,160,0.15)'],
    ['#a9a9a9', 'rgba(169,169,169,0.15)'],
    ['#b22222', 'rgba(178,34,34,0.15)'],
    ['#228b22', 'rgba(34,139,34,0.15)'],
    ['#4682b4', 'rgba(70,130,180,0.15)'],
    ['#daa520', 'rgba(218,165,32,0.15)'],
    ['#9932cc', 'rgba(153,50,204,0.15)'],
    ['#ff69b4', 'rgba(255,105,180,0.15)'],
    ['#cd5c5c', 'rgba(205,92,92,0.15)'],
    ['#20b2aa', 'rgba(32,178,170,0.15)'],
    ['#b8860b', 'rgba(184,134,11,0.15)'],
]);

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
