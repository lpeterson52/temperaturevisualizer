import FetchJob from './fetchJob.js'

const DEBUG = true;
const backendUrl = "https://temperaturevisualizer.onrender.com/";
const apiUrl = DEBUG ? "http://localhost:8000/api" : backendUrl + "api";

// ─── Global state ──────────────────────────────────────────────────────────
let temperatureChart = null;
let chartLabels = [];          // raw label strings from data
let markerA = null;            // { labelIndex, x (canvas px) }
let markerB = null;

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

function generateTankConfigs(data) {
    const configs = [];
    const letters = ['A', 'B', 'C', 'D'];
    const states  = ['Warm', 'Cool'];
    let ci = 0;
    for (const letter of letters) {
        for (let i = 1; i <= 4; i++) {
            for (const state of states) {
                configs.push({
                    label: `Tank ${letter}${i} ${state} (°C)`,
                    data: data.map(entry => ({ x: getTimeInMinutes(entry["Date-Time"]), y: entry[`Tank ${letter}${i} ${state} (C)`] ?? null })),
                    borderColor: colorPairs[ci][0],
                    backgroundColor: colorPairs[ci][1],
                    borderWidth: 1.5,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    fill: false,
                    tension: 0.1,
                    hidden: true
                });
                ci++;
            }
        }
    }
    return configs;
}

