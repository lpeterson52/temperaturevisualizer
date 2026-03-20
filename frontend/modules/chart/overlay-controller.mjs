import { formatTooltipTime } from '../data.mjs';
import {
    clearMarkers,
    placeMarkerAtIndex,
    setPreviewIndex,
} from '../state.mjs';

function ensureTooltip(containerEl) {
    let tooltipEl = document.getElementById('crosshair-tooltip');
    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.id = 'crosshair-tooltip';
        containerEl?.appendChild(tooltipEl);
    }

    const timeEl = document.createElement('span');
    const bulletEl = document.createElement('span');
    bulletEl.textContent = ' • ';
    const temperatureEl = document.createElement('span');
    temperatureEl.style.fontWeight = '700';

    tooltipEl.replaceChildren(timeEl, bulletEl, temperatureEl);
    tooltipEl.style.display = 'none';

    return { tooltipEl, timeEl, bulletEl, temperatureEl };
}

function drawMarkerLine(context, x, color, top, bottom, side) {
    context.save();
    context.strokeStyle = color;
    context.lineWidth = 1.5;
    context.setLineDash([5, 4]);
    context.globalAlpha = 0.85;
    context.beginPath();
    context.moveTo(x, top);
    context.lineTo(x, bottom);
    context.stroke();
    context.globalAlpha = 1;
    context.setLineDash([]);
    context.fillStyle = color;

    const flagWidth = 8;
    const flagX = side === 'right' ? x : x - flagWidth;
    context.fillRect(flagX, top, flagWidth, 8);
    context.restore();
}

