import FetchJob from './fetchJob.js'

const DEBUG = true;
const backendUrl = "https://temperaturevisualizer.onrender.com/";
const apiUrl = DEBUG ? "http://localhost:8000/api" : backendUrl + "api";

// ─── Global state ──────────────────────────────────────────────────────────
let temperatureChart = null;   // uPlot instance
let chartLabels = [];          // raw label strings from data
let rawTimestamps = [];        // unix seconds for uPlot x-axis
let rawSeriesData = [];        // rawSeriesData[i] = Float64Array of y-values for series i (0-based, matches uPlot data[i+1])
let seriesMeta = [];           // { label, stroke, fill } per series (index 0 = series[1] in uPlot)
let seriesVisible = [];        // boolean[] — visibility state per series
let markerA = null;            // { labelIndex }
let markerB = null;
let statsSelectedDatasetIdx = -1;
let savedVisibility = null;    // Set<label> persisted across date-range reloads
let _initXMin = 0;             // full-data x range for reset-zoom
let _initXMax = 0;
let _fittingY = false;         // re-entrancy guard for fitYAxis
let _yAxisMeasureCtx = null;   // shared canvas context for y-axis label measurement

function nearlyEqual(a, b, epsilon = 1e-9) {
    return Math.abs(a - b) <= epsilon;
}

function wakeupServer() {
    if (DEBUG) return;
    fetch(backendUrl);
}
wakeupServer();

// ─── Color palette ─────────────────────────────────────────────────────────
const colorPairs = [
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
];

// Returns { uplotData, meta, visible }
// uplotData[0]      = Float64Array of unix-seconds timestamps
// uplotData[1..N]   = Float64Array of y-values per series (null → NaN for uPlot)
// meta[i]           = { label, stroke, fill }  (matches uplotData[i+1])
// visible[i]        = boolean
function generateTankConfigs(data) {
    const n = data.length;
    const letters = ['A', 'B', 'C', 'D'];
    const states  = ['Warm', 'Cool'];

    // Build x-axis: unix seconds (uPlot native time unit)
    const xArr = new Float64Array(n);
    for (let j = 0; j < n; j++) {
        xArr[j] = new Date(data[j]["Date-Time"]).getTime() / 1000;
    }

    const yArrays = [];
    const meta    = [];
    const visible = [];
    let ci = 0;

    for (const letter of letters) {
        for (let i = 1; i <= 4; i++) {
            for (const state of states) {
                const key = `Tank ${letter}${i} ${state} (C)`;
                const yArr = new Float64Array(n);
                for (let j = 0; j < n; j++) {
                    const v = data[j][key];
                    yArr[j] = (v == null || v === '' || isNaN(v)) ? NaN : +v;
                }
                yArrays.push(yArr);
                meta.push({
                    label:  `Tank ${letter}${i} ${state} (°C)`,
                    stroke: colorPairs[ci][0],
                    fill:   colorPairs[ci][1],
                });
                visible.push(false); // all hidden by default
                ci++;
            }
        }
    }

    return { uplotData: [xArr, ...yArrays], meta, visible };
}

// ─── Custom Legend ─────────────────────────────────────────────────────────
function updateCustomLegend() {
    const container = document.getElementById('custom-legend');
    if (!container) return;
    container.innerHTML = '';

    const letters = ['A', 'B', 'C', 'D'];
    // Grid render order within each letter group (8 datasets: 4 tanks × 2 states)
    // Original order: 1W(0),1C(1),2W(2),2C(3),3W(4),3C(5),4W(6),4C(7)
    const renderOrder = [0, 1, 2, 3, 4, 5, 6, 7];

    letters.forEach(letter => {
        const letterBaseIdx = letters.indexOf(letter) * 8;
        const groupDiv = document.createElement('div');
        groupDiv.className = 'legend-letter-group';

        const header = document.createElement('div');
        header.className = 'legend-letter-header';
        header.textContent = `Tank ${letter}`;
        groupDiv.appendChild(header);

        const grid = document.createElement('div');
        grid.className = 'legend-tank-grid';

        renderOrder.forEach(offset => {
            const dsIdx = letterBaseIdx + offset; // 0-based index into seriesMeta/seriesVisible
            const meta = seriesMeta[dsIdx];
            if (!meta) return;
            const vis = seriesVisible[dsIdx];

            const item = document.createElement('div');
            item.className = 'legend-item' + (vis ? ' active' : '');
            item.style.setProperty("--tank-color", `${meta.stroke}`);

            const box = document.createElement('span');
            box.style.cssText = `
                display:inline-block;width:8px;height:8px;flex-shrink:0;
                background:${meta.stroke};border-radius:2px;
                opacity:${vis ? 1 : 0.3};
            `;

            const tankNum = Math.floor(offset / 2) + 1;
            const stateChar = offset % 2 === 0 ? 'Warm' : 'Cool';
            const lbl = document.createElement('span');
            lbl.textContent = `${tankNum} ${stateChar}`;

            item.appendChild(box);
            item.appendChild(lbl);
            item.onclick = () => {
                seriesVisible[dsIdx] = !seriesVisible[dsIdx];
                if (temperatureChart) {
                    // setSeries updates the built-in legend DOM (l.style), which doesn't
                    // exist when legend:{show:false} — directly mutate the series object instead.
                    temperatureChart.series[dsIdx + 1].show = seriesVisible[dsIdx];
                    temperatureChart.redraw();
                }
                fitYAxis();
                updateCustomLegend();
                updateMarkerBar();
                updateStatsPanel();
            };
            item.onmouseover
            grid.appendChild(item);
        });

        groupDiv.appendChild(grid);
        container.appendChild(groupDiv);
    });
}

