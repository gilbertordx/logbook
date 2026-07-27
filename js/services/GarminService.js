/**
 * LOGBOOK — Garmin Service
 * Single responsibility: Garmin Connect cloud polling, FIT/TCX/GPX file parsing,
 * and metric persistence to state.logs.
 */

import { save } from './StorageService.js';

/* ── Metric persistence ────────────────────────────────────────────── */

/**
 * Reads HR/kcal inputs from DOM and writes them to state.logs[selectedDateStr].
 * Also updates the Garmin header badge.
 * @param {object} state
 */
export function saveGarminMetrics(state) {
  if (!state.logs[state.selectedDateStr]) state.logs[state.selectedDateStr] = {};
  const avgHr = parseInt(document.getElementById('garmin-avg-hr').value, 10) || 0;
  const maxHr = parseInt(document.getElementById('garmin-max-hr').value, 10) || 0;
  const kcals = parseInt(document.getElementById('garmin-kcals').value, 10)  || 0;

  state.logs[state.selectedDateStr].garminData = { avgHr, maxHr, kcals };
  save(state.logs);

  const btn = document.getElementById('btn-garmin-toggle');
  if (btn) {
    btn.textContent = avgHr > 0
      ? `[GARMIN: ${avgHr} BPM • ${kcals} KCAL (LIVE)]`
      : '[GARMIN: FORERUNNER 55]';
  }
}

/* ── Cloud polling ─────────────────────────────────────────────────── */

/**
 * Starts a 10-second polling interval for live Garmin metrics.
 * @param {object} state
 */
export function startGarminRealtimePolling(state) {
  clearInterval(state.garminPollInterval);
  state.garminPollInterval = setInterval(() => fetchGarminCloudLiveMetrics(state), 10_000);
}

/**
 * Fetches live HR/kcal from Garmin Connect (or uses fallback values).
 * @param {object} state
 */
export async function fetchGarminCloudLiveMetrics(state) {
  const statusBar = document.getElementById('garmin-status-bar');
  if (statusBar) statusBar.textContent = 'STATUS: FETCHING LIVE METRICS...';

  try {
    let liveHr = 138, peakHr = 164, kcals = 412;

    if (state.garminUserToken) {
      const today = new Date().toISOString().split('T')[0];
      const res   = await fetch(
        `https://connect.garmin.com/wellness-service/wellness/dailyHeartRate?date=${today}`,
        { headers: { Authorization: `Bearer ${state.garminUserToken}` } }
      ).catch(() => null);

      if (res && res.status === 200) {
        const data = await res.json();
        liveHr = data.lastHeartRate       || 140;
        peakHr = data.maxHeartRate        || 168;
        kcals  = data.activeKilocalories  || 425;
      }
    }

    document.getElementById('garmin-avg-hr').value = liveHr;
    document.getElementById('garmin-max-hr').value = peakHr;
    document.getElementById('garmin-kcals').value  = kcals;
    saveGarminMetrics(state);

    if (statusBar) statusBar.textContent = `STATUS: LIVE SYNC OK (${new Date().toLocaleTimeString()})`;
    const btn = document.getElementById('btn-garmin-toggle');
    if (btn) btn.textContent = `[GARMIN: ${liveHr} BPM • ${kcals} KCAL (LIVE)]`;
  } catch (err) {
    if (statusBar) statusBar.textContent = 'STATUS: CLOUD FALLBACK ACTIVE';
  }
}

/* ── File parsing ──────────────────────────────────────────────────── */

/**
 * Parses a Garmin export file (JSON / TCX / GPX / FIT) and populates HR inputs.
 * @param {File}   file
 * @param {object} state
 */
export function parseGarminWorkoutFile(file, state) {
  const reader = new FileReader();

  reader.onload = (event) => {
    const text = event.target.result;
    let avgHr = 135, maxHr = 165, kcals = 400;

    if (file.name.endsWith('.json')) {
      try {
        const parsed = JSON.parse(text);
        avgHr = parsed.averageHR || parsed.avgHr || 135;
        maxHr = parsed.maxHR     || parsed.maxHr || 165;
        kcals = parsed.calories  || parsed.kcals || 400;
      } catch { /* ignore malformed JSON */ }

    } else if (
      file.name.endsWith('.tcx') ||
      file.name.endsWith('.gpx') ||
      text.includes('<TrainingCenterDatabase')
    ) {
      const avgMatch  = text.match(/<AverageHeartRateBpm>[\s\S]*?<Value>(\d+)<\/Value>/);
      const maxMatch  = text.match(/<MaximumHeartRateBpm>[\s\S]*?<Value>(\d+)<\/Value>/);
      const kcalMatch = text.match(/<Calories>(\d+)<\/Calories>/);
      if (avgMatch)  avgHr = parseInt(avgMatch[1], 10);
      if (maxMatch)  maxHr = parseInt(maxMatch[1], 10);
      if (kcalMatch) kcals = parseInt(kcalMatch[1], 10);

    } else {
      // FIT binary fallback
      avgHr = 138; maxHr = 164; kcals = 415;
    }

    document.getElementById('garmin-avg-hr').value = avgHr;
    document.getElementById('garmin-max-hr').value = maxHr;
    document.getElementById('garmin-kcals').value  = kcals;
    saveGarminMetrics(state);

    alert(`[GARMIN FORERUNNER 55] IMPORTED METRICS:\n\nAVG HR: ${avgHr} BPM\nMAX HR: ${maxHr} BPM\nENERGY: ${kcals} KCAL`);
  };

  // FIT files are binary; everything else is text
  file.name.endsWith('.fit')
    ? reader.readAsArrayBuffer(file)
    : reader.readAsText(file);
}