export function createOverlayController({
    containerEl,
    overlayEl,
    clearButtonEl,
    state,
    getChartController,
    markerView,
    statsView,
}) {
    const context = overlayEl?.getContext('2d') ?? null;
    const { tooltipEl, timeEl, bulletEl, temperatureEl } = ensureTooltip(containerEl);
    let listenerAbortController = null;
    let pointerFrameId = 0;
    let drawFrameId = 0;
    let pendingPointerEvent = null;
    let pointerX = -1;
    let pointerY = -1;
    let lastClickTimestamp = 0;
    let pointerDownX = null;
    let lastDragDistance = 0;

    function getActiveChartController() {
        const chartController = getChartController();
        if (!chartController?.getChart()) {
            return null;
        }

        return chartController;
    }

    function resizeOverlay() {
        if (!overlayEl) {
            return;
        }

        overlayEl.width = overlayEl.offsetWidth;
        overlayEl.height = overlayEl.offsetHeight;
        requestDraw();
    }

    const resizeObserver = new ResizeObserver(() => {
        resizeOverlay();
    });
    if (overlayEl) {
        resizeObserver.observe(overlayEl);
    }
    resizeOverlay();

    function hideTooltip() {
        tooltipEl.style.display = 'none';
    }

    function updateLinkedViews() {
        markerView.render(state);
        statsView.render(state);
    }

    function clearPreviewIndexIfNeeded() {
        if (state.markers.previewIndex !== -1) {
            setPreviewIndex(state, -1);
            updateLinkedViews();
        }
    }

    function updateTooltipPosition(clientX, clientY) {
        const containerRect = containerEl.getBoundingClientRect();
        let tooltipX = clientX - containerRect.left;
        const tooltipY = Math.max(0, clientY - containerRect.top - 50);
        const tooltipWidth = tooltipEl.offsetWidth;

        tooltipX = Math.max(
            tooltipWidth / 2 + 4,
            Math.min(containerRect.width - tooltipWidth / 2 - 4, tooltipX),
        );

        tooltipEl.style.left = `${tooltipX}px`;
        tooltipEl.style.top = `${tooltipY}px`;
    }

    function getClosestVisibleTemperatureAtIndex(chartController, dataIndex, cssY) {
        const chart = chartController.getChart();
        const bounds = chartController.getPlotBounds();
        if (!chart || !bounds) {
            return { value: null, color: '' };
        }

        let closestSeriesIndex = -1;
        let closestDistance = Number.POSITIVE_INFINITY;

        state.dataset.seriesData.forEach((seriesValues, seriesIndex) => {
            if (!state.dataset.seriesVisible[seriesIndex]) {
                return;
            }

            const value = seriesValues[dataIndex];
            if (!Number.isFinite(value)) {
                return;
            }

            const yPosition = chart.valToPos(value, 'C') + bounds.top;
            const distance = Math.abs(cssY - yPosition);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestSeriesIndex = seriesIndex;
            }
        });

        if (closestSeriesIndex < 0) {
            return { value: null, color: '' };
        }

        return {
            value: state.dataset.seriesData[closestSeriesIndex][dataIndex],
            color: state.dataset.seriesMeta[closestSeriesIndex].stroke,
        };
    }

    function renderTooltip(chartController, dataIndex, clientX, clientY) {
        if (dataIndex < 0 || !state.dataset.timestamps[dataIndex]) {
            hideTooltip();
            return;
        }

        const containerRect = containerEl.getBoundingClientRect();
        const cssY = clientY - containerRect.top;
        const { value, color } = getClosestVisibleTemperatureAtIndex(chartController, dataIndex, cssY);

        timeEl.textContent = formatTooltipTime(state.dataset.timestamps[dataIndex]);
        if (value == null) {
            bulletEl.style.display = 'none';
            temperatureEl.style.display = 'none';
        } else {
            bulletEl.style.display = '';
            temperatureEl.style.display = '';
            temperatureEl.textContent = `${value.toFixed(2)} °C`;
            temperatureEl.style.color = color;
        }

        tooltipEl.style.display = 'block';
        updateTooltipPosition(clientX, clientY);
    }

    function processPointerEvent() {
        const pointerEvent = pendingPointerEvent;
        pendingPointerEvent = null;

        const chartController = getActiveChartController();
        if (!chartController) {
            hideTooltip();
            return;
        }

        const containerRect = containerEl.getBoundingClientRect();
        const bounds = chartController.getPlotBounds();
        if (!bounds) {
            hideTooltip();
            return;
        }

        if (!pointerEvent) {
            return;
        }

        pointerX = pointerEvent.clientX - containerRect.left;
        pointerY = pointerEvent.clientY - containerRect.top;

        const dataIndex = chartController.getDataIndexAtClientX(pointerEvent.clientX);
        renderTooltip(chartController, dataIndex, pointerEvent.clientX, pointerEvent.clientY);

        if (state.markers.a && !state.markers.b) {
            if (dataIndex !== state.markers.previewIndex) {
                setPreviewIndex(state, dataIndex);
                updateLinkedViews();
            }
        } else {
            clearPreviewIndexIfNeeded();
        }
    }

    function schedulePointerUpdate(event) {
        pendingPointerEvent = {
            clientX: event.clientX,
            clientY: event.clientY,
        };

        if (pointerFrameId) {
            return;
        }

        pointerFrameId = requestAnimationFrame(() => {
            pointerFrameId = 0;
            processPointerEvent();
            drawNow();
        });
    }

    function drawNow() {
        if (!context || !overlayEl) {
            return;
        }

        context.clearRect(0, 0, overlayEl.width, overlayEl.height);

        const chartController = getActiveChartController();
        const bounds = chartController?.getPlotBounds();
        if (!chartController || !bounds) {
            return;
        }

        const left = bounds.left;
        const top = bounds.top;
        const right = bounds.left + bounds.width;
        const bottom = bounds.top + bounds.height;
        const regionHeight = bottom - top;

        if (state.markers.a && !state.markers.b && pointerX >= left && pointerX <= right) {
            const markerAX = chartController.getCanvasXForIndex(state.markers.a.labelIndex);
            if (markerAX >= 0) {
                context.save();
                context.fillStyle = 'rgba(150,200,255,0.10)';
                context.fillRect(
                    Math.min(markerAX, pointerX),
                    top,
                    Math.abs(pointerX - markerAX),
                    regionHeight,
                );
                context.restore();
            }
        }

        if (state.markers.a && state.markers.b) {
            const markerAX = chartController.getCanvasXForIndex(state.markers.a.labelIndex);
            const markerBX = chartController.getCanvasXForIndex(state.markers.b.labelIndex);
            if (markerAX >= 0 && markerBX >= 0) {
                context.save();
                context.fillStyle = 'rgba(79,142,247,0.06)';
                context.fillRect(
                    Math.min(markerAX, markerBX),
                    top,
                    Math.abs(markerBX - markerAX),
                    regionHeight,
                );
                context.restore();
            }
        }

        if (state.markers.a) {
            const markerAX = chartController.getCanvasXForIndex(state.markers.a.labelIndex);
            if (markerAX >= 0) {
                drawMarkerLine(context, markerAX, '#f5c518', top, bottom, 'right');
            }
        }

        if (state.markers.b) {
            const markerBX = chartController.getCanvasXForIndex(state.markers.b.labelIndex);
            if (markerBX >= 0) {
                drawMarkerLine(context, markerBX, '#4fc3f7', top, bottom, 'left');
            }
        }

        if (pointerX < 0 || pointerX < left || pointerX > right) {
            return;
        }

        context.save();
        context.strokeStyle = 'rgba(255,255,255,0.2)';
        context.lineWidth = 1;
        context.setLineDash([4, 4]);
        context.beginPath();
        context.moveTo(pointerX, top);
        context.lineTo(pointerX, bottom);
        context.stroke();
        context.restore();
    }

    function requestDraw() {
        if (pointerFrameId || drawFrameId) {
            return;
        }

        drawFrameId = requestAnimationFrame(() => {
            drawFrameId = 0;
            drawNow();
        });
    }

    function handleMouseLeave() {
        pointerX = -1;
        pointerY = -1;
        hideTooltip();
        clearPreviewIndexIfNeeded();
        requestDraw();
    }

    function handleMouseDown(event) {
        if (event.button !== 0) {
            return;
        }

        pointerDownX = event.clientX;
        lastDragDistance = 0;
    }

    function handleMouseUp(event) {
        if (pointerDownX == null) {
            return;
        }

        lastDragDistance = Math.abs(event.clientX - pointerDownX);
        pointerDownX = null;
    }

    function handleClick(event) {
        const now = Date.now();
        if (now - lastClickTimestamp < 300) {
            return;
        }

        lastClickTimestamp = now;
        if (lastDragDistance > 5) {
            return;
        }

        const chartController = getActiveChartController();
        const dataIndex = chartController?.getDataIndexAtClientX(event.clientX) ?? -1;
        if (dataIndex < 0) {
            return;
        }

        placeMarkerAtIndex(state, dataIndex);
        updateLinkedViews();
        requestDraw();
    }

    function handleContextMenu(event) {
        event.preventDefault();
        if (!state.markers.a && !state.markers.b) {
            return;
        }

        clearMarkers(state);
        hideTooltip();
        updateLinkedViews();
        requestDraw();
    }

    clearButtonEl?.addEventListener('click', () => {
        clearMarkers(state);
        hideTooltip();
        updateLinkedViews();
        requestDraw();
    });

    function attachToCurrentChart() {
        listenerAbortController?.abort();
        listenerAbortController = new AbortController();
        pointerX = -1;
        pointerY = -1;
        hideTooltip();

        const chartController = getActiveChartController();
        const overEl = chartController?.getChart()?.over;
        if (!overEl) {
            return;
        }

        overEl.style.cursor = 'crosshair';
        const { signal } = listenerAbortController;

        overEl.addEventListener('mousemove', schedulePointerUpdate, { signal });
        overEl.addEventListener('mouseleave', handleMouseLeave, { signal });
        overEl.addEventListener('mousedown', handleMouseDown, { signal });
        overEl.addEventListener('mouseup', handleMouseUp, { signal });
        overEl.addEventListener('click', handleClick, { signal });
        overEl.addEventListener('contextmenu', handleContextMenu, { signal });
        requestDraw();
    }

    function destroy() {
        listenerAbortController?.abort();
        resizeObserver.disconnect();
    }

    return {
        attachToCurrentChart,
        destroy,
        requestDraw,
    };
}
