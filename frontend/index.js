import FetchJob from './fetchJob.js'

// Define API url
const apiUrl = "https://temperaturevisualizer.onrender.com/api";
    
// Global chart variable
let temperatureChart = null;

async function fetchTemperaturedata(start_date, end_date){
    const response = await fetch(`${apiUrl}?start_date=${start_date}&end_date=${end_date}`);
    const data = await response.json();
    
    // Debug: Check what we're getting
    console.log('Data type:', typeof data);
    console.log('Data:', data);
    console.log('Is array?', Array.isArray(data));
    
    return data;
}

function generateTankConfigs(data){
    const tankConfigs = [];
    const colorPairs = [
        ['#e6194b', '#ffb3ba'], // Red
        ['#3cb44b', '#baffc9'], // Green
        ['#ffe119', '#ffffba'], // Yellow
        ['#0082c8', '#bae1ff'], // Blue
        ['#f58231', '#ffd8b1'], // Orange
        ['#911eb4', '#e0b3ff'], // Purple
        ['#46f0f0', '#b3ffff'], // Cyan
        ['#f032e6', '#ffb3ff'], // Magenta
        ['#d2f53c', '#eaffd3'], // Lime
        ['#fabebe', '#fff0f5'], // Pink
        ['#008080', '#b3d1c6'], // Teal
        ['#e6beff', '#f3e6ff'], // Lavender
        ['#aa6e28', '#e2cfc3'], // Brown
        ['#ff7f0e', '#ffffff'], // Vivid Orange on White (replaces Beige)
        ['#800000', '#d1b3b3'], // Maroon
        ['#aaffc3', '#e0fff7'], // Mint
        ['#808000', '#e6e6b3'], // Olive
        ['#ffd8b1', '#fff5e6'], // Apricot
        ['#000080', '#b3b3e6'], // Navy
        ['#808080', '#e6e6e6'], // Grey
        ['#0057e7', '#ffffff'], // Vivid Blue on White (replaces White)
        ['#000000', '#b3b3b3'], // Black
        ['#a9a9a9', '#d3d3d3'], // Dark Grey
        ['#b22222', '#f4cccc'], // Firebrick
        ['#228b22', '#d9ead3'], // Forest Green
        ['#4682b4', '#c9daf8'], // Steel Blue
        ['#daa520', '#ffe599'], // Goldenrod
        ['#9932cc', '#d9d2e9'], // Dark Orchid
        ['#ff69b4', '#fce5cd'], // Hot Pink
        ['#cd5c5c', '#f4cccc'], // Indian Red
        ['#20b2aa', '#d0e0e3'], // Light Sea Green
        ['#b8860b', '#fff2cc'], // Dark Goldenrod
    ];
    const letters = ['A', 'B', 'C', 'D'];
    const states = ['Warm', 'Cool'];
    let colorIndex = 0;
    for (const letter of letters){
        for (let i = 1; i <= 4; i++){
            for (const state of states){
                const tankConfig = {
                    label: `Tank ${letter}${i} ${state.charAt(0).toUpperCase() + state.slice(1)} (°C)`,
                    data: data.map(entry => entry[`Tank ${letter}${i} ${state} (C)`]),
                    borderColor: colorPairs[colorIndex][0],
                    backgroundColor: colorPairs[colorIndex][1],
                    fill: false,
                    tension: 0.1,
                    hidden: true
                }
                tankConfigs.push(tankConfig);
                colorIndex++;
            }
        }
    }
    return tankConfigs;
}

// Plugin to remove strikethrough from hidden legend items
const noStrikethroughLegendPlugin = {
  id: 'noStrikethroughLegend',
  beforeDraw(chart) {
    if (!chart.legend) return;
    chart.legend.legendItems.forEach(item => {
      item.textDecoration = ''; // Remove strikethrough
    });
  }
};

