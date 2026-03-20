import {
    getClosestIndexForUnixSeconds,
    getStatPercentiles,
} from '../data.mjs';
import {
    ensureStatsSelection,
    getVisibleDatasets,
} from '../state.mjs';

const EMPTY_STAT = '—';
const STAT_ELEMENT_IDS = Object.freeze([
    'stat-count',
    'stat-min',
    'stat-max',
    'stat-mean',
    'stat-median',
    'stat-mode',
    'stat-geo-mean',
    'stat-har-mean',
    'stat-rms',
    'stat-std-dev',
    'stat-var',
    'stat-iqr',
    'stat-skewness',
    ...getStatPercentiles().map(percentile => `stat-p${percentile}`),
]);

let missingSimpleStatisticsWarned = false;

function buildStatsElementMap(panelEl) {
    const entries = STAT_ELEMENT_IDS.map(elementId => [elementId, panelEl?.querySelector(`#${elementId}`) ?? null]);
    return Object.fromEntries(entries);
}

function setTextContent(element, value) {
    if (element) {
        element.textContent = value;
    }
}

function setAllStats(statElements, value = EMPTY_STAT) {
    Object.values(statElements).forEach(element => {
        setTextContent(element, value);
    });
}

function resolveSelectedRange(state) {
    if (!state.dataset.timestamps.length) {
        return { minIndex: 0, maxIndex: -1 };
    }

    let minIndex = Math.max(
        0,
        getClosestIndexForUnixSeconds(state.dataset.timestamps, state.viewport.minX),
    );
    let maxIndex = Math.min(
        state.dataset.timestamps.length - 1,
        getClosestIndexForUnixSeconds(state.dataset.timestamps, state.viewport.maxX),
    );

    if (state.markers.a) {
        const markerEndIndex = state.markers.b?.labelIndex ?? state.markers.previewIndex;
        if (markerEndIndex >= 0) {
            minIndex = Math.min(state.markers.a.labelIndex, markerEndIndex);
            maxIndex = Math.max(state.markers.a.labelIndex, markerEndIndex);
        }
    }

    return { minIndex, maxIndex };
}

function collectSelectedValues(state, selectedDatasetIndex) {
    const { minIndex, maxIndex } = resolveSelectedRange(state);
    if (selectedDatasetIndex < 0 || minIndex < 0 || maxIndex < minIndex) {
        return [];
    }

    const values = [];
    const sourceValues = state.dataset.seriesData[selectedDatasetIndex];
    if (!sourceValues) {
        return values;
    }

    for (let index = minIndex; index <= maxIndex; index += 1) {
        const value = sourceValues[index];
        if (Number.isFinite(value)) {
            values.push(value);
        }
    }

    return values;
}

function createStatFormatter(values) {
    return statisticFn => {
        if (!values.length) {
            return EMPTY_STAT;
        }

        const simpleStatistics = globalThis.ss;
        if (!simpleStatistics) {
            if (!missingSimpleStatisticsWarned) {
                console.warn('simple-statistics is not available on window.ss.');
                missingSimpleStatisticsWarned = true;
            }
            return EMPTY_STAT;
        }

        try {
            const result = statisticFn(simpleStatistics);
            if (typeof result !== 'number' || !Number.isFinite(result)) {
                return EMPTY_STAT;
            }
            return result.toFixed(3);
        } catch {
            return EMPTY_STAT;
        }
    };
}

function renderSelector(selectorRowEl, visibleDatasets, selectedDatasetIndex) {
    selectorRowEl.textContent = '';

    if (visibleDatasets.length === 1) {
        const labelEl = document.createElement('span');
        labelEl.className = 'stats-single-label';
        labelEl.textContent = visibleDatasets[0].meta.label.replace(' (°C)', '');
        labelEl.style.color = visibleDatasets[0].meta.stroke;
        selectorRowEl.appendChild(labelEl);
        return;
    }

    if (visibleDatasets.length > 1) {
        const selectEl = document.createElement('select');
        selectEl.className = 'stats-select';

        visibleDatasets.forEach(({ meta, index }) => {
            const optionEl = document.createElement('option');
            optionEl.value = String(index);
            optionEl.textContent = meta.label.replace(' (°C)', '');
            optionEl.style.color = meta.stroke;
            optionEl.selected = index === selectedDatasetIndex;
            selectEl.appendChild(optionEl);
        });

        if (selectedDatasetIndex >= 0) {
            selectEl.style.color = visibleDatasets.find(({ index }) => index === selectedDatasetIndex)?.meta.stroke ?? '';
        }

        selectorRowEl.appendChild(selectEl);
    }
}

export function createStatsView({ panelEl, selectorRowEl, onSelectDataset }) {
    const statElements = buildStatsElementMap(panelEl);

    selectorRowEl?.addEventListener('change', event => {
        const target = event.target;
        if (!(target instanceof HTMLSelectElement) || !target.classList.contains('stats-select')) {
            return;
        }

        onSelectDataset(Number.parseInt(target.value, 10));
    });

    function render(state) {
        if (!selectorRowEl) {
            return;
        }

        const visibleDatasets = getVisibleDatasets(state);
        const selectedDatasetIndex = ensureStatsSelection(state);
        renderSelector(selectorRowEl, visibleDatasets, selectedDatasetIndex);

        const values = collectSelectedValues(state, selectedDatasetIndex);
        if (!values.length) {
            setAllStats(statElements);
            return;
        }

        const formatStat = createStatFormatter(values);

        setTextContent(
            statElements['stat-count'],
            String(values.length),
        );
        setTextContent(statElements['stat-min'], formatStat(ss => ss.min(values)));
        setTextContent(statElements['stat-max'], formatStat(ss => ss.max(values)));
        setTextContent(statElements['stat-mean'], formatStat(ss => ss.mean(values)));
        setTextContent(statElements['stat-median'], formatStat(ss => ss.median(values)));
        setTextContent(
            statElements['stat-mode'],
            formatStat(ss => {
                const mode = ss.mode(values);
                return Array.isArray(mode) ? mode[0] : mode;
            }),
        );
        setTextContent(statElements['stat-geo-mean'], formatStat(ss => ss.geometricMean(values)));
        setTextContent(statElements['stat-har-mean'], formatStat(ss => ss.harmonicMean(values)));
        setTextContent(statElements['stat-rms'], formatStat(ss => ss.rootMeanSquare(values)));
        setTextContent(statElements['stat-std-dev'], formatStat(ss => ss.standardDeviation(values)));
        setTextContent(statElements['stat-var'], formatStat(ss => ss.variance(values)));
        setTextContent(statElements['stat-iqr'], formatStat(ss => ss.interquartileRange(values)));
        setTextContent(
            statElements['stat-skewness'],
            formatStat(ss => (values.length >= 3 ? ss.sampleSkewness(values) : Number.NaN)),
        );

        getStatPercentiles().forEach(percentile => {
            setTextContent(
                statElements[`stat-p${percentile}`],
                formatStat(ss => ss.quantile(values, percentile / 100)),
            );
        });
    }

    return { render };
}
