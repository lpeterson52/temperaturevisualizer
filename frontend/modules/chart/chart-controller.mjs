import { CHART_FONT } from '../config.mjs';
import { getCssColorVar, getSeriesStrokeForTheme } from '../theme.mjs';
import {
    calcTimeStepSize,
    formatAxisTemperature,
    formatTimeAxisLabel,
    getClosestIndexForUnixSeconds,
    getXAxisTicks,
} from '../data.mjs';
import { setViewport } from '../state.mjs';
import { computeVisibleYRange, nearlyEqual } from './chart-math.mjs';

export function createChartController({
    containerEl,
    mountEl,
    state,
    onViewportChange = () => {},
    onDraw = () => {},
}) {
    let chart = null;
    let fittingYScale = false;
    let yAxisMeasureContext = null;

    const resizeObserver = new ResizeObserver(() => {
        if (!chart) {
            return;
        }

        chart.setSize({
            width: containerEl.clientWidth,
            height: containerEl.clientHeight,
        });
        onDraw();
    });
    resizeObserver.observe(containerEl);

    function getMeasureContext() {
        if (!yAxisMeasureContext) {
            yAxisMeasureContext = document.createElement('canvas').getContext('2d');
        }

        yAxisMeasureContext.font = CHART_FONT;
        return yAxisMeasureContext;
    }

    function measureAxisLabelWidth(values, fallbackValue) {
        const context = getMeasureContext();
        const probeValues = values?.length ? values : [fallbackValue];
        const maxWidth = probeValues.reduce((currentMax, value) => (
            Math.max(currentMax, context.measureText(String(value)).width)
        ), 0);
        return Math.ceil(maxWidth) + 16;
    }

    function syncViewport(minX, maxX) {
        setViewport(state, minX, maxX);
        fitVisibleYScale();
        onViewportChange({ minX, maxX });
        onDraw();
    }

    function fitVisibleYScale() {
        if (!chart || fittingYScale) {
            return;
        }

        const range = computeVisibleYRange(
            state.dataset,
            state.viewport.minX,
            state.viewport.maxX,
        );
        const previousMin = chart.scales.C?.min;
        const previousMax = chart.scales.C?.max;

        if (
            nearlyEqual(previousMin ?? Number.NaN, range.min) &&
            nearlyEqual(previousMax ?? Number.NaN, range.max)
        ) {
            return;
        }

        fittingYScale = true;
        try {
            chart.setScale('C', range);
        } finally {
            fittingYScale = false;
        }
    }

    function buildWheelZoomPanPlugin() {
        let fullMinX = 0;
        let fullMaxX = 1;

        return {
            hooks: {
                ready(u) {
                    fullMinX = state.viewport.initialMinX;
                    fullMaxX = state.viewport.initialMaxX;
                    const overlayTarget = u.over;
                    const abortController = new AbortController();
                    const { signal } = abortController;
                    const dpr = globalThis.devicePixelRatio || 1;

                    let dragStartClientX = null;
                    let scaleMinAtDrag = 0;
                    let scaleMaxAtDrag = 0;

                    overlayTarget.addEventListener('mousedown', event => {
                        if (event.button !== 0) {
                            return;
                        }

                        dragStartClientX = event.clientX;
                        scaleMinAtDrag = u.scales.x.min;
                        scaleMaxAtDrag = u.scales.x.max;
                    }, { signal });

                    globalThis.addEventListener('mousemove', event => {
                        if (dragStartClientX == null) {
                            return;
                        }

                        const dragDelta = event.clientX - dragStartClientX;
                        const unitsPerCssPixel = (scaleMaxAtDrag - scaleMinAtDrag) / u.bbox.width * dpr;
                        let nextMinX = scaleMinAtDrag - dragDelta * unitsPerCssPixel;
                        let nextMaxX = scaleMaxAtDrag - dragDelta * unitsPerCssPixel;

                        if (nextMinX < fullMinX) {
                            nextMaxX += fullMinX - nextMinX;
                            nextMinX = fullMinX;
                        }
                        if (nextMaxX > fullMaxX) {
                            nextMinX -= nextMaxX - fullMaxX;
                            nextMaxX = fullMaxX;
                        }

                        u.setScale('x', { min: nextMinX, max: nextMaxX });
                        syncViewport(nextMinX, nextMaxX);
                    }, { signal });

                    globalThis.addEventListener('mouseup', () => {
                        dragStartClientX = null;
                    }, { signal });

                    overlayTarget.addEventListener('wheel', event => {
                        event.preventDefault();

                        const zoomFactor = event.deltaY < 0 ? 0.8 : 1.25;
                        const currentMinX = u.scales.x.min;
                        const currentMaxX = u.scales.x.max;
                        const currentRange = currentMaxX - currentMinX;
                        const plotWidthCss = u.bbox.width / dpr;
                        const leftRatio = u.cursor.left / plotWidthCss;
                        const focusX = currentMinX + leftRatio * currentRange;

                        let nextMinX = focusX - leftRatio * currentRange * zoomFactor;
                        let nextMaxX = nextMinX + currentRange * zoomFactor;

                        if (nextMinX < fullMinX) {
                            nextMaxX += fullMinX - nextMinX;
                            nextMinX = fullMinX;
                        }
                        if (nextMaxX > fullMaxX) {
                            nextMinX -= nextMaxX - fullMaxX;
                            nextMaxX = fullMaxX;
                        }

                        nextMinX = Math.max(nextMinX, fullMinX);
                        nextMaxX = Math.min(nextMaxX, fullMaxX);

                        u.setScale('x', { min: nextMinX, max: nextMaxX });
                        syncViewport(nextMinX, nextMaxX);
                    }, { passive: false, signal });

                    u.hooks.destroy = u.hooks.destroy || [];
                    u.hooks.destroy.push(() => {
                        abortController.abort();
                    });
                },
            },
        };
    }

    function createOptions() {
        const dpr = globalThis.devicePixelRatio || 1;
        const axisStroke = getCssColorVar('--chart-axis-stroke', '#555d75');
        const gridStroke = getCssColorVar('--chart-grid-stroke', 'rgba(255,255,255,0.04)');
        const tickStroke = getCssColorVar('--chart-tick-stroke', 'rgba(255,255,255,0.2)');

        // opts
        return {
            width: containerEl.clientWidth,
            height: containerEl.clientHeight,
            legend: { show: false },
            cursor: {
                show: true,
                drag: { setScale: false, x: false, y: false },
            },
            series: [
                {
                    label: 'Time',
                    value: (_, value) => (
                        value == null ? '' : new Date(value * 1000).toLocaleString()
                    ),
                },
                ...state.dataset.seriesMeta.map((meta, index) => ({
                    label: meta.label,
                    stroke: getSeriesStrokeForTheme(meta.stroke),
                    width: 1.5,
                    show: state.dataset.seriesVisible[index],
                    spanGaps: false,
                    value: (_, value) => (
                        value == null ? '' : `${value.toFixed(2)} °C`
                    ),
                    scale: 'C',
                })),
            ],
            axes: [
                {
                    stroke: axisStroke,
                    grid: { stroke: gridStroke, width: 1 },
                    ticks: { stroke: tickStroke, width: 1 },
                    font: CHART_FONT,
                    values: (u, splits) => {
                        const plotWidth = u.bbox.width / dpr;
                        const stepMinutes = calcTimeStepSize(
                            u.scales.x.min,
                            u.scales.x.max,
                            plotWidth,
                        );
                        return splits.map(split => formatTimeAxisLabel(split, stepMinutes));
                    },
                    splits: (u, axisIndex, scaleMin, scaleMax) => {
                        const plotWidth = u.bbox.width / dpr;
                        return getXAxisTicks(scaleMin, scaleMax, plotWidth).map(tick => tick.value);
                    },
                    size: 40,
                    gap: 6,
                },
                {
                    scale: 'C',
                    stroke: axisStroke,
                    grid: { stroke: gridStroke, width: 1 },
                    ticks: { stroke: tickStroke, width: 1 },
                    font: CHART_FONT,
                    values: (_, ticks) => ticks.map(value => formatAxisTemperature(value, 'C')),
                    size: (_, values) => measureAxisLabelWidth(values, '-99.9° C'),
                    gap: 6,
                },
                {
                    scale: 'F',
                    stroke: axisStroke,
                    grid: { show: false },
                    font: CHART_FONT,
                    values: (_, ticks) => ticks.map(value => formatAxisTemperature(value, 'F')),
                    size: (_, values) => measureAxisLabelWidth(values, '-199.9° F'),
                    gap: 6,
                    side: 1,
                },
            ],
            scales: {
                x: {
                    time: true,
                    auto: false,
                    min: state.viewport.minX,
                    max: state.viewport.maxX,
                },
                C: { auto: false },
                F: {
                    from: 'C',
                    range: (_, fromMin, fromMax) => ([
                        (fromMin * 9 / 5) + 32,
                        (fromMax * 9 / 5) + 32,
                    ]),
                },
            },
            plugins: [buildWheelZoomPanPlugin()],
            hooks: {
                draw: [
                    () => {
                        onDraw();
                    },
                ],
            },
        };
    }

    function destroyChart() {
        if (!chart) {
            return;
        }

        chart.destroy();
        chart = null;
    }

    function render() {
        destroyChart();
        mountEl.textContent = '';

        if (!state.dataset.timestamps.length) {
            return null;
        }

        if (typeof globalThis.uPlot !== 'function') {
            throw new Error('uPlot is not available on the page.');
        }

        const uplotData = [state.dataset.timestamps, ...state.dataset.seriesData];
        chart = new globalThis.uPlot(createOptions(), uplotData, mountEl);
        syncViewport(state.viewport.minX, state.viewport.maxX);
        return chart;
    }

    function setSeriesVisibility(seriesIndex, visible) {
        if (!chart?.series?.[seriesIndex + 1]) {
            return;
        }

        chart.series[seriesIndex + 1].show = visible;
        chart.redraw();
        fitVisibleYScale();
        onDraw();
    }

    function resetZoom() {
        if (!chart) {
            return;
        }

        const { initialMinX, initialMaxX } = state.viewport;
        chart.setScale('x', { min: initialMinX, max: initialMaxX });
        syncViewport(initialMinX, initialMaxX);
        render();
    }

    function getPlotBounds() {
        if (!chart?.bbox) {
            return null;
        }

        const dpr = globalThis.devicePixelRatio || 1;
        return {
            left: chart.bbox.left / dpr,
            top: chart.bbox.top / dpr,
            width: chart.bbox.width / dpr,
            height: chart.bbox.height / dpr,
        };
    }

    function getDataIndexAtClientX(clientX) {
        if (!chart) {
            return -1;
        }

        const bounds = getPlotBounds();
        if (!bounds) {
            return -1;
        }

        const containerRect = containerEl.getBoundingClientRect();
        const cssX = clientX - containerRect.left;
        const plotX = cssX - bounds.left;

        if (plotX < 0 || plotX > bounds.width) {
            return -1;
        }

        const xValue = chart.posToVal(plotX, 'x');
        return getClosestIndexForUnixSeconds(state.dataset.timestamps, xValue);
    }

    function getCanvasXForIndex(dataIndex) {
        if (!chart || dataIndex < 0 || dataIndex >= state.dataset.timestamps.length) {
            return -1;
        }

        const bounds = getPlotBounds();
        if (!bounds) {
            return -1;
        }

        return chart.valToPos(state.dataset.timestamps[dataIndex], 'x') + bounds.left;
    }

    function destroy() {
        resizeObserver.disconnect();
        destroyChart();
    }

    return {
        destroy,
        fitVisibleYScale,
        getChart: () => chart,
        getCanvasXForIndex,
        getDataIndexAtClientX,
        getPlotBounds,
        render,
        requestOverlayDraw: onDraw,
        resetZoom,
        setSeriesVisibility,
    };
}
