/**
 * Garmin metric persistence and limited JSON/TCX import.
 * No Garmin authentication, cloud API, live polling, FIT decoding, or GPX
 * parsing is implemented in this application.
 */

import { save } from './StorageService.js';

function readMetricInput(id) {
  const value = Number.parseInt(document.getElementById(id).value, 10);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export function saveGarminMetrics(state) {
  if (!state.logs[state.selectedDateStr]) state.logs[state.selectedDateStr] = {};

  const avgHr = readMetricInput('garmin-avg-hr');
  const maxHr = readMetricInput('garmin-max-hr');
  const kcals = readMetricInput('garmin-kcals');

  state.logs[state.selectedDateStr].garminData = { avgHr, maxHr, kcals };
  save(state.logs);

  const btn = document.getElementById('btn-garmin-toggle');
  if (btn) btn.textContent = avgHr > 0
    ? `[GARMIN DATA: ${avgHr} BPM • ${kcals} KCAL]`
    : '[GARMIN DATA]';
}

function optionalNonNegativeInteger(...values) {
  const raw = values.find(value => value !== undefined && value !== null && value !== '');
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseJsonMetrics(text) {
  const parsed = JSON.parse(text);
  return {
    avgHr: optionalNonNegativeInteger(parsed.averageHR, parsed.avgHr),
    maxHr: optionalNonNegativeInteger(parsed.maxHR, parsed.maxHr),
    kcals: optionalNonNegativeInteger(parsed.calories, parsed.kcals),
  };
}

function parseTcxMetrics(text) {
  const documentNode = new DOMParser().parseFromString(text, 'application/xml');
  if (documentNode.querySelector('parsererror')) {
    throw new Error('The selected file is not valid XML.');
  }

  if (documentNode.documentElement.localName !== 'TrainingCenterDatabase') {
    throw new Error('The selected file is not a TCX TrainingCenterDatabase document.');
  }

  const firstByLocalName = (root, localName) =>
    root.getElementsByTagNameNS('*', localName)[0] ?? null;

  const heartRateValue = localName => {
    const container = firstByLocalName(documentNode, localName);
    return container ? firstByLocalName(container, 'Value')?.textContent.trim() : null;
  };

  return {
    avgHr: optionalNonNegativeInteger(heartRateValue('AverageHeartRateBpm')),
    maxHr: optionalNonNegativeInteger(heartRateValue('MaximumHeartRateBpm')),
    kcals: optionalNonNegativeInteger(firstByLocalName(documentNode, 'Calories')?.textContent.trim()),
  };
}

export function parseGarminWorkoutFile(file, state) {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!['json', 'tcx'].includes(extension)) {
    alert('[GARMIN DATA] UNSUPPORTED FILE. USE JSON OR TCX.');
    return;
  }

  const reader = new FileReader();
  reader.onerror = () => alert('[GARMIN DATA] FILE COULD NOT BE READ.');
  reader.onload = (event) => {
    try {
      const metrics = extension === 'json'
        ? parseJsonMetrics(event.target.result)
        : parseTcxMetrics(event.target.result);

      if (Object.values(metrics).every(value => value === null)) {
        throw new Error('No supported heart-rate or calorie metrics were found.');
      }

      const current = state.logs[state.selectedDateStr]?.garminData ?? {};
      const avgHr = metrics.avgHr ?? current.avgHr ?? 0;
      const maxHr = metrics.maxHr ?? current.maxHr ?? 0;
      const kcals = metrics.kcals ?? current.kcals ?? 0;

      document.getElementById('garmin-avg-hr').value = avgHr;
      document.getElementById('garmin-max-hr').value = maxHr;
      document.getElementById('garmin-kcals').value = kcals;
      saveGarminMetrics(state);

      const statusBar = document.getElementById('garmin-status-bar');
      if (statusBar) statusBar.textContent = `STATUS: IMPORTED ${file.name}`;
      alert(`[GARMIN DATA] IMPORTED METRICS:\n\nAVG HR: ${avgHr} BPM\nMAX HR: ${maxHr} BPM\nENERGY: ${kcals} KCAL`);
    } catch (error) {
      alert(`[GARMIN DATA] IMPORT FAILED: ${error.message}`);
    }
  };
  reader.readAsText(file);
}