// ─── Custom Legend ─────────────────────────────────────────────────────────
function updateCustomLegend(chart) {
    const container = document.getElementById('custom-legend');
    if (!container) return;
    container.innerHTML = '';
    chart.data.datasets.forEach((ds, i) => {
        const visible = chart.isDatasetVisible(i);
        const item = document.createElement('div');
        item.className = 'legend-item' + (visible ? ' active' : '');

        const box = document.createElement('span');
        box.style.cssText = `
            display:inline-block;width:12px;height:12px;flex-shrink:0;
            background:${ds.borderColor};border-radius:3px;
            opacity:${visible ? 1 : 0.3};
        `;

        const label = document.createElement('span');
        label.textContent = ds.label;
        label.style.opacity = visible ? '1' : '0.4';

        item.appendChild(box);
        item.appendChild(label);
        item.onclick = () => {
            chart.setDatasetVisibility(i, !chart.isDatasetVisible(i));
            updateCustomLegend(chart);
            updateMarkerBar();
            fitYAxis(chart);
        };
        container.appendChild(item);
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

function updateMarkerBar(pendingBIdx = -1) {
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
        timeSpan.textContent = formatTimeLabel(getTimeInMinutes(chartLabels[marker.labelIndex]), 1);
        header.appendChild(timeSpan);
        section.appendChild(header);

        if (temperatureChart) {
            const valuesDiv = document.createElement('div');
            valuesDiv.className = 'marker-values';
            temperatureChart.data.datasets.forEach((ds, i) => {
                if (!temperatureChart.isDatasetVisible(i)) return;
                const v = ds.data[marker.labelIndex]?.y;
                if (v == null) return;
                const chip = document.createElement('span');
                chip.className = 'marker-chip';
                chip.style.color = ds.borderColor;
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
    } else if (pendingBIdx >= 0 && chartLabels[pendingBIdx]) {
        content.appendChild(buildMarkerSection({ labelIndex: pendingBIdx }, 'marker-b', true));
        const deltaEl = document.createElement('div');
        deltaEl.className = 'marker-info marker-delta';
        deltaEl.style.opacity = '0.5';
        deltaEl.innerHTML = `<span>Δt: </span><span>${deltaString(
            chartLabels[markerA.labelIndex],
            chartLabels[pendingBIdx]
        )}</span>`;
        content.appendChild(deltaEl);
    }
}

// ─── Overlay canvas (crosshair + markers) ─────────────────────────────────
function setupOverlay(chart) {
    const overlay = document.getElementById('overlay-canvas');
    const container = document.getElementById('chart-container');
    if (!overlay || !container) return;

    // Size overlay to match chart canvas
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

    function getLabelIndexAt(chartInstance, canvasX) {
        const xScale = chartInstance.scales.x;
        if (!xScale) return -1;
        const { left, right } = xScale;
        if (canvasX < left || canvasX > right) return -1;
        const minutes = xScale.getValueForPixel(canvasX);
        return getIndexForTime(minutes);
    }

    function getCanvasXForIndex(chartInstance, idx) {
        const xScale = chartInstance.scales.x;
        if (!xScale || !chartLabels.length) return -1;
        const minutes = getTimeInMinutes(chartLabels[idx]);
        return xScale.getPixelForValue(minutes);
    }

    function drawMarkerLine(ctx, x, color, side = 'right') {
        if (!temperatureChart?.scales?.y) return;
        const { top, bottom } = temperatureChart.scales.y;
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

        const xScale = temperatureChart.scales.x;
        const yScale = temperatureChart.scales.y;
        if (!xScale || !yScale) return;
        const { top, bottom } = yScale;
        const regionH = bottom - top;

        // Preview fill: A placed, B not yet, cursor in chart area
        if (markerA && !markerB && cursorX >= xScale.left && cursorX <= xScale.right) {
            const ax = getCanvasXForIndex(temperatureChart, markerA.labelIndex);
            if (ax >= 0) {
                ctx.save();
                ctx.fillStyle = 'rgba(150,200,255,0.10)';
                ctx.fillRect(Math.min(ax, cursorX), top, Math.abs(cursorX - ax), regionH);
                ctx.restore();
            }
        }

        // Solid region between both placed markers
        if (markerA && markerB) {
            const ax = getCanvasXForIndex(temperatureChart, markerA.labelIndex);
            const bx = getCanvasXForIndex(temperatureChart, markerB.labelIndex);
            if (ax >= 0 && bx >= 0) {
                ctx.save();
                ctx.fillStyle = 'rgba(79,142,247,0.06)';
                ctx.fillRect(Math.min(ax, bx), top, Math.abs(bx - ax), regionH);
                ctx.restore();
            }
        }

        // Draw marker lines on top of fills
        if (markerA) {
            const ax = getCanvasXForIndex(temperatureChart, markerA.labelIndex);
            if (ax >= 0) drawMarkerLine(ctx, ax, '#f5c518', 'right');
        }
        if (markerB) {
            const bx = getCanvasXForIndex(temperatureChart, markerB.labelIndex);
            if (bx >= 0) drawMarkerLine(ctx, bx, '#4fc3f7', 'left');
        }

        // Crosshair
        if (cursorX < 0 || cursorX < xScale.left || cursorX > xScale.right) return;
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

    // Mouse events on the chart canvas (pointer-events enabled there)
    const chartCanvas = document.getElementById('temperatureChart');
    chartCanvas.style.cursor = 'crosshair';

    function extractTimeFromLabel(label) {
        // Parse label to extract time in HH:MM AM/PM format
        // Assume label format is "YYYY-MM-DD HH:MM" or similar ISO-like format
        const date = new Date(label);
        if (isNaN(date)) return label; // fallback if parsing fails
        
        let hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        return `${hours}:${minutes} ${ampm}`;
    }

    function getClosestVisibleTempAtIndex(idx, canvasY) {
        // Get the temperature and color from the visible dataset whose canvas position is closest to canvasY
        const yScale = temperatureChart.scales.y;
        if (!yScale) return { temp: null, color: null };

        let closestDatasetIndex = -1;
        let closestDistance = Infinity;

        for (let i = 0; i < temperatureChart.data.datasets.length; i++) {
            if (!temperatureChart.isDatasetVisible(i)) continue;
            
            const data = temperatureChart.data.datasets[i].data;
            if (data[idx]?.y == null) continue;

            const tempValue = data[idx].y;
            // Convert temperature value to canvas Y coordinate
            const datasetCanvasY = yScale.getPixelForValue(tempValue);
            const distance = Math.abs(canvasY - datasetCanvasY);

            if (distance < closestDistance) {
                closestDistance = distance;
                closestDatasetIndex = i;
            }
        }

        if (closestDatasetIndex >= 0) {
            const dataset = temperatureChart.data.datasets[closestDatasetIndex];
            return {
                temp: dataset.data[idx].y,
                color: dataset.borderColor
            };
        }
        return { temp: null, color: null };
    }

    chartCanvas.addEventListener('mousemove', (e) => {
        if (!temperatureChart) return;
        const rect = chartCanvas.getBoundingClientRect();
        cursorX = (e.clientX - rect.left) * (chartCanvas.width  / rect.width);
        cursorY = (e.clientY - rect.top)  * (chartCanvas.height / rect.height);

        const idx = getLabelIndexAt(temperatureChart, cursorX);

        if (idx >= 0 && chartLabels[idx]) {
            const time = extractTimeFromLabel(chartLabels[idx]);
            const { temp, color } = getClosestVisibleTempAtIndex(idx, cursorY);
            
            // Clear tooltip and rebuild with colored temp
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
            // position relative to container
            const cRect = container.getBoundingClientRect();
            let tx = e.clientX - cRect.left;
            const ty = Math.max(0, e.clientY - cRect.top - 50);
            // clamp so tooltip stays inside
            const tw = tooltip.offsetWidth;
            tx = Math.max(tw / 2 + 4, Math.min(cRect.width - tw / 2 - 4, tx));
            tooltip.style.left = tx + 'px';
            tooltip.style.top  = ty + 'px';
        } else {
            tooltip.style.display = 'none';
        }

        if (markerA && !markerB) updateMarkerBar(idx);
        drawCrosshair();
    });

    chartCanvas.addEventListener('mouseleave', () => {
        cursorX = cursorY = -1;
        tooltip.style.display = 'none';
        if (markerA && !markerB) updateMarkerBar();
        drawCrosshair();
    });

    let mouseDown = false;
    let mouseX = 0;

    chartCanvas.addEventListener('mousedown', (e) => {
        mouseDown = true;
        const rect = chartCanvas.getBoundingClientRect();
        mouseX = (e.clientX - rect.left) * (chartCanvas.width / rect.width);
    });

    chartCanvas.addEventListener('mouseup', (e) => {
        mouseDown = false;
        const rect = chartCanvas.getBoundingClientRect();
        mouseX -= (e.clientX - rect.left) * (chartCanvas.width / rect.width);
    });

    chartCanvas.addEventListener('click', (e) => {
        if (!temperatureChart || !chartLabels.length || mouseDown || Math.abs(mouseX) > 5) return;
        const rect = chartCanvas.getBoundingClientRect();
        const cx = (e.clientX - rect.left) * (chartCanvas.width / rect.width);
        const idx = getLabelIndexAt(temperatureChart, cx);
        if (idx < 0) return;

        if (markerA && markerB) {
            // Both placed: clear both
            markerA = markerB = null;
        } else if (markerA) {
            // Place second marker
            markerB = { labelIndex: idx };
        } else {
            // Place first marker
            markerA = { labelIndex: idx };
        }
        updateMarkerBar();
        drawCrosshair();
    });

    chartCanvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (!markerA && !markerB) return;
        markerA = markerB = null;
        updateMarkerBar();
        drawCrosshair();
    });

    // Also redraw overlay when chart updates (zoom/pan)
    const origDraw = chart.draw.bind(chart);
    chart.draw = function(...args) {
        origDraw(...args);
        drawCrosshair();
    };

    // Clear markers button
    document.getElementById('clear-markers-btn')?.addEventListener('click', () => {
        markerA = markerB = null;
        updateMarkerBar();
        drawCrosshair();
    });
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
    // Binary search: closest index in chartLabels for a given minute value
    if (!chartLabels.length) return 0;
    let lo = 0, hi = chartLabels.length - 1;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (getTimeInMinutes(chartLabels[mid]) < minutes) lo = mid + 1;
        else hi = mid;
    }
    if (lo > 0) {
        const dHi  = Math.abs(getTimeInMinutes(chartLabels[lo])     - minutes);
        const dLo  = Math.abs(getTimeInMinutes(chartLabels[lo - 1]) - minutes);
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
    const tankConfigs = generateTankConfigs(data);

    const ctx = document.getElementById('temperatureChart').getContext('2d');
    if (temperatureChart) {
        temperatureChart.destroy();
        temperatureChart = null;
    }

    // Reset markers on new data
    markerA = markerB = null;
    updateMarkerBar();

    // Hide empty state
    const emptyState = document.getElementById('empty-state');
    if (emptyState) emptyState.style.display = 'none';

    // Use the form date range as the initial visible window (end date = end of that day)
    const xFormMin = getTimeInMinutes(getPSTTime(startDate));
    const xFormMax = getTimeInMinutes(getPSTTime(endDate)) + 24 * 60; // include the full end day

    const xMin = chartLabels.length ? getTimeInMinutes(chartLabels[0]) : xFormMin;
    const xMax = chartLabels.length ? getTimeInMinutes(chartLabels[chartLabels.length - 1]) : xFormMax;

    temperatureChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: tankConfigs
        },
        options: {
            animation: false,
            responsive: true,
            maintainAspectRatio: false,
            parsing: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                zoom: {
                    limits: {
                        x: { min: xMin, max: xMax },
                    },
                    pan: {
                        enabled: true,
                        mode: 'x',
                        threshold: 10,
                        onPan: ({ chart }) => fitYAxis(chart),
                        onPanComplete: ({ chart }) => fitYAxis(chart),
                    },
                    zoom: {
                        wheel: {
                            enabled: true,
                            speed: 0.1,
                        },
                        pinch: {
                            enabled: true,
                        },
                        mode: 'x',
                        onZoom: ({ chart }) => fitYAxis(chart),
                        onZoomComplete: ({ chart }) => fitYAxis(chart),
                    },
                },
                legend: { display: false },
                title: { display: false },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(26,29,39,0.95)',
                    borderColor: 'rgba(255,255,255,0.08)',
                    borderWidth: 1,
                    titleColor: '#eaedf4',
                    bodyColor: '#8b92a8',
                    padding: 10,
                    filter: item => !item.dataset.hidden,
                    callbacks: {
                        label: ctx => {
                            const val = ctx.raw?.y;
                            return val != null ? `  ${ctx.dataset.label.replace(' (°C)','')}  ${val.toFixed(2)} °C` : null;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    min: xMin,
                    max: xMax,
                    // Replace Chart.js auto-ticks with our exact time-aligned ticks
                    afterBuildTicks: function(scale) {
                        const pixelWidth = scale.right - scale.left;
                        if (pixelWidth <= 0 || !chartLabels.length) return;
                        const axisTicks = getXAxisTicks(scale.min, scale.max, pixelWidth);
                        scale.ticks = axisTicks.map(t => ({ value: t.time }));
                    },
                    ticks: {
                        color: '#555d75',
                        maxRotation: 0,
                        font: { size: 11 },
                        // 'this' is the scale; value is minutes since epoch
                        callback: function(value) {
                            const stepSize = calcTimeStepSize(this.min, this.max, this.right - this.left);
                            return formatTimeLabel(value, stepSize);
                        }
                    },
                    grid: {
                        color: 'rgba(255,255,255,0.04)'
                    }
                },
                y: {
                    ticks: {
                        color: '#555d75',
                        font: { size: 11 },
                        callback: v => (Math.round(v * 100) / 100) + ' °C'
                    },
                    grid: {
                        color: 'rgba(255,255,255,0.04)'
                    }
                }
            },
            onHover: null  // don't fight with our overlay
        }
    });

    // Sync checkboxes → visibility
    const letters = ['A', 'B', 'C', 'D'];
    const states  = ['warm', 'cool'];
    let di = 0;
    for (const letter of letters) {
        for (let i = 1; i <= 4; i++) {
            for (const state of states) {
                const cb = document.getElementById('tank' + letter + i + state);
                if (cb) temperatureChart.data.datasets[di].hidden = !cb.checked;
                di++;
            }
        }
    }
    temperatureChart.update('none');
    updateCustomLegend(temperatureChart);
    setupOverlay(temperatureChart);
    fitYAxis(temperatureChart);

    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.querySelector('.btn-text').textContent = 'Load Data';
    }
}