// ─── Marker helpers ────────────────────────────────────────────────────────
function formatLabel(label) {
    return label ?? '—';
}

function deltaString(labelA, labelB) {
    // Try to parse as date/time strings
    const a = new Date(labelA);
    const b = new Date(labelB);
    if (isNaN(a) || isNaN(b)) return `${labelA} → ${labelB}`;
    const ms = Math.abs(b - a);
    const totalSec = Math.floor(ms / 1000);
    const days  = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const mins  = Math.floor((totalSec % 3600)  / 60);
    const secs  = totalSec % 60;
    const parts = [];
    if (days)  parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (mins)  parts.push(`${mins}m`);
    parts.push(`${secs}s`);
    return parts.join(' ');
}

function updateMarkerBar(markerBPendingIdx = -1) {
    const bar = document.getElementById('marker-bar');
    const content = document.getElementById('marker-bar-content');
    if (!bar || !content) return;

    if (!markerA) {
        bar.style.display = 'none';
        content.innerHTML = '';
        return;
    }
    bar.style.display = 'flex';
    content.innerHTML = '';

    function buildMarkerSection(marker, dotClass, dimmed = false) {
        const section = document.createElement('div');
        section.className = 'marker-section';
        if (dimmed) section.style.opacity = '0.5';

        const header = document.createElement('div');
        header.className = 'marker-header';
        const dot = document.createElement('span');
        dot.className = `marker-dot ${dotClass}`;
        header.appendChild(dot);
        const timeSpan = document.createElement('span');
        timeSpan.className = 'marker-time';
        // rawTimestamps are unix seconds; convert to minutes for formatTimeLabel
        timeSpan.textContent = formatTimeLabel(rawTimestamps[marker.labelIndex] / 60, 1);
        header.appendChild(timeSpan);
        section.appendChild(header);

        if (temperatureChart && rawSeriesData.length) {
            const valuesDiv = document.createElement('div');
            valuesDiv.className = 'marker-values';
            rawSeriesData.forEach((yArr, i) => {
                if (!seriesVisible[i]) return;
                const v = yArr[marker.labelIndex];
                if (v == null || isNaN(v)) return;
                const chip = document.createElement('span');
                chip.className = 'marker-chip';
                chip.style.color = seriesMeta[i].stroke;
                chip.textContent = v.toFixed(2) + ' °C';
                valuesDiv.appendChild(chip);
            });
            section.appendChild(valuesDiv);
        }
        return section;
    }

    content.appendChild(buildMarkerSection(markerA, 'marker-a'));

    if (markerB) {
        content.appendChild(buildMarkerSection(markerB, 'marker-b'));
        const deltaEl = document.createElement('div');
        deltaEl.className = 'marker-info marker-delta';
        deltaEl.innerHTML = `<span>Δt: </span><span>${deltaString(
            chartLabels[markerA.labelIndex],
            chartLabels[markerB.labelIndex]
        )}</span>`;
        content.appendChild(deltaEl);
    } else if (markerBPendingIdx >= 0 && rawTimestamps[markerBPendingIdx]) {
        content.appendChild(buildMarkerSection({ labelIndex: markerBPendingIdx }, 'marker-b', true));
        const deltaEl = document.createElement('div');
        deltaEl.className = 'marker-info marker-delta';
        deltaEl.style.opacity = '0.5';
        deltaEl.innerHTML = `<span>Δt: </span><span>${deltaString(
            chartLabels[markerA.labelIndex],
            chartLabels[markerBPendingIdx]
        )}</span>`;
        content.appendChild(deltaEl);
    }
}

