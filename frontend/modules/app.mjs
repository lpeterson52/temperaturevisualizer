import FetchJob from '../fetchJob.js';
import { DEFAULT_POLL_OPTIONS, resolveRuntimeConfig } from './config.mjs';
import { transformApiResult } from './data.mjs';
import { createChartController } from './chart/chart-controller.mjs';
import { createOverlayController } from './chart/overlay-controller.mjs';
import {
    createAppState,
    replaceDataset,
    setStatsSelectedDatasetIndex,
    toggleSeriesVisibility,
} from './state.mjs';
import { runMergeJob, wakeupServer } from './services/job-service.mjs';
import { createLegendView } from './ui/legend-view.mjs';
import { createMarkerView } from './ui/marker-view.mjs';
import { createStatsView } from './ui/stats-view.mjs';
import { createStatusView } from './ui/status-view.mjs';

function createFetchJob(startDate, endDate, apiUrl) {
    return new FetchJob(startDate, endDate, apiUrl);
}

export function createApp(domRefs, runtimeConfig = resolveRuntimeConfig()) {
    const state = createAppState();
    const statusView = createStatusView({
        instructionsEl: domRefs.instructions,
        submitBtnEl: domRefs.submitBtn,
        chartContainerEl: domRefs.chartContainer,
    });
    const markerView = createMarkerView({
        barEl: domRefs.markerBar,
        contentEl: domRefs.markerBarContent,
    });

    let overlayController = null;

    const chartController = createChartController({
        containerEl: domRefs.chartContainer,
        mountEl: domRefs.uplotContainer,
        state,
        onViewportChange: () => {
            statsView.render(state);
            overlayController?.requestDraw();
        },
        onDraw: () => {
            overlayController?.requestDraw();
        },
    });

    const legendView = createLegendView({
        containerEl: domRefs.customLegend,
        onToggleSeries: seriesIndex => {
            const isVisible = toggleSeriesVisibility(state, seriesIndex);
            chartController.setSeriesVisibility(seriesIndex, isVisible);
            legendView.render(state);
            markerView.render(state);
            statsView.render(state);
            overlayController?.requestDraw();
        },
    });

    const statsView = createStatsView({
        panelEl: domRefs.statsPanel,
        selectorRowEl: domRefs.statsSelectorRow,
        onSelectDataset: datasetIndex => {
            setStatsSelectedDatasetIndex(state, datasetIndex);
            statsView.render(state);
        },
    });

    overlayController = createOverlayController({
        containerEl: domRefs.chartContainer,
        overlayEl: domRefs.overlayCanvas,
        clearButtonEl: domRefs.clearMarkersBtn,
        state,
        getChartController: () => chartController,
        markerView,
        statsView,
    });

    function renderViews() {
        legendView.render(state);
        markerView.render(state);
        statsView.render(state);
        overlayController.requestDraw();
    }

    async function loadRange(startDate, endDate) {
        statusView.clearError();
        statusView.setLoading(true);
        statusView.hideProgress();

        try {
            const rows = await runMergeJob(startDate, endDate, {
                apiUrl: runtimeConfig.apiUrl,
                createFetchJob,
                ...DEFAULT_POLL_OPTIONS,
                onProgress: progress => {
                    statusView.setProgress(progress);
                },
            });

            if (!rows.length) {
                throw new Error('No data was returned for the selected date range.');
            }

            replaceDataset(state, transformApiResult(rows));
            domRefs.emptyState.hidden = true;
            chartController.render();
            overlayController.attachToCurrentChart();
            renderViews();
        } catch (error) {
            console.error('Failed to load temperature data.', error);
            statusView.setError(`Failed to load data: ${error.message || error}`);
        } finally {
            statusView.setLoading(false);
            statusView.hideProgress();
        }
    }

    function resetZoom() {
        chartController.resetZoom();
    }

    function showValidationError(message) {
        statusView.setError(message);
    }

    function clearValidationError() {
        statusView.clearError();
    }

    function init() {
        wakeupServer(runtimeConfig);
        renderViews();
    }

    function destroy() {
        overlayController.destroy();
        chartController.destroy();
    }

    return {
        clearValidationError,
        destroy,
        init,
        loadRange,
        resetZoom,
        showValidationError,
    };
}
