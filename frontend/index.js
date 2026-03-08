import FetchJob from './fetchJob.js'

const DEBUG = true;
const backendUrl = "https://temperaturevisualizer.onrender.com/";
const apiUrl = DEBUG ? "http://localhost:8000/api" : backendUrl + "api";

// ─── Global state ──────────────────────────────────────────────────────────
let temperatureChart = null;
let chartLabels = [];          // raw label strings from data
let markerA = null;            // { labelIndex, x (canvas px) }
let markerB = null;

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
                    data: data.map(entry => entry[`Tank ${letter}${i} ${state} (C)`]),
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
            chart.update('none');
            updateCustomLegend(chart);
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

function updateMarkerBar() {
    const bar = document.getElementById('marker-bar');
    if (!markerA) {
        if (bar) bar.style.display = 'none';
        return;
    }
    if (bar) bar.style.display = 'flex';

    const aLabel = document.getElementById('marker-a-label');
    const bLabel = document.getElementById('marker-b-label');
    const bInfo  = document.getElementById('marker-b-info');
    const deltaEl = document.getElementById('marker-delta');
    const deltaLabel = document.getElementById('marker-delta-label');

    if (aLabel) aLabel.textContent = `Marker A: ${formatLabel(chartLabels[markerA.labelIndex])}`;
    if (bInfo)  bInfo.style.display  = markerB ? 'flex' : 'none';
    if (deltaEl) deltaEl.style.display = markerB ? 'flex' : 'none';

    if (markerB && bLabel) {
        bLabel.textContent = `Marker B: ${formatLabel(chartLabels[markerB.labelIndex])}`;
    }
    if (markerB && deltaLabel) {
        deltaLabel.textContent = deltaString(
            chartLabels[markerA.labelIndex],
            chartLabels[markerB.labelIndex]
        );
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
        const ratio = (canvasX - left) / (right - left);
        const idx   = Math.round(ratio * (chartLabels.length - 1));
        return Math.max(0, Math.min(chartLabels.length - 1, idx));
    }

    function getCanvasXForIndex(chartInstance, idx) {
        const xScale = chartInstance.scales.x;
        if (!xScale || !chartLabels.length) return -1;
        const { left, right } = xScale;
        return left + (idx / (chartLabels.length - 1)) * (right - left);
    }

    function drawMarkerLine(ctx, x, color, label, side = 'right') {
        const h = overlay.height;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
        // small flag
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
        ctx.fillStyle = color;
        const fW = 8, fH = 8;
        const fx = side === 'right' ? x : x - fW;
        ctx.fillRect(fx, 0, fW, fH);
        ctx.restore();
    }

    function drawCrosshair() {
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        if (!temperatureChart) return;

        // Draw existing markers first
        if (markerA) {
            const ax = getCanvasXForIndex(temperatureChart, markerA.labelIndex);
            if (ax >= 0) drawMarkerLine(ctx, ax, '#f5c518', 'A', 'right');
        }
        if (markerB) {
            const bx = getCanvasXForIndex(temperatureChart, markerB.labelIndex);
            if (bx >= 0) drawMarkerLine(ctx, bx, '#4fc3f7', 'B', 'left');
            // Shade region between markers
            if (markerA) {
                const ax = getCanvasXForIndex(temperatureChart, markerA.labelIndex);
                const bx2 = getCanvasXForIndex(temperatureChart, markerB.labelIndex);
                if (ax >= 0 && bx2 >= 0) {
                    ctx.save();
                    ctx.fillStyle = 'rgba(79,142,247,0.06)';
                    ctx.fillRect(Math.min(ax, bx2), 0, Math.abs(bx2 - ax), overlay.height);
                    ctx.restore();
                }
            }
        }

        // Crosshair
        if (cursorX < 0) return;
        const xScale = temperatureChart.scales.x;
        const yScale = temperatureChart.scales.y;
        if (!xScale || !yScale) return;
        if (cursorX < xScale.left || cursorX > xScale.right) return;

        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        // vertical line
        ctx.beginPath();
        ctx.moveTo(cursorX, yScale.top);
        ctx.lineTo(cursorX, yScale.bottom);
        ctx.stroke();
        ctx.restore();
    }

    // Mouse events on the chart canvas (pointer-events enabled there)
    const chartCanvas = document.getElementById('temperatureChart');
    chartCanvas.style.cursor = 'crosshair';

    chartCanvas.addEventListener('mousemove', (e) => {
        if (!temperatureChart) return;
        const rect = chartCanvas.getBoundingClientRect();
        cursorX = (e.clientX - rect.left) * (chartCanvas.width  / rect.width);
        cursorY = (e.clientY - rect.top)  * (chartCanvas.height / rect.height);

        const idx = getLabelIndexAt(temperatureChart, cursorX);

        if (idx >= 0 && chartLabels[idx]) {
            tooltip.textContent = chartLabels[idx];
            tooltip.style.display = 'block';
            // position relative to container
            const cRect = container.getBoundingClientRect();
            let tx = e.clientX - cRect.left;
            const ty = e.clientY - cRect.top - 32;
            // clamp so tooltip stays inside
            const tw = tooltip.offsetWidth;
            tx = Math.max(tw / 2 + 4, Math.min(cRect.width - tw / 2 - 4, tx));
            tooltip.style.left = tx + 'px';
            tooltip.style.top  = ty + 'px';
        } else {
            tooltip.style.display = 'none';
        }

        drawCrosshair();
    });

    chartCanvas.addEventListener('mouseleave', () => {
        cursorX = cursorY = -1;
        tooltip.style.display = 'none';
        drawCrosshair();
    });

    chartCanvas.addEventListener('click', (e) => {
        if (!temperatureChart || !chartLabels.length) return;
        const rect = chartCanvas.getBoundingClientRect();
        const cx = (e.clientX - rect.left) * (chartCanvas.width  / rect.width);
        const idx = getLabelIndexAt(temperatureChart, cx);
        if (idx < 0) return;

        if (!markerA) {
            markerA = { labelIndex: idx };
        } else if (!markerB) {
            markerB = { labelIndex: idx };
        } else {
            // cycle: replace A with B, set B to new click
            markerA = markerB;
            markerB = { labelIndex: idx };
        }
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

    temperatureChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartLabels,
            datasets: tankConfigs
        },
        options: {
            animation: false,
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'x',
                        modifierKey: null, // left-click drag (no modifier needed)
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
                        onZoom({ chart }) {
                            // y-axis auto-scales to visible data range
                            autoScaleY(chart);
                        },
                    },
                    onPan({ chart }) {
                        autoScaleY(chart);
                    }
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
                            const val = ctx.parsed.y;
                            return val != null ? `  ${ctx.dataset.label.replace(' (°C)','')}  ${val.toFixed(2)} °C` : null;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: '#555d75',
                        maxRotation: 0,
                        maxTicksLimit: 10,
                        font: { size: 11 }
                    },
                    grid: {
                        color: 'rgba(255,255,255,0.04)'
                    }
                },
                y: {
                    ticks: {
                        color: '#555d75',
                        font: { size: 11 },
                        callback: v => v + ' °C'
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

    // Pan → also auto-scale y
    const origUpdate = temperatureChart.update.bind(temperatureChart);
    temperatureChart.update = function(mode, ...rest) {
        origUpdate(mode, ...rest);
    };

    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.querySelector('.btn-text').textContent = 'Load Data';
    }
}

// Auto-scale Y to visible data range after zoom/pan
function autoScaleY(chart) {
    const xScale = chart.scales.x;
    if (!xScale) return;
    const minIdx = Math.max(0, Math.floor(xScale.min));
    const maxIdx = Math.min(chartLabels.length - 1, Math.ceil(xScale.max));

    let globalMin = Infinity, globalMax = -Infinity;
    chart.data.datasets.forEach((ds, i) => {
        if (!chart.isDatasetVisible(i)) return;
        for (let k = minIdx; k <= maxIdx; k++) {
            const v = Math.round(ds.data[k]);
            if (v == null) continue;
            if (v < globalMin) globalMin = v;
            if (v > globalMax) globalMax = v;
        }
    });
    if (globalMin === Infinity) return;
    const pad = (globalMax - globalMin) * 0.05 || 1;
    chart.options.scales.y.min = globalMin - pad;
    chart.options.scales.y.max = globalMax + pad;
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
    // clear manual y bounds so chart auto-scales again
    delete temperatureChart.options.scales.y.min;
    delete temperatureChart.options.scales.y.max;
    temperatureChart.update('none');
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