// ─── Stats panel ──────────────────────────────────────────────────────────
function updateStatsPanel(markerBPendingIdx = -1) {
    if (!temperatureChart) return;
    const selectorRow = document.getElementById('stats-selector-row');
    if (!selectorRow) return;

    // Build visible dataset list (0-based into seriesMeta/rawSeriesData)
    const visibleDatasets = [];
    seriesMeta.forEach((m, i) => {
        if (seriesVisible[i]) visibleDatasets.push({ meta: m, i });
    });

    // Resolve selected dataset — fall back to first visible if selection gone
    if (!visibleDatasets.some(e => e.i === statsSelectedDatasetIdx)) {
        statsSelectedDatasetIdx = visibleDatasets.length > 0 ? visibleDatasets[0].i : -1;
    }
    const selectedIdx = statsSelectedDatasetIdx;

    // Rebuild selector
    selectorRow.innerHTML = '';
    if (visibleDatasets.length === 1) {
        const lbl = document.createElement('span');
        lbl.className = 'stats-single-label';
        lbl.textContent = visibleDatasets[0].meta.label.replace(' (°C)', '');
        lbl.style.color = visibleDatasets[0].meta.stroke;
        selectorRow.appendChild(lbl);
    } else if (visibleDatasets.length > 1) {
        const select = document.createElement('select');
        select.className = 'stats-select';
        if (selectedIdx >= 0) select.style.color = seriesMeta[selectedIdx].stroke;
        visibleDatasets.forEach(({ meta, i }) => {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = meta.label.replace(' (°C)', '');
            opt.style.color = meta.stroke;
            if (i === selectedIdx) opt.selected = true;
            select.appendChild(opt);
        });
        select.addEventListener('change', () => {
            statsSelectedDatasetIdx = parseInt(select.value);
            updateStatsPanel();
        });
        selectorRow.appendChild(select);
    }

    // Determine index range: zoom window, or between markers
    const xScale = temperatureChart.scales.x;
    // xScale.min/max are unix seconds; convert via getIndexForTime which uses minutes
    let minIdx = xScale ? getIndexForTime(xScale.min / 60) : 0;
    let maxIdx = xScale ? getIndexForTime(xScale.max / 60) : Math.max(0, rawTimestamps.length - 1);
    if (markerA) {
        let markerBIdx;
        if (markerB) {
            markerBIdx = markerB.labelIndex;
        } else if (markerBPendingIdx >= 0) {
            markerBIdx = markerBPendingIdx;
        }
        if (markerBIdx != null) {
            minIdx = Math.min(markerA.labelIndex, markerBIdx);
            maxIdx = Math.max(markerA.labelIndex, markerBIdx);
        }
    }

    const em = '\u2014';

    // Gather values from rawSeriesData
    const values = [];
    if (selectedIdx >= 0 && rawSeriesData[selectedIdx]) {
        const src = rawSeriesData[selectedIdx];
        for (let k = minIdx; k <= maxIdx; k++) {
            const v = src[k];
            if (v != null && isFinite(v) && !isNaN(v)) values.push(v);
        }
    }

    function stat(fn) {
        if (!values.length) return em;
        try {
            const v = fn();
            if (typeof v !== 'number' || !isFinite(v)) return em;
            return v.toFixed(3);
        } catch { return em; }
    }

    function setEl(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    setEl('stat-count',    values.length > 0 ? values.length.toString() : em);
    setEl('stat-min',      stat(() => ss.min(values)));
    setEl('stat-max',      stat(() => ss.max(values)));
    setEl('stat-mean',     stat(() => ss.mean(values)));
    setEl('stat-median',   stat(() => ss.median(values)));
    setEl('stat-mode',     stat(() => { const m = ss.mode(values); return Array.isArray(m) ? m[0] : m; }));
    setEl('stat-geo-mean', stat(() => ss.geometricMean(values)));
    setEl('stat-har-mean', stat(() => ss.harmonicMean(values)));
    setEl('stat-rms',      stat(() => ss.rootMeanSquare(values)));
    setEl('stat-std-dev',  stat(() => ss.standardDeviation(values)));
    setEl('stat-var',      stat(() => ss.variance(values)));
    setEl('stat-iqr',      stat(() => ss.interquartileRange(values)));
    setEl('stat-skewness', stat(() => values.length >= 3 ? ss.sampleSkewness(values) : NaN));
    [1, 5, 10, 25, 50, 75, 90, 95, 99].forEach(p => {
        setEl(`stat-p${p}`, stat(() => ss.quantile(values, p / 100)));
    });
}

// ─── Overlay canvas (crosshair + markers) ─────────────────────────────────
function setupOverlay() {
    const overlay = document.getElementById('overlay-canvas');
    const container = document.getElementById('chart-container');
    if (!overlay || !container) return;

    // Size overlay to match container
    const resizeOverlay = () => {
        overlay.width  = overlay.offsetWidth;
        overlay.height = overlay.offsetHeight;
    };
    resizeOverlay();
    new ResizeObserver(resizeOverlay).observe(overlay);

    // Tooltip element (sits inside chart-container)
    let tooltip = document.getElementById('crosshair-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'crosshair-tooltip';
        container.appendChild(tooltip);
    }

    const ctx = overlay.getContext('2d');

    let cursorX = -1, cursorY = -1;

    // ── uPlot coordinate helpers ──────────────────────────────────────────

    function getPlotBbox() {
        if (!temperatureChart) return null;
        // uPlot exposes bbox in CSS pixels (not device pixels)
        return temperatureChart.bbox; // { left, top, width, height }
    }

    // Returns the nearest data index for a given CSS-pixel x inside the plot
    function getLabelIndexAtCSSX(cssX) {
        if (!temperatureChart) return -1;
        const bb = getPlotBbox();
        if (!bb) return -1;
        const xVal = temperatureChart.posToVal(cssX - bb.left / devicePixelRatio, 'x');
        return getIndexForTime(xVal / 60);
    }

    // Returns the CSS-pixel x for a data index
    function getCanvasXForIndex(idx) {
        if (!temperatureChart || !rawTimestamps.length) return -1;
        const bb = getPlotBbox();
        if (!bb) return -1;
        const px = temperatureChart.valToPos(rawTimestamps[idx], 'x');
        return px + bb.left / devicePixelRatio;
    }

    function drawMarkerLine(ctx, x, color, side = 'right') {
        if (!temperatureChart) return;
        const bb = getPlotBbox();
        if (!bb) return;
        const dpr = devicePixelRatio;
        const top    = bb.top    / dpr;
        const bottom = (bb.top + bb.height) / dpr;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
        ctx.stroke();
        // small flag at top
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
        ctx.fillStyle = color;
        const fW = 8, fH = 8;
        const fx = side === 'right' ? x : x - fW;
        ctx.fillRect(fx, top, fW, fH);
        ctx.restore();
    }

    function drawCrosshair() {
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        if (!temperatureChart) return;

        const bb = getPlotBbox();
        if (!bb) return;
        const dpr    = devicePixelRatio;
        const left   = bb.left   / dpr;
        const top    = bb.top    / dpr;
        const right  = (bb.left + bb.width)  / dpr;
        const bottom = (bb.top  + bb.height) / dpr;
        const regionH = bottom - top;

        // Preview fill: A placed, B not yet, cursor in plot area
        if (markerA && !markerB && cursorX >= left && cursorX <= right) {
            const ax = getCanvasXForIndex(markerA.labelIndex);
            if (ax >= 0) {
                ctx.save();
                ctx.fillStyle = 'rgba(150,200,255,0.10)';
                ctx.fillRect(Math.min(ax, cursorX), top, Math.abs(cursorX - ax), regionH);
                ctx.restore();
            }
        }

        // Solid region between both placed markers
        if (markerA && markerB) {
            const ax = getCanvasXForIndex(markerA.labelIndex);
            const bx = getCanvasXForIndex(markerB.labelIndex);
            if (ax >= 0 || bx >= 0) {
                ctx.save();
                ctx.fillStyle = 'rgba(79,142,247,0.06)';
                ctx.fillRect(Math.min(ax, bx), top, Math.abs(bx - ax), regionH);
                ctx.restore();
            }
        }

        // Draw marker lines on top of fills
        if (markerA) {
            const ax = getCanvasXForIndex(markerA.labelIndex);
            if (ax >= 0) drawMarkerLine(ctx, ax, '#f5c518', 'right');
        }
        if (markerB) {
            const bx = getCanvasXForIndex(markerB.labelIndex);
            if (bx >= 0) drawMarkerLine(ctx, bx, '#4fc3f7', 'left');
        }

        // Crosshair vertical line
        if (cursorX < 0 || cursorX < left || cursorX > right) return;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(cursorX, top);
        ctx.lineTo(cursorX, bottom);
        ctx.stroke();
        ctx.restore();
    }

    // ── Tooltip helpers ───────────────────────────────────────────────────

    function formatTimeFromUnixSec(unixSec) {
        const date = new Date(unixSec * 1000);
        let hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        return `${hours}:${minutes} ${ampm}`;
    }

    function getClosestVisibleTempAtIndex(idx, cssY) {
        if (!temperatureChart) return { temp: null, color: null };
        const bb = getPlotBbox();
        if (!bb) return { temp: null, color: null };
        const dpr = devicePixelRatio;
        let closestIdx = -1, closestDist = Infinity;
        rawSeriesData.forEach((yArr, i) => {
            if (!seriesVisible[i]) return;
            const v = yArr[idx];
            if (v == null || isNaN(v)) return;
            const yPx = temperatureChart.valToPos(v, 'y') + bb.top / dpr;
            const dist = Math.abs(cssY - yPx);
            if (dist < closestDist) { closestDist = dist; closestIdx = i; }
        });
        if (closestIdx >= 0) {
            return { temp: rawSeriesData[closestIdx][idx], color: seriesMeta[closestIdx].stroke };
        }
        return { temp: null, color: null };
    }

    // ── Mouse events — attach to uPlot's .u-over div ──────────────────────
    // uPlot creates a div.u-over that receives pointer events over the plot area.
    // We wait for it to exist (it's created synchronously on uPlot construction).
    function getOver() {
        return temperatureChart?.over ?? null;
    }

    // We need to re-attach listeners whenever the chart is re-created.
    // Store them on the overlay element and call attachMouseListeners from displayChart.
    let mouseDown = false;
    let mouseDownX = 0;
    let lastClickTime = 0;

    function onMouseMove(e) {
        if (!temperatureChart) return;
        const rect = container.getBoundingClientRect();
        cursorX = e.clientX - rect.left;
        cursorY = e.clientY - rect.top;

        // Convert CSS coords to data index via uPlot
        const bb = getPlotBbox();
        if (!bb) { drawCrosshair(); return; }
        const dpr = devicePixelRatio;
        const plotLeft = bb.left / dpr;
        const cssXInPlot = cursorX - plotLeft;
        const xVal = temperatureChart.posToVal(cssXInPlot, 'x');
        const idx = getIndexForTime(xVal / 60);

        if (idx >= 0 && rawTimestamps[idx]) {
            const time = formatTimeFromUnixSec(rawTimestamps[idx]);
            const { temp, color } = getClosestVisibleTempAtIndex(idx, cursorY);

            tooltip.innerHTML = '';
            const timeSpan = document.createElement('span');
            timeSpan.textContent = time;
            tooltip.appendChild(timeSpan);

            if (temp != null) {
                const bullet = document.createElement('span');
                bullet.textContent = ' • ';
                tooltip.appendChild(bullet);
                const tempSpan = document.createElement('span');
                tempSpan.textContent = temp.toFixed(2) + ' °C';
                tempSpan.style.color = color;
                tempSpan.style.fontWeight = 'bold';
                tooltip.appendChild(tempSpan);
            }

            tooltip.style.display = 'block';
            const cRect = container.getBoundingClientRect();
            let tx = e.clientX - cRect.left;
            const ty = Math.max(0, e.clientY - cRect.top - 50);
            const tw = tooltip.offsetWidth;
            tx = Math.max(tw / 2 + 4, Math.min(cRect.width - tw / 2 - 4, tx));
            tooltip.style.left = tx + 'px';
            tooltip.style.top  = ty + 'px';
        } else {
            tooltip.style.display = 'none';
        }

        if (markerA && !markerB) {
            updateMarkerBar(idx);
            updateStatsPanel(idx);
        }
        drawCrosshair();
    }

    function onMouseLeave() {
        cursorX = cursorY = -1;
        tooltip.style.display = 'none';
        if (markerA && !markerB) updateMarkerBar();
        drawCrosshair();
    }

    function onMouseDown(e) {
        mouseDown = true;
        const rect = container.getBoundingClientRect();
        mouseDownX = e.clientX - rect.left;
    }

    function onMouseUp(e) {
        const rect = container.getBoundingClientRect();
        mouseDownX -= (e.clientX - rect.left);
        mouseDown = false;
    }

    function onClick(e) {
        const now = Date.now();
        if (now - lastClickTime < 300) return;
        if (!temperatureChart || !rawTimestamps.length || Math.abs(mouseDownX) > 5) return;
        lastClickTime = now;

        const bb = getPlotBbox();
        if (!bb) return;
        const dpr = devicePixelRatio;
        const rect = container.getBoundingClientRect();
        const cssX = e.clientX - rect.left;
        const plotLeft = bb.left / dpr;
        const cssXInPlot = cssX - plotLeft;
        if (cssXInPlot < 0 || cssXInPlot > bb.width / dpr) return;
        const xVal = temperatureChart.posToVal(cssXInPlot, 'x');
        const idx = getIndexForTime(xVal / 60);
        if (idx < 0) return;

        if (markerA && markerB) {
            markerA = markerB = null;
        } else if (markerA && !markerB) {
            markerB = { labelIndex: idx };
        } else {
            markerA = { labelIndex: idx };
        }
        updateMarkerBar();
        updateStatsPanel();
        drawCrosshair();
    }

    function onContextMenu(e) {
        e.preventDefault();
        if (!markerA && !markerB) return;
        markerA = markerB = null;
        updateMarkerBar();
        updateStatsPanel();
        drawCrosshair();
    }

    // Attach to uPlot's over element (and re-attach after chart rebuild)
    overlay._attachOverlayListeners = function(over) {
        // Abort any previous set of listeners so re-loads don't stack them
        if (overlay._overAbortCtrl) overlay._overAbortCtrl.abort();
        overlay._overAbortCtrl = new AbortController();
        const signal = overlay._overAbortCtrl.signal;
        over.style.cursor = 'crosshair';
        over.addEventListener('mousemove',   onMouseMove,   { signal });
        over.addEventListener('mouseleave',  onMouseLeave,  { signal });
        over.addEventListener('mousedown',   onMouseDown,   { signal });
        over.addEventListener('mouseup',     onMouseUp,     { signal });
        over.addEventListener('click',       onClick,       { signal });
        over.addEventListener('contextmenu', onContextMenu, { signal });
    };

    // Clear markers button
    document.getElementById('clear-markers-btn')?.addEventListener('click', () => {
        markerA = markerB = null;
        updateMarkerBar();
        updateStatsPanel();
        drawCrosshair();
    });

    // Expose drawCrosshair so displayChart can trigger it from uPlot hooks
    overlay._drawCrosshair = drawCrosshair;
}

// ─── Dynamic X-axis marker spacing ────────────────────────────────────────
function cleanFloat(value) {
    return parseFloat(value.toPrecision(12));
}

// Time-aware nice intervals in minutes (sub-min → hour → day → week → month)
const NICE_TIME_INTERVALS = [
    1, 2, 5, 10, 15, 20, 30,
    60, 120, 180, 240, 360, 480, 720,
    1440, 2880, 4320, 7200, 10080,
    20160, 43200
];

function calcTimeStepSize(minTime, maxTime, pixelWidth) {
    const X_STEP_TARGET_PX = 100;
    const duration = maxTime - minTime;
    if (duration <= 0 || pixelWidth <= 0) return 1;
    const approxStep = duration / (pixelWidth / X_STEP_TARGET_PX);
    for (const interval of NICE_TIME_INTERVALS) {
        if (interval >= approxStep) return interval;
    }
    return NICE_TIME_INTERVALS[NICE_TIME_INTERVALS.length - 1];
}

function getPSTTime(label) {
    const date = new Date(label);
    if (isNaN(date)) return 0;
    return new Date(date.getTime() - (8 * 60 * 60 * 1000));
}

function getTimeInMinutes(label) {
    const date = new Date(label);
    if (isNaN(date)) return 0;
    return date.getTime() / 60000;
}

function getIndexForTime(minutes) {
    // Binary search: closest index in rawTimestamps (unix seconds) for a given minute value
    if (!rawTimestamps.length) return 0;
    const targetSec = minutes * 60;
    let lo = 0, hi = rawTimestamps.length - 1;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (rawTimestamps[mid] < targetSec) lo = mid + 1;
        else hi = mid;
    }
    if (lo > 0) {
        const dHi = Math.abs(rawTimestamps[lo]     - targetSec);
        const dLo = Math.abs(rawTimestamps[lo - 1] - targetSec);
        if (dLo < dHi) return lo - 1;
    }
    return lo;
}

