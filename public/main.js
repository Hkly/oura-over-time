// main.js
// Handles form submission and chart rendering for Oura Data Fetcher

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('ouraForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const token = document.getElementById('token').value;
    const start = document.getElementById('start').value;
    const end = document.getElementById('end').value;
    const format = document.getElementById('format').value;
    const resultDiv = document.getElementById('result');
    resultDiv.textContent = 'Fetching data...';
    try {
      const res = await fetch('/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, start, end, format })
      });
      const data = await res.json();
      if (data.success) {
        resultDiv.textContent = 'Data fetched!';
        // Render charts using charts.js
        window.renderStressMeditationChart(data.data, format);
      } else {
        resultDiv.textContent = 'Error: ' + data.error;
      }
    } catch (err) {
      resultDiv.textContent = 'Error: ' + err.message;
    }
  });
});
