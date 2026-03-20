function createEmptyDataset() {
    return {
        labels: [],
        timestamps: new Float64Array(0),
        seriesData: [],
        seriesMeta: [],
        seriesVisible: [],
    };
}

function getVisibleSeriesLabels(dataset) {
    const visibleLabels = new Set();

    dataset.seriesMeta.forEach((meta, index) => {
        if (dataset.seriesVisible[index]) {
            visibleLabels.add(meta.label);
        }
    });

    return visibleLabels;
}

function getInitialViewport(timestamps) {
    if (!timestamps.length) {
        return {
            initialMinX: 0,
            initialMaxX: 1,
            minX: 0,
            maxX: 1,
        };
    }

    const initialMinX = timestamps[0];
    const lastTimestamp = timestamps[timestamps.length - 1];
    const initialMaxX = lastTimestamp > initialMinX ? lastTimestamp : initialMinX + 60;

    return {
        initialMinX,
        initialMaxX,
        minX: initialMinX,
        maxX: initialMaxX,
    };
}

export function createAppState() {
    return {
        dataset: createEmptyDataset(),
        viewport: getInitialViewport([]),
        markers: {
            a: null,
            b: null,
            previewIndex: -1,
        },
        statsSelectedDatasetIdx: -1,
    };
}

export function replaceDataset(state, dataset) {
    const previouslyVisibleLabels = getVisibleSeriesLabels(state.dataset);
    const nextVisibility = dataset.seriesMeta.map((meta, index) => (
        previouslyVisibleLabels.size > 0
            ? previouslyVisibleLabels.has(meta.label)
            : Boolean(dataset.seriesVisible[index])
    ));

    state.dataset = {
        labels: dataset.labels,
        timestamps: dataset.timestamps,
        seriesData: dataset.seriesData,
        seriesMeta: dataset.seriesMeta,
        seriesVisible: nextVisibility,
    };
    state.viewport = getInitialViewport(dataset.timestamps);
    clearMarkers(state);
    state.statsSelectedDatasetIdx = -1;
}

export function hasDataset(state) {
    return state.dataset.timestamps.length > 0;
}

export function setViewport(state, minX, maxX) {
    state.viewport.minX = minX;
    state.viewport.maxX = maxX;
}

export function clearMarkers(state) {
    state.markers.a = null;
    state.markers.b = null;
    state.markers.previewIndex = -1;
}

export function setPreviewIndex(state, previewIndex) {
    state.markers.previewIndex = Number.isInteger(previewIndex) && previewIndex >= 0 ? previewIndex : -1;
}

export function placeMarkerAtIndex(state, labelIndex) {
    if (!Number.isInteger(labelIndex) || labelIndex < 0) {
        return;
    }

    if (state.markers.a && state.markers.b) {
        clearMarkers(state);
        return;
    }

    if (state.markers.a) {
        state.markers.b = { labelIndex };
        state.markers.previewIndex = -1;
        return;
    }

    state.markers.a = { labelIndex };
    state.markers.b = null;
    state.markers.previewIndex = -1;
}

export function getVisibleDatasets(state) {
    return state.dataset.seriesMeta
        .map((meta, index) => ({ meta, index }))
        .filter(({ index }) => state.dataset.seriesVisible[index]);
}

export function ensureStatsSelection(state) {
    const visibleDatasets = getVisibleDatasets(state);
    const stillVisible = visibleDatasets.some(({ index }) => index === state.statsSelectedDatasetIdx);

    if (!stillVisible) {
        state.statsSelectedDatasetIdx = visibleDatasets.length > 0 ? visibleDatasets[0].index : -1;
    }

    return state.statsSelectedDatasetIdx;
}

export function setStatsSelectedDatasetIndex(state, datasetIndex) {
    state.statsSelectedDatasetIdx = Number.isInteger(datasetIndex) ? datasetIndex : -1;
}

export function setSeriesVisibility(state, seriesIndex, visible) {
    if (seriesIndex < 0 || seriesIndex >= state.dataset.seriesVisible.length) {
        return false;
    }

    state.dataset.seriesVisible[seriesIndex] = Boolean(visible);
    return state.dataset.seriesVisible[seriesIndex];
}

export function toggleSeriesVisibility(state, seriesIndex) {
    return setSeriesVisibility(state, seriesIndex, !state.dataset.seriesVisible[seriesIndex]);
}