function formatTimeLabel(minutesSinceEpoch, stepMinutes) {
    const date = new Date(minutesSinceEpoch * 60000);
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const month = MONTHS[date.getMonth()];
    const day   = date.getDate();
    let   hours = date.getHours();
    const ampm  = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;

    if (stepMinutes >= 1440) {
        // Day-level: "Mar 6"
        return `${month} ${day}`;
    } else if (stepMinutes >= 60) {
        // Hour-level: "Mar 6, 7AM"
        return `${month} ${day}, ${hours}${ampm}`;
    } else {
        // Minute-level: "Mar 6, 7:12AM"
        const mins = String(date.getMinutes()).padStart(2, '0');
        return `${month} ${day}, ${hours}:${mins}${ampm}`;
    }
}

function getXAxisTicks(minTime, maxTime, pixelWidth) {
    if (pixelWidth <= 0 || maxTime <= minTime) return [];
    const stepMinutes = calcTimeStepSize(minTime, maxTime, pixelWidth);
    const ticks = [];
    let stepPos = Math.ceil(cleanFloat(minTime / stepMinutes)) * stepMinutes;
    let iterCount = 0;
    while (iterCount++ < 2000) {
        if (stepPos > maxTime) break;
        ticks.push({ time: stepPos, label: formatTimeLabel(stepPos, stepMinutes) });
        stepPos = cleanFloat(stepPos + stepMinutes);
    }
    return ticks;
}

