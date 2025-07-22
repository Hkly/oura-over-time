// charts.js
// Modular chart rendering for Oura Data Fetcher

// Load Chart.js if not already loaded
if (!window.Chart) {
  var script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
  document.head.appendChild(script);
}

function getStressMeditationData(data) {
  // stress/recovery: from combined data
  // meditation sessions: from individual sessions
  // Only handle JSON data
  let combinedRows = JSON.parse(data.combined || '[]');
  let sessionRows = JSON.parse(data.individual.sessions || '[]');
  // Build date map
  const dateMap = {};
  combinedRows.forEach(r => {
    dateMap[r.date] = {
      stress_high: Number(r.stress_high || 0),
      recovery_high: Number(r.recovery_high || 0),
      meditation_minutes: 0
    };
  });
  sessionRows.forEach(r => {
    if (r.type && r.type.toLowerCase().includes('meditation')) {
      // Calculate session duration in minutes
      let start = r.start_datetime ? new Date(r.start_datetime) : null;
      let end = r.end_datetime ? new Date(r.end_datetime) : null;
      let durationMin = 0;
      if (start && end && !isNaN(start) && !isNaN(end)) {
        durationMin = Math.round((end - start) / 60000); // ms to min
      }
      if (!dateMap[r.date]) {
        dateMap[r.date] = { stress_high: 0, recovery_high: 0, meditation_minutes: 0 };
      }
      dateMap[r.date].meditation_minutes += durationMin;
    }
  });
  // Sort by date
  const dates = Object.keys(dateMap).sort();
  const stress_high = dates.map(d => dateMap[d].stress_high);
  const recovery_high = dates.map(d => dateMap[d].recovery_high);
  const meditation_minutes = dates.map(d => dateMap[d].meditation_minutes);
  return { dates, stress_high, recovery_high, meditation_minutes };
}

let stressMeditationChart = null;

function renderStressMeditationChart(data, format) {
  const chartData = getStressMeditationData({
    format,
    combined: data.combined,
    individual: data.individual
  });
  if (stressMeditationChart) stressMeditationChart.destroy();
  const ctx = document.getElementById('stressMeditationChart').getContext('2d');
  stressMeditationChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: chartData.dates,
      datasets: [
        {
          label: 'Total Meditation Minutes',
          data: chartData.meditation_minutes,
          backgroundColor: 'rgba(0,200,0,0.5)',
          yAxisID: 'y',
        },
        {
          label: 'Stress High',
          data: chartData.stress_high,
          type: 'line',
          borderColor: 'rgba(255,99,132,0.8)',
          backgroundColor: 'rgba(255,99,132,0.2)',
          yAxisID: 'y1',
          fill: false
        },
        {
          label: 'Recovery High',
          data: chartData.recovery_high,
          type: 'line',
          borderColor: 'rgba(54,162,235,0.8)',
          backgroundColor: 'rgba(54,162,235,0.2)',
          yAxisID: 'y1',
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        title: { display: true, text: 'Stress & Meditation Comparison' },
        legend: { position: 'top' }
      },
      scales: {
        y: {
          position: 'left',
          title: { display: true, text: 'Total Meditation Minutes' }
        },
        y1: {
          position: 'right',
          title: { display: true, text: 'Stress/Recovery High' },
          grid: { drawOnChartArea: false }
        }
      }
    }
  });
}

// Export for use in index.html
window.renderStressMeditationChart = renderStressMeditationChart;
// No longer export parseCSV; only JSON is supported
// Add more chart renderers here as needed
