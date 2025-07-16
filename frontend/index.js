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

async function displayChart(start_date, end_date){
    const data = await fetchTemperaturedata(start_date, end_date);
    const labels = data.map(entry => entry["Date-Time"]);
    const tankA1Warm = data.map(entry => entry["Tank A1 Warm (C)"]);
    const tankB1Cool = data.map(entry => entry["Tank B1 Cool (C)"]);  

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
            datasets: [
                {
                    label: 'Tank A1 Warm (°C)',
                    data: tankA1Warm,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    fill: false,
                    tension: 0.1,
                    hidden: true
                },
                {
                    label: 'Tank B1 Cool (°C)',
                    data: tankB1Cool,
                    borderColor: 'rgba(255, 99, 132, 1)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    fill: false,
                    tension: 0.1,
                    hidden: true
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: true },
                title: { display: true, text: 'Tank Temperatures Over Time' }
            }
        }
    });
}

// Date form event listener
document.getElementById('dateForm').addEventListener('submit', function(event) {
    event.preventDefault();
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    displayChart(startDate, endDate);
});


// Checkbox event listeners
document.getElementById('tankA1').addEventListener('change', function() {
    if (temperatureChart) {
        temperatureChart.data.datasets[0].hidden = !this.checked;
        console.log("Tank A1 Warm", temperatureChart.data.datasets[0].hidden);
        temperatureChart.update();
    }
});
document.getElementById('tankB1').addEventListener('change', function() {
    if (temperatureChart) {
        temperatureChart.data.datasets[1].hidden = !this.checked;
        console.log("Tank B1 Cool", temperatureChart.data.datasets[1].hidden);
        temperatureChart.update();
    }
});