function fitYAxis(chart) {
    if (!chart?.scales) return;
    const xScale = chart.scales.x;
    const yScale = chart.scales.y;
    if (!xScale || !yScale || !chartLabels.length) return;

    const DEFAULT_MIN = -1, DEFAULT_MAX = 1;
    const EPSILON = 1e-9, RANGE_PAD = 1;

    // xScale.min/max are in minutes; convert to data indices
    const minIdx = Math.max(0, getIndexForTime(xScale.min));
    const maxIdx = Math.min(chartLabels.length - 1, getIndexForTime(xScale.max));
    if (minIdx > maxIdx) return;

    const d = chart.data.datasets.length;
    let globalMin = Infinity, globalMax = -Infinity;

    for (let i = 0; i < d; i++) {
        if (!chart.isDatasetVisible(i)) continue;
        const src = chart.data.datasets[i].data;
        for (let k = minIdx; k <= maxIdx; k++) {
            const v = src[k]?.y;
            if (v == null || v !== v) continue; // null or NaN
            if (v < globalMin) globalMin = v;
            if (v > globalMax) globalMax = v;
        }
    }

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

    const yOpts = chart.options.scales.y;
    const oldMin = typeof yOpts.min === 'number' ? yOpts.min : NaN;
    const oldMax = typeof yOpts.max === 'number' ? yOpts.max : NaN;
    if (nearlyEqual(oldMin, newMin, EPSILON) && nearlyEqual(oldMax, newMax, EPSILON)) return;

    yOpts.min = Math.round(newMin * 100) / 100;
    yOpts.max = Math.round(newMax * 100) / 100;
    chart.update('none');
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
    temperatureChart.resetZoom();
    // clear manual y bounds so fitYAxis can recalculate
    delete temperatureChart.options.scales.y.min;
    delete temperatureChart.options.scales.y.max;
    fitYAxis(temperatureChart);
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