// ─── Chart creation ────────────────────────────────────────────────────────
async function displayChart(startDate, endDate) {
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.querySelector('.btn-text').textContent = 'Loading…';
    }

    const job = new FetchJob(startDate, endDate, apiUrl);
    await job.startFetchJob();

    try {
        await pollJobStatus(job, 800);
    } catch (err) {
        console.error('Merge job failed', err);
        const instructions = document.getElementById('instructions');
        if (instructions) {
            instructions.style.display = 'block';
            instructions.textContent = 'Failed to merge data: ' + (err.message || err);
        }
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.querySelector('.btn-text').textContent = 'Load Data';
        }
        return;
    }

    const { result: data } = await job.fetchResult();
    chartLabels = data.map(entry => entry["Date-Time"]);

    const { uplotData, meta, visible } = generateTankConfigs(data);

    // Snapshot visibility before destroying old chart
    if (temperatureChart) {
        savedVisibility = new Set(
            seriesMeta
                .filter((_, i) => seriesVisible[i])
                .map(m => m.label)
        );
        temperatureChart.destroy();
        temperatureChart = null;
    }

    // Store columnar data globally
    rawTimestamps = uplotData[0];          // Float64Array of unix seconds
    rawSeriesData = uplotData.slice(1);    // Float64Array[] per series
    seriesMeta    = meta;
    seriesVisible = visible;               // all false by default

    // Re-apply previous visibility
    if (savedVisibility !== null) {
        seriesMeta.forEach((m, i) => {
            if (savedVisibility.has(m.label)) seriesVisible[i] = true;
        });
    }

    // Reset markers on new data
    markerA = markerB = null;
    updateMarkerBar();

    // Hide empty state
    const emptyState = document.getElementById('empty-state');
    if (emptyState) emptyState.style.display = 'none';

    // X range: full data extent, also saved for reset-zoom
    _initXMin = rawTimestamps.length ? rawTimestamps[0] : 0;
    _initXMax = rawTimestamps.length ? rawTimestamps[rawTimestamps.length - 1] : 1;

    // ── Build uPlot series config ────────────────────────────────────────
    const uplotSeries = [
        // series[0] = x axis
        {
            label: 'Time',
            value: (u, v) => v == null ? '' : new Date(v * 1000).toLocaleString(),
        },
        // series[1..N] = y series
        ...seriesMeta.map((m, i) => (
            {
            label:    m.label,
            stroke:   m.stroke,
            // fill:     m.fill,
            width:    1.5,
            show:     seriesVisible[i],
            spanGaps: false,
            value:    (u, v) => v == null ? '' : v.toFixed(2) + ' °C',
            scale: "C",
        })),
    ];

    // ── Wheel-zoom + drag-pan plugin ─────────────────────────────────────
    function wheelZoomPanPlugin() {
        let xMinFull, xMaxFull;
        return {
            hooks: {
                ready(u) {
                    xMinFull = _initXMin;
                    xMaxFull = _initXMax;
                    const over = u.over;
                    const ac = new AbortController();
                    const signal = ac.signal;

                    // Drag pan (left-button drag)
                    let dragStartX = null, scaleMinAtDrag, scaleMaxAtDrag;
                    over.addEventListener('mousedown', e => {
                        if (e.button !== 0) return;
                        dragStartX     = e.clientX;
                        scaleMinAtDrag = u.scales.x.min;
                        scaleMaxAtDrag = u.scales.x.max;
                    }, { signal });
                    window.addEventListener('mousemove', e => {
                        if (dragStartX == null) return;
                        const dx = e.clientX - dragStartX;
                        const unitsPerPx = (scaleMaxAtDrag - scaleMinAtDrag) / u.bbox.width * devicePixelRatio;
                        let nMin = scaleMinAtDrag - dx * unitsPerPx;
                        let nMax = scaleMaxAtDrag - dx * unitsPerPx;
                        // clamp to full range
                        if (nMin < xMinFull) { nMax += xMinFull - nMin; nMin = xMinFull; }
                        if (nMax > xMaxFull) { nMin -= nMax - xMaxFull; nMax = xMaxFull; }
                        u.setScale('x', { min: nMin, max: nMax });
                        fitYAxis();
                        updateStatsPanel();
                        document.getElementById('overlay-canvas')?._drawCrosshair?.();
                    }, { signal });
                    window.addEventListener('mouseup', () => { dragStartX = null; }, { signal });

                    // Wheel zoom (x-only, centred on cursor)
                    over.addEventListener('wheel', e => {
                        e.preventDefault();
                        const factor = e.deltaY < 0 ? 0.8 : 1.25;
                        const { min, max } = u.scales.x;
                        const range = max - min;
                        const leftPct = u.cursor.left / (u.bbox.width / devicePixelRatio);
                        const xFocus  = min + leftPct * range;
                        let nMin = xFocus - leftPct * range * factor;
                        let nMax = nMin + range * factor;
                        // clamp
                        if (nMin < xMinFull) { nMax += xMinFull - nMin; nMin = xMinFull; }
                        if (nMax > xMaxFull) { nMin -= nMax - xMaxFull; nMax = xMaxFull; }
                        nMin = Math.max(nMin, xMinFull);
                        nMax = Math.min(nMax, xMaxFull);
                        u.setScale('x', { min: nMin, max: nMax });
                        fitYAxis();
                        updateStatsPanel();
                        document.getElementById('overlay-canvas')?._drawCrosshair?.();
                    }, { passive: false, signal });

                    // Clean up when uPlot is destroyed
                    u.hooks.destroy = u.hooks.destroy || [];
                    u.hooks.destroy.push(() => ac.abort());
                },
            },
        };
    }

    // ── Mount point: uPlot mounts into #uplot-container ──────────────────
    const mountEl = document.getElementById('uplot-container');
    mountEl.innerHTML = '';   // clear any previous instance

    const containerEl = document.getElementById('chart-container');
    const w = containerEl.clientWidth;
    const h = containerEl.clientHeight;

    const opts = {
        width:  w,
        height: h,
        legend: { show: false },
        cursor: {
            show:  true,
            drag:  { setScale: false, x: false, y: false }, // we handle drag ourselves
            // sync:  { key: null },
            // points: { show: false },
        },
        series: uplotSeries,
        axes: [
            // x-axis
            {
                stroke:  '#555d75',
                grid:    { stroke: 'rgba(255,255,255,0.04)', width: 1 },
                ticks:   { stroke: 'rgba(255,255,255,0.04)', width: 1 },
                font:    '11px Inter, system-ui, sans-serif',
                // Custom label formatter: uPlot passes unix-seconds
                values: (u, splits) => {
                    const rangeS = u.scales.x.max - u.scales.x.min;
                    const rangeMin = rangeS / 60;
                    const pixW = u.bbox.width / devicePixelRatio;
                    const stepMin = calcTimeStepSize(u.scales.x.min / 60, u.scales.x.max / 60, pixW);
                    return splits.map(s => formatTimeLabel(s / 60, stepMin));
                },
                // Use our nice-interval splitter (uPlot splits are unix-seconds)
                splits: (u, axisIdx, scaleMin, scaleMax) => {
                    const pixW = u.bbox.width / devicePixelRatio;
                    const ticks = getXAxisTicks(scaleMin / 60, scaleMax / 60, pixW);
                    return ticks.map(t => t.time * 60);
                },
                size: 40,
                gap:  6,
            },
            // y-axis
            // {
            //     stroke:  '#555d75',
            //     grid:    { stroke: 'rgba(255,255,255,0.04)', width: 1 },
            //     ticks:   { stroke: 'rgba(255,255,255,0.04)', width: 1 },
            //     font:    '11px Inter, system-ui, sans-serif',
            //     values:  (u, splits) => splits.map(v => v == null ? '' : v.toFixed(1) + ' °C'),
            //     size:    55,
            //     gap:     6,
            // },
            {
                scale: "C",
                values: (self, ticks) => ticks.map(rawValue => rawValue + "° C"),
                grid: {show: false},
                stroke:  '#555d75',
                grid:    { stroke: 'rgba(255,255,255,0.04)', width: 1 },
                ticks:   { stroke: 'rgba(255,255,255,0.04)', width: 1 },
                font:    '11px Inter, system-ui, sans-serif',
                size:    (self, values, axisIdx, cycleNum) => {
                    // On the initial call uPlot passes values=null; measure a worst-case
                    // label so the axis slot is large enough from the very first layout pass.
                    const probe = values?.length ? values : ['-99.999° C'];
                    const tc = _yAxisMeasureCtx ??= document.createElement('canvas').getContext('2d');
                    tc.font = '11px Inter, system-ui, sans-serif';
                    const maxW = probe.reduce((m, v) => Math.max(m, v ? tc.measureText(String(v)).width : 0), 0);
                    return Math.ceil(maxW) + 16;
                },
                gap:     6,
            },
            {
                scale: "F",
                values: (self, ticks) => ticks.map(rawValue => rawValue + "° F"),
                stroke:  '#555d75',
                grid: {show: false},
                font:    '11px Inter, system-ui, sans-serif',
                size:    (self, values, axisIdx, cycleNum) => {
                    const probe = values?.length ? values : ['-199.9° F'];
                    const tc = _yAxisMeasureCtx ??= document.createElement('canvas').getContext('2d');
                    tc.font = '11px Inter, system-ui, sans-serif';
                    const maxW = probe.reduce((m, v) => Math.max(m, v ? tc.measureText(String(v)).width : 0), 0);
                    return Math.ceil(maxW) + 16;
                },
                gap:     6,
                side: 1, // right side
            },
        ],
        scales: {
            x: { time: true, auto: false, min: _initXMin, max: _initXMax },
            y: { auto: false },
            "F": {
                from: "C",
                range: (self, fromMin, fromMax) => [
                    (fromMin * 9/5) + 32,
                    (fromMax * 9/5) + 32,
                ],
            }
        },
        plugins: [ wheelZoomPanPlugin() ],
        hooks: {
            draw: [
                u => {
                    const overlay = document.getElementById('overlay-canvas');
                    overlay?._drawCrosshair?.();
                },
            ],
        },
    };

    temperatureChart = new uPlot(opts, uplotData, mountEl);

    // Resize uPlot when chart-container resizes
    new ResizeObserver(() => {
        if (!temperatureChart) return;
        const cw = containerEl.clientWidth;
        const ch = containerEl.clientHeight;
        temperatureChart.setSize({ width: cw, height: ch });
    }).observe(containerEl);

    // Set up overlay (once per page load; idempotent after first call)
    const overlay = document.getElementById('overlay-canvas');
    if (!overlay._drawCrosshair) setupOverlay();

    // Wire overlay mouse listeners to the new uPlot .u-over element
    overlay._attachOverlayListeners(temperatureChart.over);

    fitYAxis();
    updateCustomLegend();
    updateStatsPanel();

    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.querySelector('.btn-text').textContent = 'Load Data';
    }
}

