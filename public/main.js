function getDateRange(startDateStr, endDateStr) {
  const days = [];
  const start = new Date(`${startDateStr}T00:00:00Z`);
  const end = new Date(`${endDateStr}T00:00:00Z`);
  const cursor = new Date(start.getTime());
  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function getDateRangeFromRows(rows) {
  const dates = rows
    .map(row => row.date)
    .filter(Boolean)
    .sort();
  if (dates.length === 0) return null;
  return { start: dates[0], end: dates[dates.length - 1] };
}

function toContributionLevels(valueMap, dates) {
  const values = dates.map(date => Number(valueMap[date] || 0));
  const max = Math.max(0, ...values);
  if (max === 0) {
    return dates.map(date => ({ date, level: 0, value: 0 }));
  }
  return dates.map(date => {
    const value = Number(valueMap[date] || 0);
    const normalized = value / max;
    const level = value === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil(normalized * 4)));
    return { date, level, value };
  });
}

function buildMetricMaps(combinedRows, sessionRows) {
  const sleepSecondsByDate = {};
  const stepsByDate = {};
  const meditationMinutesByDate = {};

  combinedRows.forEach(row => {
    if (!row.date) return;
    sleepSecondsByDate[row.date] = Number(row.total_sleep_sec || 0);
    stepsByDate[row.date] = Number(row.steps || 0);
    if (meditationMinutesByDate[row.date] === undefined) {
      meditationMinutesByDate[row.date] = 0;
    }
  });

  sessionRows.forEach(row => {
    const date = row.date;
    if (!date || !row.type || !String(row.type).toLowerCase().includes('meditation')) return;
    const start = row.start_datetime ? new Date(row.start_datetime) : null;
    const end = row.end_datetime ? new Date(row.end_datetime) : null;
    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
    const durationMinutes = Math.max(0, Math.round((end - start) / 60000));
    meditationMinutesByDate[date] = Number(meditationMinutesByDate[date] || 0) + durationMinutes;
  });

  return { sleepSecondsByDate, stepsByDate, meditationMinutesByDate };
}

let graphTooltipEl = null;

function ensureGraphTooltip() {
  if (graphTooltipEl) return graphTooltipEl;
  graphTooltipEl = document.createElement('div');
  graphTooltipEl.className = 'graph-tooltip';
  graphTooltipEl.style.display = 'none';
  document.body.appendChild(graphTooltipEl);
  return graphTooltipEl;
}

function showGraphTooltip(text, x, y) {
  const tooltip = ensureGraphTooltip();
  tooltip.textContent = text;
  tooltip.style.display = 'block';
  tooltip.style.left = `${x + 12}px`;
  tooltip.style.top = `${y + 12}px`;
}

function hideGraphTooltip() {
  const tooltip = ensureGraphTooltip();
  tooltip.style.display = 'none';
}