// Custom HTML legend for Chart.js
function updateCustomLegend(chart) {
    const legendContainer = document.getElementById('custom-legend');
    if (!legendContainer) return;
    legendContainer.innerHTML = '';
    chart.data.datasets.forEach((dataset, i) => {
        const legendItem = document.createElement('span');
        legendItem.style.display = 'inline-flex';
        legendItem.style.alignItems = 'center';
        legendItem.style.marginRight = '16px';
        legendItem.style.cursor = 'pointer';
        legendItem.style.opacity = chart.isDatasetVisible(i) ? 1 : 0.5;

        // Colored box (marker)
        const colorBox = document.createElement('span');
        colorBox.style.display = 'inline-block';
        colorBox.style.width = '16px';
        colorBox.style.height = '16px';
        colorBox.style.marginRight = '6px';
        colorBox.style.backgroundColor = dataset.backgroundColor;
        colorBox.style.border = '3px solid ' + dataset.borderColor;
        colorBox.style.borderRadius = '3px';

        // Label text
        const labelText = document.createElement('span');
        labelText.id = dataset.label + 'Label';
        labelText.textContent = dataset.label;
        labelText.style.color = chart.isDatasetVisible(i) ? 'black' : 'gray';

        legendItem.appendChild(colorBox);
        legendItem.appendChild(labelText);

        legendItem.onclick = () => {
            chart.setDatasetVisibility(i, !chart.isDatasetVisible(i));
            chart.update();
            setTimeout(() => updateCustomLegend(chart), 0);
        };
        legendContainer.appendChild(legendItem);
    });
}

async function displayChart(startDate, endDate){
    // Start merge job and poll for progress before rendering chart
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
        return;
    }

    // Once complete, fetch the data and display the chart
    const data = await job.fetchResult();
    const labels = data.map(entry => entry["Date-Time"]);

    const tankConfigs = generateTankConfigs(data);

    // Chart.js setup
    const ctx = document.getElementById('temperatureChart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (temperatureChart) {
        temperatureChart.destroy();
    }
    
    temperatureChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: tankConfigs
        },
        options: {
            animation: false,
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false // Disable built-in legend
                },
                title: { display: true, text: 'Tank Temperatures Over Time' }
            },
            scales: {
                y: {
                    ticks: { // adding units to y axis
                        callback: function(value, index, ticks) {
                            return value + ' °C';
                        }
                    }
                }
            }
        }
    });

    // Sync dataset visibility to checkbox state after chart creation
    const letters = ['A', 'B', 'C', 'D'];
    const states = ['warm', 'cool'];
    let dataIndex = 0;
    for (const letter of letters) {
        for (let i = 1; i <= 4; i++) {
            for (const state of states) {
                const checkbox = document.getElementById('tank' + letter + i + state);
                if (checkbox) {
                    temperatureChart.data.datasets[dataIndex].hidden = !checkbox.checked;
                }
                dataIndex++;
            }
        }
    }
    temperatureChart.update();
    updateCustomLegend(temperatureChart);
}

async function pollJobStatus(fetchJob, interval = 800) {
    const chartContainer = document.getElementById('chart-container');
    if (!chartContainer) {
        // nothing to update visually; just poll until done
        return new Promise((resolve, reject) => {
            const poll = async () => {
                try {
                    const statusObj = await fetchJob.getStatus();
                    if (statusObj.status === 'complete') return resolve();
                    if (statusObj.status === 'failed') return reject(new Error(statusObj.error || 'Job failed'));
                    setTimeout(poll, interval);
                } catch (err) {
                    setTimeout(poll, interval);
                }
            };
            poll();
        });
    }

    // create progress UI under the chart if missing
    let container = document.getElementById('merge-progress-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'merge-progress-container';
        container.style.width = '100%';
        container.style.boxSizing = 'border-box';
        container.style.marginTop = '12px';
        container.style.height = '12px';
        container.style.background = '#f2f2f2';
        container.style.borderRadius = '6px';
        container.style.overflow = 'hidden';
        const bar = document.createElement('div');
        bar.id = 'merge-progress-bar';
        bar.style.height = '100%';
        bar.style.width = '0%';
        bar.style.background = '#3cb44b';
        bar.style.transition = 'width 400ms linear';
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
                        const c = document.getElementById('merge-progress-container');
                        if (c) c.remove();
                        resolve();
                    }, 300);
                    return;
                }

                if (statusObj.status === 'failed') {
                    const c = document.getElementById('merge-progress-container');
                    if (c) c.remove();
                    return reject(new Error(statusObj.error || 'Job failed'));
                }

                setTimeout(poll, interval);
            } catch (err) {
                // transient error: retry after interval
                console.warn('pollJobStatus error, retrying', err);
                setTimeout(poll, interval);
            }
        };
        poll();
    });
}

// Date form event listener
document.getElementById('dateForm').addEventListener('submit', function(event) {
    event.preventDefault();
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const instructions = document.getElementById('instructions');
    instructions.style.display = 'none';
    displayChart(startDate, endDate);
});