function fitYAxis() {
    if (!temperatureChart || _fittingY) return;
    const xMin = temperatureChart.scales.x.min;
    const xMax = temperatureChart.scales.x.max;
    if (!rawTimestamps.length) return;

    const DEFAULT_MIN = -1, DEFAULT_MAX = 1;
    const EPSILON = 1e-9, RANGE_PAD = 1;

    // xScale min/max are unix seconds; getIndexForTime uses minutes
    const minIdx = Math.max(0, getIndexForTime(xMin / 60));
    const maxIdx = Math.min(rawTimestamps.length - 1, getIndexForTime(xMax / 60));
    if (minIdx > maxIdx) return;

    let globalMin = Infinity, globalMax = -Infinity;

    rawSeriesData.forEach((yArr, i) => {
        if (!seriesVisible[i]) return;
        for (let k = minIdx; k <= maxIdx; k++) {
            const v = yArr[k];
            if (v == null || isNaN(v)) continue;
            if (v < globalMin) globalMin = v;
            if (v > globalMax) globalMax = v;
        }
    });

    if (!isFinite(globalMin) || !isFinite(globalMax)) {
        globalMin = DEFAULT_MIN;
        globalMax = DEFAULT_MAX;
    }

    if (nearlyEqual(globalMin, globalMax, EPSILON)) {
        globalMin -= RANGE_PAD;
        globalMax += RANGE_PAD;
    }

    const margin = (globalMax - globalMin) * 0.05;
    let newMin = globalMin - margin;
    let newMax = globalMax + margin;

    if (nearlyEqual(newMin, newMax, EPSILON)) {
        newMin -= RANGE_PAD;
        newMax += RANGE_PAD;
    }

    newMin = Math.round(newMin * 100) / 100;
    newMax = Math.round(newMax * 100) / 100;

    // Rounding can collapse a tight range to newMin === newMax; re-pad if so.
    if (newMin >= newMax) {
        newMin -= RANGE_PAD;
        newMax += RANGE_PAD;
    }

    const oldMin = temperatureChart.scales.y?.min;
    const oldMax = temperatureChart.scales.y?.max;
    if (nearlyEqual(oldMin ?? NaN, newMin, EPSILON) && nearlyEqual(oldMax ?? NaN, newMax, EPSILON)) return;

    _fittingY = true;
    try {
        temperatureChart.setScale('y', { min: newMin, max: newMax });
    } finally {
        _fittingY = false;
    }
}

