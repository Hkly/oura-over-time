// main.js
// Handles form submission and chart rendering for Oura Data Fetcher

document.addEventListener('DOMContentLoaded', function() {
  const authStatusEl = document.getElementById('authStatus');
  const resultDiv = document.getElementById('result');
  const authorizeBtn = document.getElementById('authorizeBtn');

  function setAuthStatus(isAuthorized) {
    authStatusEl.textContent = isAuthorized
      ? 'Authorized: ready to fetch data.'
      : 'Not authorized: click "Authorize Oura" or set OURA_ACCESS_TOKEN on the server.';
  }

  async function refreshAuthStatus() {
    try {
      const res = await fetch('/auth/status');
      const payload = await res.json();
      setAuthStatus(Boolean(payload.authorized));
    } catch (error) {
      authStatusEl.textContent = 'Unable to check auth status.';
    }
  }

  authorizeBtn.addEventListener('click', function() {
    window.location.href = '/auth/start';
  });

  const urlParams = new URLSearchParams(window.location.search);
  const authState = urlParams.get('auth');
  const authMessage = urlParams.get('message');
  if (authState === 'success') {
    resultDiv.textContent = 'Authorization completed.';
  } else if (authState === 'error') {
    resultDiv.textContent = `Authorization failed: ${authMessage || 'Unknown error'}`;
  }

  if (authState) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  refreshAuthStatus();

  document.getElementById('ouraForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const start = document.getElementById('start').value;
    const end = document.getElementById('end').value;
    const format = 'json';
    resultDiv.textContent = 'Fetching data...';
    try {
      const res = await fetch('/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start, end, format })
      });
      const data = await res.json();
      if (data.success) {
        resultDiv.textContent = 'Data fetched!';
        // Render charts using charts.js
        window.renderStressMeditationChart(data.data, format);
      } else {
        resultDiv.textContent = 'Error: ' + data.error;
        if (data.error.includes('Auth is not configured')) {
          await refreshAuthStatus();
        }
      }
    } catch (err) {
      resultDiv.textContent = 'Error: ' + err.message;
    }
  });
});
