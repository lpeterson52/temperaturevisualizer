// Define API url
const apiUrl = "https://temperaturevisualizer.onrender.com/api"
    
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
        ['#fffac8', '#ffffe0'], // Beige
        ['#800000', '#d1b3b3'], // Maroon
        ['#aaffc3', '#e0fff7'], // Mint
        ['#808000', '#e6e6b3'], // Olive
        ['#ffd8b1', '#fff5e6'], // Apricot
        ['#000080', '#b3b3e6'], // Navy
        ['#808080', '#e6e6e6'], // Grey
        ['#FFFFFF', '#f2f2f2'], // White
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

async function displayChart(start_date, end_date){
    const data = await fetchTemperaturedata(start_date, end_date);
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
            plugins: {
                legend: { display: true },
                title: { display: true, text: 'Tank Temperatures Over Time' }
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
}

// Date form event listener
document.getElementById('dateForm').addEventListener('submit', function(event) {
    event.preventDefault();
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    displayChart(startDate, endDate);
});

// Generate checkboxes
function createTankCheckboxes() {
    const container = document.getElementById('checkbox-container');
    const letters = ['A', 'B', 'C', 'D'];
    const states = ['warm', 'cool'];
    for (const letter of letters) {
        for (let i = 1; i <= 4; i++) {
            for (const state of states) {
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `tank${letter}${i}${state}`;
                checkbox.checked = false; // or true if you want them checked by default

                const label = document.createElement('label');
                label.htmlFor = checkbox.id;
                label.innerText = `Tank ${letter}${i} ${state.charAt(0).toUpperCase() + state.slice(1)}`;

                // Optionally wrap in a div for styling
                const wrapper = document.createElement('div');
                wrapper.appendChild(checkbox);
                wrapper.appendChild(label);

                container.appendChild(wrapper);
            }
        }
    }
}

// Checkbox event listeners
function addCheckboxEventListeners(){
    const letters = ['A', 'B', 'C', 'D']
    const states = ["warm", "cool"]
    let dataIndex = 0;
    for (const letter of letters) {
        for (let i = 1; i <= 4; i++){
            for (const state of states){
                // Use let to create a new scope for each dataIndex
                let currentIndex = dataIndex;
                document.getElementById('tank' + letter + i + state).addEventListener('change', function() {
                    console.log(`Checkbox ${this.id} changed: ${this.checked}`);
                    if (temperatureChart) {
                        temperatureChart.data.datasets[currentIndex].hidden = !this.checked;
                        temperatureChart.update();
                    }
                });
                dataIndex += 1;
            }
        }
    }
}
createTankCheckboxes();
addCheckboxEventListeners();