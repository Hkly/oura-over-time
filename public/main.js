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

function filterRowsToDateRange(rows, start, end) {
  if (!start || !end) return rows;
  return rows.filter(row => {
    if (!row?.date) return false;
    return row.date >= start && row.date <= end;
  });
}

function getLocalDateString(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function formatRangeKey(start, end) {
  return `${start}__${end}`;
}

function getLastSixMonthsRange() {
  const end = new Date();
  const start = new Date(end);
  start.setMonth(start.getMonth() - 6);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10)
  };
}

function getPresetRange(preset) {
  const end = new Date();
  const start = new Date(end);
  if (preset === '3m') {
    start.setMonth(start.getMonth() - 3);
  } else if (preset === '6m') {
    start.setMonth(start.getMonth() - 6);
  } else if (preset === '1y') {
    start.setFullYear(start.getFullYear() - 1);
  }
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10)
  };
}

function toContributionLevels(valueMap, dates, options = {}) {
  const values = dates.map(date => Number(valueMap[date] || 0));
  const nonZeroValues = values.filter(v => v > 0);
  if (options.mode === 'quantile' && nonZeroValues.length > 0) {
    const sorted = [...nonZeroValues].sort((a, b) => a - b);
    const q1 = sorted[Math.floor((sorted.length - 1) * 0.25)];
    const q2 = sorted[Math.floor((sorted.length - 1) * 0.5)];
    const q3 = sorted[Math.floor((sorted.length - 1) * 0.75)];
    return dates.map(date => {
      const value = Number(valueMap[date] || 0);
      let level = 0;
      if (value > 0) {
        if (value <= q1) level = 1;
        else if (value <= q2) level = 2;
        else if (value <= q3) level = 3;
        else level = 4;
      }
      return { date, level, value };
    });
  }

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

function toSedentaryThresholdLevels(sedentarySecondsByDate, dates) {
  const FIVE_HOURS = 5 * 60 * 60;
  const SEVEN_HOURS = 7 * 60 * 60;
  const NINE_HOURS = 9 * 60 * 60;

  return dates.map(date => {
    const value = Number(sedentarySecondsByDate[date] || 0);
    let level = 0;

    if (value > 0 && value <= FIVE_HOURS) level = 1;
    else if (value <= SEVEN_HOURS) level = 2;
    else if (value <= NINE_HOURS) level = 3;
    else if (value > NINE_HOURS) level = 4;

    return { date, level, value };
  });
}

function toZScoreLevels(valueMap, dates) {
  const values = dates.map(date => Number(valueMap[date] || 0));
  const nonZeroValues = values.filter(value => value > 0);
  if (nonZeroValues.length === 0) {
    return dates.map(date => ({ date, level: 0, value: 0 }));
  }

  const mean = nonZeroValues.reduce((sum, value) => sum + value, 0) / nonZeroValues.length;
  const variance = nonZeroValues.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / nonZeroValues.length;
  const stdDev = Math.sqrt(variance);

  return dates.map(date => {
    const value = Number(valueMap[date] || 0);
    if (value === 0) {
      return { date, level: 0, value };
    }

    if (stdDev === 0) {
      return { date, level: 3, value };
    }

    const zScore = (value - mean) / stdDev;
    let level = 2;
    if (zScore <= -1) level = 1;
    else if (zScore >= 1) level = 4;
    else if (zScore >= 0) level = 3;

    return { date, level, value };
  });
}

const MET_BUCKET_ORDER = ['high', 'medium', 'low', 'sedentary'];
const MET_BUCKET_LABELS = {
  high: 'high activity',
  medium: 'medium activity',
  low: 'low activity',
  sedentary: 'sedentary'
};

function readCssNumberVar(name, fallback) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getMetCompositionBaseHsl() {
  return {
    high: {
      h: readCssNumberVar('--met-high-hue', 12),
      s: readCssNumberVar('--met-high-saturation', 84)
    },
    medium: {
      h: readCssNumberVar('--met-medium-hue', 268),
      s: readCssNumberVar('--met-medium-saturation', 72)
    },
    low: {
      h: readCssNumberVar('--met-low-hue', 204),
      s: readCssNumberVar('--met-low-saturation', 70)
    },
    sedentary: {
      h: readCssNumberVar('--met-sedentary-hue', 214),
      s: readCssNumberVar('--met-sedentary-saturation', 24)
    }
  };
}

function toMetCompositionLevels(metBucketsByDate, dates) {
  const totals = dates.map(date => Number(metBucketsByDate[date]?.total || 0));
  const nonZeroTotals = totals.filter(value => value > 0);
  const maxTotal = nonZeroTotals.length > 0 ? Math.max(...nonZeroTotals) : 0;

  return dates.map(date => {
    const buckets = metBucketsByDate[date];
    const total = Number(buckets?.total || 0);
    if (!buckets || total <= 0) {
      return {
        date,
        level: 0,
        value: 0,
        buckets: null,
        dominantKey: null,
        dominanceRatio: 0,
        loadRatio: 0
      };
    }

    const normalizedBuckets = {
      high: Number(buckets.high || 0),
      medium: Number(buckets.medium || 0),
      low: Number(buckets.low || 0),
      sedentary: Number(buckets.sedentary || 0)
    };

    const rankedBuckets = MET_BUCKET_ORDER
      .map(key => ({ key, value: normalizedBuckets[key] }))
      .sort((a, b) => b.value - a.value || MET_BUCKET_ORDER.indexOf(a.key) - MET_BUCKET_ORDER.indexOf(b.key));
    const dominantKey = rankedBuckets[0]?.key || 'low';
    const dominantValue = rankedBuckets[0]?.value || 0;
    const secondValue = rankedBuckets[1]?.value || 0;
    const dominanceRatio = total > 0 ? (dominantValue - secondValue) / total : 0;
    const loadRatio = maxTotal > 0 ? total / maxTotal : 0;

    return {
      date,
      level: 1,
      value: total,
      buckets: normalizedBuckets,
      dominantKey,
      dominanceRatio,
      loadRatio
    };
  });
}

function getMetCompositionColor(day) {
  if (!day || day.level === 0 || !day.dominantKey) {
    return null;
  }
  const metBaseByBucket = getMetCompositionBaseHsl();
  const base = metBaseByBucket[day.dominantKey] || metBaseByBucket.low;
  const dominanceRatio = Math.max(0, Math.min(1, Number(day.dominanceRatio || 0)));
  const loadRatio = Math.max(0, Math.min(1, Number(day.loadRatio || 0)));
  const saturation = Math.round(base.s * (0.45 + dominanceRatio * 0.55));
  const lightness = Math.round(74 - loadRatio * 32);
  return `hsl(${base.h}, ${saturation}%, ${lightness}%)`;
}

function toStressRecoveryBalanceLevels(stressRecoveryByDate, dates) {
  return dates.map(date => {
    const entry = stressRecoveryByDate[date];
    if (!entry) {
      return { date, level: 0, value: 0, stress: null, recovery: null, balance: null };
    }

    const stress = Number(entry.stress || 0);
    const recovery = Number(entry.recovery || 0);
    const balance = recovery - stress;

    if (stress <= 0 && recovery <= 0) {
      return { date, level: 0, value: 0, stress, recovery, balance };
    }

    if (stress <= 0) {
      return { date, level: 1, value: balance, stress, recovery, balance };
    }

    if (recovery <= 0) {
      return { date, level: 7, value: balance, stress, recovery, balance };
    }

    const ratio = (recovery - stress) / (recovery + stress);
    let level = 4;
    if (ratio >= 0.35) level = 2; // Recovery-dominant mixed
    else if (ratio > 0.1) level = 3; // Recovery-leaning mixed
    else if (ratio <= -0.35) level = 6; // Stress-dominant mixed
    else if (ratio < -0.1) level = 5; // Stress-leaning mixed

    return { date, level, value: balance, stress, recovery, balance };
  });
}

function buildMetricMaps(combinedRows, sessionRows) {
  const sleepSecondsByDate = {};
  const stepsByDate = {};
  const sedentarySecondsByDate = {};
  const metBucketsByDate = {};
  const meditationMinutesByDate = {};
  const stressRecoveryByDate = {};
  const workoutMinutesByDate = {};
  const workoutTypeCountsByDate = {};

  combinedRows.forEach(row => {
    if (!row.date) return;
    sleepSecondsByDate[row.date] = Number(row.total_sleep_sec || 0);
    stepsByDate[row.date] = Number(row.steps || 0);
    sedentarySecondsByDate[row.date] = Number(row.sedentary_time || 0);
    if (meditationMinutesByDate[row.date] === undefined) {
      meditationMinutesByDate[row.date] = 0;
    }

    const highMetMinutes = Number(row.high_activity_met_minutes || 0);
    const mediumMetMinutes = Number(row.medium_activity_met_minutes || 0);
    const lowMetMinutes = Number(row.low_activity_met_minutes || 0);
    const sedentaryMetMinutes = Number(row.sedentary_met_minutes || 0);
    const totalMetMinutes = highMetMinutes + mediumMetMinutes + lowMetMinutes + sedentaryMetMinutes;

    metBucketsByDate[row.date] = {
      high: highMetMinutes,
      medium: mediumMetMinutes,
      low: lowMetMinutes,
      sedentary: sedentaryMetMinutes,
      total: totalMetMinutes
    };

    const hasStress = row.stress_high !== null && row.stress_high !== undefined && row.stress_high !== '';
    const hasRecovery = row.recovery_high !== null && row.recovery_high !== undefined && row.recovery_high !== '';
    if (hasStress || hasRecovery) {
      const stress = Number(row.stress_high || 0);
      const recovery = Number(row.recovery_high || 0);
      stressRecoveryByDate[row.date] = {
        stress,
        recovery,
        balance: recovery - stress
      };
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

  return {
    sleepSecondsByDate,
    stepsByDate,
    sedentarySecondsByDate,
    metBucketsByDate,
    meditationMinutesByDate,
    stressRecoveryByDate,
    workoutMinutesByDate,
    workoutTypeCountsByDate
  };
}

function addWorkoutMetrics(workoutRows, workoutMinutesByDate, workoutTypeCountsByDate) {
  workoutRows.forEach(row => {
    const date = row.date;
    if (!date) return;

    const start = row.start_datetime ? new Date(row.start_datetime) : null;
    const end = row.end_datetime ? new Date(row.end_datetime) : null;
    let durationMinutes = 0;
    if (start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      durationMinutes = Math.max(0, Math.round((end - start) / 60000));
    }
    workoutMinutesByDate[date] = Number(workoutMinutesByDate[date] || 0) + durationMinutes;

    const workoutTypeRaw = String(row.label || row.activity || 'workout').trim().toLowerCase();
    if (!workoutTypeRaw) return;
    if (!workoutTypeCountsByDate[date]) {
      workoutTypeCountsByDate[date] = {};
    }
    workoutTypeCountsByDate[date][workoutTypeRaw] =
      Number(workoutTypeCountsByDate[date][workoutTypeRaw] || 0) + 1;
  });
}

function formatWorkoutTypeSummary(typeCountsForDay) {
  if (!typeCountsForDay || Object.keys(typeCountsForDay).length === 0) {
    return 'No workouts logged';
  }
  const entries = Object.entries(typeCountsForDay).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return entries
    .map(([typeName, count]) => {
      const pluralizedType = count === 1 ? typeName : `${typeName}s`;
      return `${count} ${pluralizedType}`;
    })
    .join(', ');
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

  const offset = 12;
  const viewportPadding = 8;
  const tooltipRect = tooltip.getBoundingClientRect();
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

  let left = x + offset;
  let top = y + offset;

  if (left + tooltipRect.width > viewportWidth - viewportPadding) {
    left = viewportWidth - tooltipRect.width - viewportPadding;
  }
  if (top + tooltipRect.height > viewportHeight - viewportPadding) {
    top = y - tooltipRect.height - offset;
  }

  left = Math.max(viewportPadding, left);
  top = Math.max(viewportPadding, top);

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
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

function formatCountWithUnit(value, singularUnit, pluralUnit) {
  const number = Number(value || 0);
  const absolute = Math.abs(number);
  const unit = absolute === 1 ? singularUnit : pluralUnit;
  return `${new Intl.NumberFormat().format(number)} ${unit}`;
}

function formatSecondsAsDuration(value) {
  const seconds = Number(value || 0);
  const totalMinutes = Math.round(Math.abs(seconds) / 60);
  const sign = seconds < 0 ? '-' : '';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) {
    return `${sign}${new Intl.NumberFormat().format(minutes)}m`;
  }
  return `${sign}${new Intl.NumberFormat().format(hours)}h ${minutes}m`;
}

function buildLegendRangeTooltips(metricData, levels, valueFormatter, labels = {}, zeroLabel = 'No data') {
  const valuesByLevel = new Map();
  metricData.forEach(day => {
    if (typeof day?.level !== 'number') return;
    if (!valuesByLevel.has(day.level)) {
      valuesByLevel.set(day.level, []);
    }
    valuesByLevel.get(day.level).push(Number(day.value || 0));
  });

  return levels.map(level => {
    const values = valuesByLevel.get(level) || [];
    const dayCount = values.length;

    if (level === 0) {
      return `${zeroLabel}${dayCount > 0 ? ` · ${dayCount} days` : ''}`;
    }

    if (dayCount === 0) {
      return '0 days';
    }

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const formattedMin = valueFormatter(minValue);
    const formattedMax = valueFormatter(maxValue);
    const rangeText = minValue === maxValue ? formattedMin : `${formattedMin} - ${formattedMax}`;
    return `${dayCount} days · ${rangeText}`;
  });
}

function extractClockMinutes(timestamp) {
  if (typeof timestamp !== 'string') return null;
  const match = timestamp.match(/T(\d{2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function formatMinutesAsClock(totalMinutes) {
  if (typeof totalMinutes !== 'number' || Number.isNaN(totalMinutes)) return '--';
  const wrappedMinutes = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hours24 = Math.floor(wrappedMinutes / 60);
  const minutes = wrappedMinutes % 60;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
}

function drawRingSegment(ctx, cx, cy, innerRadius, outerRadius, startAngle, endAngle, fillColor) {
  ctx.beginPath();
  if (innerRadius <= 0) {
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, outerRadius, startAngle, endAngle);
    ctx.closePath();
  } else {
    ctx.arc(cx, cy, outerRadius, startAngle, endAngle);
    ctx.arc(cx, cy, innerRadius, endAngle, startAngle, true);
    ctx.closePath();
  }
  ctx.fillStyle = fillColor;
  ctx.fill();
}

function getClockDensityCounts(minuteValues, bins) {
  const counts = Array(bins).fill(0);
  minuteValues.forEach(minutes => {
    if (typeof minutes !== 'number' || Number.isNaN(minutes)) return;
    const normalized = ((minutes % 1440) + 1440) % 1440;
    const bin = Math.min(bins - 1, Math.floor((normalized / 1440) * bins));
    counts[bin] += 1;
  });
  return counts;
}

function drawDensityRing(ctx, counts, cx, cy, innerRadius, outerRadius, colorBase) {
  const maxCount = Math.max(0, ...counts);
  counts.forEach((count, index) => {
    const bins = counts.length;
    const startAngle = (index / bins) * Math.PI * 2 - Math.PI / 2;
    const endAngle = ((index + 1) / bins) * Math.PI * 2 - Math.PI / 2;
    const intensity = maxCount === 0 ? 0 : count / maxCount;
    const alpha = count === 0 ? 0.12 : 0.2 + Math.pow(intensity, 0.8) * 0.8;
    drawRingSegment(ctx, cx, cy, innerRadius, outerRadius, startAngle, endAngle, `${colorBase}${alpha})`);
  });
}

function findPeakMinuteFromCounts(counts) {
  const maxCount = Math.max(0, ...counts);
  if (maxCount === 0) return null;
  let maxIndex = 0;
  counts.forEach((count, index) => {
    if (count > counts[maxIndex]) maxIndex = index;
  });
  const minutesPerBin = 1440 / counts.length;
  return (maxIndex + 0.5) * minutesPerBin;
}

function prepareCanvasForDevicePixelRatio(canvas, ctx) {
  const displayWidth = Math.max(1, Math.round(canvas.clientWidth || canvas.width));
  const displayHeight = Math.max(1, Math.round(canvas.clientHeight || canvas.height));
  const dpr = window.devicePixelRatio || 1;
  const scaledWidth = Math.round(displayWidth * dpr);
  const scaledHeight = Math.round(displayHeight * dpr);

  if (canvas.width !== scaledWidth || canvas.height !== scaledHeight) {
    canvas.width = scaledWidth;
    canvas.height = scaledHeight;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width: displayWidth, height: displayHeight };
}

const sleepTimingClockHoverState = new WeakMap();

function formatClockRange(startMinute, endMinute) {
  return `${formatMinutesAsClock(startMinute)}-${formatMinutesAsClock(endMinute)}`;
}

function getSleepTimingClockHoverDetail(state, x, y) {
  const dx = x - state.cx;
  const dy = y - state.cy;
  const distance = Math.sqrt(dx * dx + dy * dy);
  let angle = Math.atan2(dy, dx) + Math.PI / 2;
  if (angle < 0) {
    angle += Math.PI * 2;
  }
  const bin = Math.min(state.bins - 1, Math.floor((angle / (Math.PI * 2)) * state.bins));
  const startMinute = (bin / state.bins) * 1440;
  const endMinute = ((bin + 1) / state.bins) * 1440;

  if (distance <= state.wakeOuterRadius) {
    const count = state.wakeCounts[bin];
    if (!count) return null;
    return {
      text: `Wake: ${formatClockRange(startMinute, endMinute)} • ${count} ${count === 1 ? 'night' : 'nights'}`
    };
  }

  if (distance >= state.bedtimeInnerRadius && distance <= state.bedtimeOuterRadius) {
    const count = state.bedtimeCounts[bin];
    if (!count) return null;
    return {
      text: `Bedtime: ${formatClockRange(startMinute, endMinute)} • ${count} ${count === 1 ? 'night' : 'nights'}`
    };
  }

  return null;
}

function bindSleepTimingClockHover(canvas) {
  if (!canvas || canvas.dataset.clockHoverBound === 'true') return;
  canvas.dataset.clockHoverBound = 'true';

  canvas.addEventListener('mousemove', event => {
    const state = sleepTimingClockHoverState.get(canvas);
    if (!state) {
      hideGraphTooltip();
      return;
    }

    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      hideGraphTooltip();
      return;
    }

    const x = ((event.clientX - rect.left) / rect.width) * state.width;
    const y = ((event.clientY - rect.top) / rect.height) * state.height;
    const hoverDetail = getSleepTimingClockHoverDetail(state, x, y);
    if (!hoverDetail) {
      hideGraphTooltip();
      return;
    }

    showGraphTooltip(hoverDetail.text, event.clientX, event.clientY);
  });

  canvas.addEventListener('mouseleave', () => {
    hideGraphTooltip();
  });
}

function drawCombinedSleepTimingClock(canvasId, bedtimeMinutes, wakeMinutes, options = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return { bedtimePeakMinute: null, wakePeakMinute: null };
  const ctx = canvas.getContext('2d');
  if (!ctx) return { bedtimePeakMinute: null, wakePeakMinute: null };

  const bins = options.bins || 96;
  const bedtimeCounts = getClockDensityCounts(bedtimeMinutes, bins);
  const wakeCounts = getClockDensityCounts(wakeMinutes, bins);

  const { width, height } = prepareCanvasForDevicePixelRatio(canvas, ctx);
  const cx = width / 2;
  const cy = height / 2;
  const minDimension = Math.min(width, height);
  const wakeInnerRadius = 0;
  const wakeOuterRadius = minDimension * 0.21;
  const bedtimeInnerRadius = wakeOuterRadius;
  const bedtimeOuterRadius = minDimension * 0.36;
  bindSleepTimingClockHover(canvas);
  sleepTimingClockHoverState.set(canvas, {
    width,
    height,
    cx,
    cy,
    bins,
    wakeOuterRadius,
    bedtimeInnerRadius,
    bedtimeOuterRadius,
    bedtimeCounts,
    wakeCounts
  });

  ctx.clearRect(0, 0, width, height);
  drawDensityRing(ctx, bedtimeCounts, cx, cy, bedtimeInnerRadius, bedtimeOuterRadius, 'rgba(102, 126, 234, ');
  drawDensityRing(ctx, wakeCounts, cx, cy, wakeInnerRadius, wakeOuterRadius, 'rgba(245, 158, 11, ');

  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(45, 55, 72, 0.15)';
  [wakeOuterRadius, bedtimeInnerRadius, bedtimeOuterRadius].forEach(radius => {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  });

  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(45, 55, 72, 0.25)';
  ctx.fillStyle = '#4a5568';
  ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let hour = 0; hour < 24; hour += 3) {
    const angle = (hour / 24) * Math.PI * 2 - Math.PI / 2;
    const innerTick = bedtimeOuterRadius + 2;
    const outerTick = bedtimeOuterRadius + 9;
    const textRadius = bedtimeOuterRadius + 20;
    const x1 = cx + Math.cos(angle) * innerTick;
    const y1 = cy + Math.sin(angle) * innerTick;
    const x2 = cx + Math.cos(angle) * outerTick;
    const y2 = cy + Math.sin(angle) * outerTick;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    const labelHour = hour % 12 || 12;
    const half = hour >= 12 ? 'p' : 'a';
    ctx.fillText(`${labelHour}${half}`, cx + Math.cos(angle) * textRadius, cy + Math.sin(angle) * textRadius);
  }

  const bedtimePeakMinute = findPeakMinuteFromCounts(bedtimeCounts);
  const wakePeakMinute = findPeakMinuteFromCounts(wakeCounts);
  if (bedtimePeakMinute === null && wakePeakMinute === null) {
    ctx.fillStyle = '#718096';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    ctx.fillText('No data in range', cx, cy);
    return { bedtimePeakMinute, wakePeakMinute };
  }

  ctx.fillStyle = '#2d3748';
  ctx.font = '600 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  return { bedtimePeakMinute, wakePeakMinute };
}

function renderSleepTimeDensityClocks(combinedRows) {
  const summaryEl = document.getElementById('sleep-timing-summary');
  const bedtimeMinutes = [];
  const wakeMinutes = [];

  combinedRows.forEach(row => {
    const bedtime = extractClockMinutes(row.bedtime_start);
    if (bedtime !== null) bedtimeMinutes.push(bedtime);
    const waketime = extractClockMinutes(row.bedtime_end);
    if (waketime !== null) wakeMinutes.push(waketime);
  });

  const { bedtimePeakMinute, wakePeakMinute } = drawCombinedSleepTimingClock('sleep-timing-clock', bedtimeMinutes, wakeMinutes);
  if (!summaryEl) return;

  if (bedtimePeakMinute === null && wakePeakMinute === null) {
    summaryEl.textContent = 'No sleep timing data in this range.';
    return;
  }

  summaryEl.innerHTML = `
    <span class="clock-summary-item">
      <span class="clock-summary-dot bedtime"></span>
      Bedtime peak: ${bedtimePeakMinute === null ? '--' : formatMinutesAsClock(bedtimePeakMinute)}
    </span>
    <span class="clock-summary-item">
      <span class="clock-summary-dot wake"></span>
      Wake peak: ${wakePeakMinute === null ? '--' : formatMinutesAsClock(wakePeakMinute)}
    </span>
  `;
}

function createContributionGraph(
  containerId,
  titlePrefix,
  metricData,
  valueFormatter,
  options = {}
) {
  const {
    tooltipTextBuilder = null,
    cellColorBuilder = null,
    legendOptions = null
  } = options;

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
        if (cellColorBuilder) {
          const dynamicColor = cellColorBuilder(day);
          if (dynamicColor) {
            cell.style.backgroundColor = dynamicColor;
          }
        }
        const formattedValue = valueFormatter(day.value);
        const tooltipText = tooltipTextBuilder
          ? tooltipTextBuilder(day, formattedValue)
          : `${day.date}: ${titlePrefix} ${formattedValue}`;
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
  const startLabelText = legendOptions?.startLabel || 'Less';
  const endLabelText = legendOptions?.endLabel || 'More';
  const legendColors = Array.isArray(legendOptions?.colors)
    ? legendOptions.colors
    : null;
  const legendLevelOrder = Array.isArray(legendOptions?.levelOrder)
    ? legendOptions.levelOrder
    : null;
  const legendTooltips = Array.isArray(legendOptions?.tooltips)
    ? legendOptions.tooltips
    : null;
  const legendCellCount = legendLevelOrder?.length || legendColors?.length || 5;

  const startLabel = document.createElement('span');
  startLabel.className = 'legend-label';
  startLabel.textContent = startLabelText;
  legend.appendChild(startLabel);

  for (let i = 0; i < legendCellCount; i += 1) {
    const cell = document.createElement('div');
    cell.className = 'legend-cell';
    if (legendColors) {
      cell.style.backgroundColor = legendColors[i];
    } else {
      const level = legendLevelOrder ? legendLevelOrder[i] : i;
      cell.classList.add(`level-${level}`);
    }
    if (legendTooltips && legendTooltips[i]) {
      const legendTooltipText = legendTooltips[i];
      cell.setAttribute('aria-label', legendTooltipText);
      cell.addEventListener('mouseenter', function(event) {
        showGraphTooltip(legendTooltipText, event.clientX, event.clientY);
      });
      cell.addEventListener('mousemove', function(event) {
        showGraphTooltip(legendTooltipText, event.clientX, event.clientY);
      });
      cell.addEventListener('mouseleave', function() {
        hideGraphTooltip();
      });
    }
    legend.appendChild(cell);
  }

  const endLabel = document.createElement('span');
  endLabel.className = 'legend-label';
  endLabel.textContent = endLabelText;
  legend.appendChild(endLabel);
  graphContainer.appendChild(legend);

  container.appendChild(graphContainer);
}

function getCacheKey() {
  return 'oura-dashboard-daily-cache';
}

const CACHE_VERSION = 2;
let memoryDailyCache = null;

function saveDailyCache(start, end, data) {
  const payload = {
    cacheVersion: CACHE_VERSION,
    cacheDate: getLocalDateString(),
    rangeKey: formatRangeKey(start, end),
    start,
    end,
    data
  };
  memoryDailyCache = payload;

  try {
    localStorage.setItem(getCacheKey(), JSON.stringify(payload));
  } catch (error) {
    // Avoid reusing stale cache when writing updated payloads fails.
    localStorage.removeItem(getCacheKey());
    try {
      localStorage.setItem(getCacheKey(), JSON.stringify(payload));
    } catch (secondError) {
      console.warn('Unable to persist Oura dashboard cache:', secondError);
    }
  }
}

function loadDailyCache() {
  const currentDate = getLocalDateString();
  if (
    memoryDailyCache &&
    memoryDailyCache.cacheVersion === CACHE_VERSION &&
    memoryDailyCache.cacheDate === currentDate &&
    memoryDailyCache.data
  ) {
    return memoryDailyCache;
  }
  memoryDailyCache = null;

  const raw = localStorage.getItem(getCacheKey());
  if (!raw) return null;

  try {
    const payload = JSON.parse(raw);
    if (payload?.cacheVersion !== CACHE_VERSION) {
      localStorage.removeItem(getCacheKey());
      return null;
    }
    if (payload?.cacheDate !== currentDate) {
      localStorage.removeItem(getCacheKey());
      return null;
    }
    if (!payload?.data) return null;
    memoryDailyCache = payload;
    return payload;
  } catch (error) {
    localStorage.removeItem(getCacheKey());
    return null;
  }
}

function loadDailyCacheForRange(start, end) {
  const cached = loadDailyCache();
  if (!cached) return null;
  if (cached.start > start || cached.end < end) return null;
  return cached;
}

document.addEventListener('DOMContentLoaded', function() {
  const authStatusEl = document.getElementById('authStatus');
  const resultDiv = document.getElementById('result');
  const authorizeBtn = document.getElementById('authorizeBtn');
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const form = document.getElementById('ouraForm');
  const rangeButtons = Array.from(document.querySelectorAll('.range-button'));
  const startInput = document.getElementById('start');
  const endInput = document.getElementById('end');
  const themeStorageKey = 'oura-theme';
  const isStressPage = Boolean(document.getElementById('stressMeditationChart')) && !document.getElementById('sleep-graph');
  const defaultRange = getLastSixMonthsRange();
  startInput.value = defaultRange.start;
  endInput.value = defaultRange.end;
  if (rangeButtons.length > 0) {
    setActiveRangeButton('6m');
  }

  function getPreferredTheme() {
    const savedTheme = localStorage.getItem(themeStorageKey);
    if (savedTheme === 'dark' || savedTheme === 'light') {
      return savedTheme;
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  function applyTheme(theme) {
    document.body.classList.toggle('theme-dark', theme === 'dark');
    document.body.classList.toggle('theme-light', theme === 'light');
    if (themeToggleBtn) {
      const nextModeLabel = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
      themeToggleBtn.textContent = theme === 'dark' ? '☀︎' : '☾';
      themeToggleBtn.setAttribute('aria-label', nextModeLabel);
      themeToggleBtn.title = nextModeLabel;
    }
  }

  let currentTheme = getPreferredTheme();
  applyTheme(currentTheme);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', function() {
      currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
      localStorage.setItem(themeStorageKey, currentTheme);
      applyTheme(currentTheme);
    });
  }

  function setAuthStatus(isAuthorized) {
    authStatusEl.textContent = isAuthorized
      ? 'Authorized: ready to fetch data.'
      : 'Not authorized: click "Authorize Oura" for this browser session.';
  }

  function setActiveRangeButton(preset) {
    rangeButtons.forEach(button => {
      button.classList.toggle('active', button.dataset.range === preset);
    });
  }

  async function refreshAuthStatus() {
    try {
      const res = await fetch('/auth/status');
      const payload = await res.json();
      const authorized = Boolean(payload.authorized);
      setAuthStatus(authorized);
      return authorized;
    } catch (error) {
      authStatusEl.textContent = 'Unable to check auth status.';
      return false;
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
    const workoutRows = JSON.parse(data.individual.workouts || '[]');
    let start = requestedStart;
    let end = requestedEnd;
    if (!start || !end) {
      const inferredRange = getDateRangeFromRows(combinedRows);
      if (!inferredRange) return;
      start = inferredRange.start;
      end = inferredRange.end;
    }

    const filteredCombinedRows = filterRowsToDateRange(combinedRows, start, end);
    const filteredSessionRows = filterRowsToDateRange(sessionRows, start, end);
    const filteredWorkoutRows = filterRowsToDateRange(workoutRows, start, end);

    const chartCanvas = document.getElementById('stressMeditationChart');
    if (chartCanvas && window.renderStressMeditationChart) {
      window.renderStressMeditationChart({
        combined: JSON.stringify(filteredCombinedRows),
        individual: {
          sessions: JSON.stringify(filteredSessionRows)
        }
      }, format);
    }

    const sleepContainer = document.getElementById('sleep-graph');
    const activityContainer = document.getElementById('activity-graph');
    const activityMetContainer = document.getElementById('activity-met-graph');
    const sedentaryContainer = document.getElementById('sedentary-graph');
    const stressRecoveryContainer = document.getElementById('stress-recovery-graph');
    const meditationContainer = document.getElementById('meditation-graph');
    const workoutContainer = document.getElementById('workout-graph');
    if (sleepContainer && activityContainer && activityMetContainer && sedentaryContainer && stressRecoveryContainer && meditationContainer && workoutContainer) {
      const dates = getDateRange(start, end);
      const maps = buildMetricMaps(filteredCombinedRows, filteredSessionRows);
      addWorkoutMetrics(filteredWorkoutRows, maps.workoutMinutesByDate, maps.workoutTypeCountsByDate);
      const sleepLevelData = toZScoreLevels(maps.sleepSecondsByDate, dates);
      const activityLevelData = toZScoreLevels(maps.stepsByDate, dates);
      const activityMetLevelData = toMetCompositionLevels(maps.metBucketsByDate, dates);
      const sedentaryLevelData = toSedentaryThresholdLevels(maps.sedentarySecondsByDate, dates);
      const stressRecoveryLevelData = toStressRecoveryBalanceLevels(maps.stressRecoveryByDate, dates);
      const meditationLevelData = toZScoreLevels(maps.meditationMinutesByDate, dates);
      const workoutLevelData = toZScoreLevels(maps.workoutMinutesByDate, dates);

      createContributionGraph(
        'sleep-graph',
        'Sleep:',
        sleepLevelData,
        formatSleepSeconds,
        {
          legendOptions: {
            tooltips: buildLegendRangeTooltips(
              sleepLevelData,
              [0, 1, 2, 3, 4],
              formatSleepSeconds,
              {},
              'No sleep data'
            )
          }
        }
      );
      renderSleepTimeDensityClocks(filteredCombinedRows);
      createContributionGraph(
        'activity-graph',
        'Steps:',
        activityLevelData,
        formatInteger,
        {
          legendOptions: {
            tooltips: buildLegendRangeTooltips(
              activityLevelData,
              [0, 1, 2, 3, 4],
              function(value) {
                return formatCountWithUnit(value, 'step', 'steps');
              },
              {},
              'No step data'
            )
          }
        }
      );
      createContributionGraph(
        'activity-met-graph',
        'Daily MET load:',
        activityMetLevelData,
        function(value) {
          return formatCountWithUnit(value, 'MET-minute', 'MET-minutes');
        },
        {
          cellColorBuilder: getMetCompositionColor,
          tooltipTextBuilder: function(day) {
            if (!day.buckets) {
              return `${day.date}: No MET data`;
            }
            const total = Number(day.value || 0);
            const buckets = day.buckets;
            const dominantLabel = MET_BUCKET_LABELS[day.dominantKey] || day.dominantKey;
            const percent = function(bucketValue) {
              if (total <= 0) return '0%';
              return `${Math.round((bucketValue / total) * 100)}%`;
            };
            return [
              day.date,
              `Total: ${formatCountWithUnit(total, 'MET-minute', 'MET-minutes')}`,
              `Dominant: ${dominantLabel}`,
              `High: ${percent(buckets.high)}`,
              `Medium: ${percent(buckets.medium)}`,
              `Low: ${percent(buckets.low)}`,
              `Sedentary: ${percent(buckets.sedentary)}`
            ].join('\n');
          },
          legendOptions: {
            startLabel: 'Mix',
            endLabel: 'Load',
            tooltips: [
              'No MET data',
              'Sedentary-dominant days. Darker = higher total MET-minutes; richer color = clearer dominance.',
              'Low-activity-dominant days. Darker = higher total MET-minutes; richer color = clearer dominance.',
              'Medium-activity-dominant days. Darker = higher total MET-minutes; richer color = clearer dominance.',
              'High-activity-dominant days. Darker = higher total MET-minutes; richer color = clearer dominance.'
            ]
          }
        }
      );
      createContributionGraph(
        'sedentary-graph',
        'Sedentary time:',
        sedentaryLevelData,
        formatSecondsAsDuration,
        {
          legendOptions: {
            tooltips: buildLegendRangeTooltips(
              sedentaryLevelData,
              [0, 1, 2, 3, 4],
              formatSecondsAsDuration,
              {},
              'No sedentary data'
            )
          }
        }
      );
      createContributionGraph(
        'stress-recovery-graph',
        'Stress/Recovery balance:',
        stressRecoveryLevelData,
        formatSecondsAsDuration,
        {
          tooltipTextBuilder: function(day) {
            if (day.stress === null || day.recovery === null) {
              return `${day.date}: No stress/recovery data`;
            }
            const direction = day.balance > 0
              ? 'Recovery-leaning'
              : day.balance < 0
                ? 'Stress-leaning'
                : 'Balanced';
            return `${day.date}: Stress ${formatSecondsAsDuration(day.stress)} | Recovery ${formatSecondsAsDuration(day.recovery)} (${direction})`;
          },
          legendOptions: {
            startLabel: 'More recovery',
            endLabel: 'More stress',
            levelOrder: [1, 2, 3, 4, 5, 6, 7],
            tooltips: buildLegendRangeTooltips(
              stressRecoveryLevelData,
              [1, 2, 3, 4, 5, 6, 7],
              formatSecondsAsDuration
            )
          }
        }
      );
      createContributionGraph(
        'meditation-graph',
        'Meditation minutes:',
        meditationLevelData,
        formatInteger,
        {
          legendOptions: {
            tooltips: buildLegendRangeTooltips(
              meditationLevelData,
              [0, 1, 2, 3, 4],
              function(value) {
                return formatCountWithUnit(value, 'minute', 'minutes');
              },
              {},
              'No meditation sessions'
            )
          }
        }
      );
      createContributionGraph(
        'workout-graph',
        'Workout minutes:',
        workoutLevelData,
        formatInteger,
        {
          tooltipTextBuilder: function(day, formattedValue) {
            const summary = formatWorkoutTypeSummary(maps.workoutTypeCountsByDate[day.date]);
            return `${day.date}: Workout minutes ${formattedValue} | ${summary}`;
          },
          legendOptions: {
            tooltips: buildLegendRangeTooltips(
              workoutLevelData,
              [0, 1, 2, 3, 4],
              function(value) {
                return formatCountWithUnit(value, 'minute', 'minutes');
              },
              {},
              'No workouts'
            )
          }
        }
      );
    }
  }

  function loadCachedDataForCurrentRange() {
    const start = startInput.value;
    const end = endInput.value;
    const cached = isStressPage ? loadDailyCache() : loadDailyCacheForRange(start, end);
    if (!cached) return false;

    const renderStart = isStressPage ? cached.start : start;
    const renderEnd = isStressPage ? cached.end : end;
    renderFetchedData(cached.data, renderStart, renderEnd, 'json');
    if (!resultDiv.textContent) {
      resultDiv.textContent = 'Loaded saved data from today.';
    }
    return true;
  }

  async function loadOrFetchRange(start, end) {
    startInput.value = start;
    endInput.value = end;

    const cached = loadDailyCacheForRange(start, end);
    if (cached) {
      resultDiv.textContent = 'Loaded saved data from today.';
      renderFetchedData(cached.data, start, end, 'json');
      return true;
    }

    try {
      resultDiv.textContent = 'Loading data...';
      const res = await fetch('/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start, end, format: 'json' })
      });
      const payload = await res.json();
      if (!payload.success) {
        resultDiv.textContent = `Error: ${payload.error}`;
        return false;
      }
      resultDiv.textContent = 'Loaded data.';
      renderFetchedData(payload.data, start, end, 'json');
      saveDailyCache(start, end, payload.data);
      return true;
    } catch (error) {
      resultDiv.textContent = `Error: ${error.message}`;
      return false;
    }
  }

  (async function initializePage() {
    const authorized = await refreshAuthStatus();
    if (isStressPage) {
      if (authorized) {
        await loadOrFetchRange(defaultRange.start, defaultRange.end);
      }
      return;
    }

    const savedDataLoaded = loadCachedDataForCurrentRange();
    if (!savedDataLoaded && authorized) {
      await loadOrFetchRange(defaultRange.start, defaultRange.end);
    }
  })();

  if (rangeButtons.length > 0) {
    rangeButtons.forEach(button => {
      button.addEventListener('click', async function() {
        const presetRange = getPresetRange(button.dataset.range);
        setActiveRangeButton(button.dataset.range);
        await loadOrFetchRange(presetRange.start, presetRange.end);
      });
    });
  }

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    const start = document.getElementById('start').value;
    const end = document.getElementById('end').value;
    setActiveRangeButton(null);
    await loadOrFetchRange(start, end);
  });
});