function formatSleepSeconds(value) {
  const totalMinutes = Math.round(Number(value || 0) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function formatInteger(value) {
  return new Intl.NumberFormat().format(Number(value || 0));
}

function createContributionGraph(containerId, titlePrefix, metricData, valueFormatter) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  const graphContainer = document.createElement('div');
  graphContainer.className = 'graph-container';

  const monthsDiv = document.createElement('div');
  monthsDiv.className = 'graph-months';

  const graphBody = document.createElement('div');
  graphBody.className = 'graph-body';

  const weekdayLabels = document.createElement('div');
  weekdayLabels.className = 'weekday-labels';
  const weekdays = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
  weekdays.forEach(day => {
    const label = document.createElement('div');
    label.className = 'weekday-label';
    label.textContent = day;
    weekdayLabels.appendChild(label);
  });

  const graphGrid = document.createElement('div');
  graphGrid.className = 'graph-grid';

  const items = metricData.map(d => ({
    dateObj: new Date(`${d.date}T00:00:00Z`),
    ...d
  }));

  const weeks = [];
  let currentWeek = [];
  const firstDay = items[0]?.dateObj?.getUTCDay() || 0;
  for (let i = 0; i < firstDay; i += 1) currentWeek.push(null);
  items.forEach(item => {
    currentWeek.push(item);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let currentMonth = null;
  const monthPositions = [];

  weeks.forEach((week, weekIndex) => {
    const column = document.createElement('div');
    column.className = 'graph-column';

    week.forEach((day, dayIndex) => {
      const cell = document.createElement('div');
      cell.className = 'graph-cell';
      if (!day) {
        cell.style.visibility = 'hidden';
      } else {
        cell.classList.add(`level-${day.level}`);
        const formattedValue = valueFormatter(day.value);
        const tooltipText = `${day.date}: ${titlePrefix} ${formattedValue}`;
        cell.addEventListener('mouseenter', function(event) {
          showGraphTooltip(tooltipText, event.clientX, event.clientY);
        });
        cell.addEventListener('mousemove', function(event) {
          showGraphTooltip(tooltipText, event.clientX, event.clientY);
        });
        cell.addEventListener('mouseleave', function() {
          hideGraphTooltip();
        });
        const month = day.dateObj.getUTCMonth();
        if (month !== currentMonth) {
          currentMonth = month;
          if (dayIndex === 0 || weekIndex === 0) {
            monthPositions.push({ month, position: weekIndex });
          }
        }
      }
      column.appendChild(cell);
    });

    graphGrid.appendChild(column);
  });

  monthPositions.forEach((entry, index) => {
    const monthLabel = document.createElement('div');
    monthLabel.className = 'month-label';
    monthLabel.textContent = monthNames[entry.month];
    const width = index < monthPositions.length - 1
      ? (monthPositions[index + 1].position - entry.position) * 15
      : (weeks.length - entry.position) * 15;
    monthLabel.style.width = `${width}px`;
    monthsDiv.appendChild(monthLabel);
  });

  graphBody.appendChild(weekdayLabels);
  graphBody.appendChild(graphGrid);
  graphContainer.appendChild(monthsDiv);
  graphContainer.appendChild(graphBody);

  const legend = document.createElement('div');
  legend.className = 'legend';
  legend.innerHTML = `
    <span class="legend-label">Less</span>
    <div class="legend-cell level-0"></div>
    <div class="legend-cell level-1"></div>
    <div class="legend-cell level-2"></div>
    <div class="legend-cell level-3"></div>
    <div class="legend-cell level-4"></div>
    <span class="legend-label">More</span>
  `;
  graphContainer.appendChild(legend);

  container.appendChild(graphContainer);
}

document.addEventListener('DOMContentLoaded', function() {
  const authStatusEl = document.getElementById('authStatus');
  const resultDiv = document.getElementById('result');
  const authorizeBtn = document.getElementById('authorizeBtn');
  const form = document.getElementById('ouraForm');

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

  function renderFetchedData(data, requestedStart, requestedEnd, format = 'json') {
    const combinedRows = JSON.parse(data.combined || '[]');
    const sessionRows = JSON.parse(data.individual.sessions || '[]');
    const chartCanvas = document.getElementById('stressMeditationChart');
    if (chartCanvas && window.renderStressMeditationChart) {
      window.renderStressMeditationChart(data, format);
    }

    const sleepContainer = document.getElementById('sleep-graph');
    const activityContainer = document.getElementById('activity-graph');
    const meditationContainer = document.getElementById('meditation-graph');
    if (sleepContainer && activityContainer && meditationContainer) {
      let start = requestedStart;
      let end = requestedEnd;
      if (!start || !end) {
        const inferredRange = getDateRangeFromRows(combinedRows);
        if (!inferredRange) return;
        start = inferredRange.start;
        end = inferredRange.end;
      }

      const dates = getDateRange(start, end);
      const maps = buildMetricMaps(combinedRows, sessionRows);
      createContributionGraph(
        'sleep-graph',
        'Sleep:',
        toContributionLevels(maps.sleepSecondsByDate, dates),
        formatSleepSeconds
      );
      createContributionGraph(
        'activity-graph',
        'Steps:',
        toContributionLevels(maps.stepsByDate, dates),
        formatInteger
      );
      createContributionGraph(
        'meditation-graph',
        'Meditation minutes:',
        toContributionLevels(maps.meditationMinutesByDate, dates),
        formatInteger
      );
    }
  }

  async function loadLatestSavedData() {
    try {
      const res = await fetch('/data/latest');
      const payload = await res.json();
      if (!payload.success || !payload.data) return;
      renderFetchedData(payload.data, null, null, 'json');
      if (!resultDiv.textContent) {
        resultDiv.textContent = 'Loaded saved data from previous fetch.';
      }
    } catch (error) {
      // ignore load failures; user can still fetch fresh data
    }
  }

  loadLatestSavedData();

  form.addEventListener('submit', async function(e) {
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
      const payload = await res.json();
      if (!payload.success) {
        resultDiv.textContent = `Error: ${payload.error}`;
        if (String(payload.error).includes('Auth is not configured')) {
          await refreshAuthStatus();
        }
        return;
      }

      resultDiv.textContent = 'Data fetched!';
      renderFetchedData(payload.data, start, end, format);
    } catch (error) {
      resultDiv.textContent = `Error: ${error.message}`;
    }
  });
});