// ─── Progress bar ──────────────────────────────────────────────────────────
async function pollJobStatus(fetchJob, interval = 800) {
    const chartContainer = document.getElementById('chart-container');

    let container = document.getElementById('merge-progress-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'merge-progress-container';
        const bar = document.createElement('div');
        bar.id = 'merge-progress-bar';
        container.appendChild(bar);
        chartContainer.appendChild(container);
    }

    const progressBar = document.getElementById('merge-progress-bar');

    return new Promise((resolve, reject) => {
        const poll = async () => {
            try {
                const statusObj = await fetchJob.getStatus();
                const progress = typeof statusObj.progress === 'number' ? statusObj.progress : 0;
                progressBar.style.width = Math.min(100, progress) + '%';

                if (statusObj.status === 'complete') {
                    progressBar.style.width = '100%';
                    setTimeout(() => {
                        container.remove();
                        resolve();
                    }, 300);
                    return;
                }
                if (statusObj.status === 'failed') {
                    container.remove();
                    return reject(new Error(statusObj.error || 'Job failed'));
                }
                setTimeout(poll, interval);
            } catch (err) {
                console.warn('pollJobStatus error, retrying', err);
                setTimeout(poll, interval);
            }
        };
        poll();
    });
}

// ─── Reset zoom button ─────────────────────────────────────────────────────
document.getElementById('reset-zoom-btn')?.addEventListener('click', () => {
    if (!temperatureChart) return;
    temperatureChart.setScale('x', { min: _initXMin, max: _initXMax });
    fitYAxis();
});

// ─── Form submit ───────────────────────────────────────────────────────────
document.getElementById('dateForm').addEventListener('submit', function(event) {
    event.preventDefault();
    const startDate  = document.getElementById('startDate').value;
    const endDate    = document.getElementById('endDate').value;
    const instructions = document.getElementById('instructions');
    const today = new Date().toISOString().split('T')[0];

    if (endDate > today) {
        instructions.style.display = 'block';
        instructions.textContent = 'End date cannot be later than today.';
        return;
    }
    if (endDate < startDate) {
        instructions.style.display = 'block';
        instructions.textContent = 'End date must be after the start date.';
        return;
    }
    instructions.style.display = 'none';
    displayChart(startDate, endDate);
});

// Auto-fill end date when start date first set
document.getElementById('startDate').addEventListener('change', function() {
    const endInput = document.getElementById('endDate');
    if (!endInput.value) endInput.value = this.value;
});
