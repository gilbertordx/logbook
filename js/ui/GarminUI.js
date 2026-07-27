/**
 * LOGBOOK — Garmin UI
 * Single responsibility: wire Garmin card DOM events and render metric inputs.
 * Delegates all API/file logic to GarminService.
 */

import {
  saveGarminMetrics,
  fetchGarminCloudLiveMetrics,
  parseGarminWorkoutFile,
  startGarminRealtimePolling,
} from '../services/GarminService.js';

/**
 * Initialises the Garmin card: toggle, connect, fetch-live, import, drag-drop.
 * Also exposes window.saveGarminMetrics for inline `onchange` handlers in HTML.
 * @param {object} state
 */
export function initGarminController(state) {
  const btnToggle   = document.getElementById('btn-garmin-toggle');
  const garminCard  = document.getElementById('garmin-card');
  const btnConnect  = document.getElementById('btn-garmin-connect');
  const btnFetchLive = document.getElementById('btn-garmin-fetch-live');
  const btnImport   = document.getElementById('btn-garmin-import');
  const fileInput   = document.getElementById('garmin-file-input');
  const dropZone    = document.getElementById('garmin-drop-zone');

  // Restore session token
  state.garminUserToken = localStorage.getItem('tbjp_garmin_token');
  if (state.garminUserToken && btnConnect) {
    btnConnect.textContent = '[CONNECTED]';
    startGarminRealtimePolling(state);
  }

  // Toggle card visibility
  if (btnToggle && garminCard) {
    btnToggle.onclick = () => {
      garminCard.style.display = garminCard.style.display !== 'none' ? 'none' : 'block';
    };
  }

  // Connect / disconnect
  if (btnConnect) {
    btnConnect.onclick = () => {
      const token = prompt(
        '[GARMIN CONNECT CLOUD AUTO-SYNC]\n\nEnter Garmin Connect OAuth Token / Username Key:\n(Leave blank to disconnect)',
        state.garminUserToken || ''
      );
      if (token === null) return;

      const statusBar = document.getElementById('garmin-status-bar');
      if (token.trim() === '') {
        localStorage.removeItem('tbjp_garmin_token');
        state.garminUserToken = null;
        btnConnect.textContent = '[CONNECT ACCOUNT]';
        clearInterval(state.garminPollInterval);
        if (statusBar) statusBar.textContent = 'STATUS: DISCONNECTED';
      } else {
        state.garminUserToken = token.trim();
        localStorage.setItem('tbjp_garmin_token', state.garminUserToken);
        btnConnect.textContent = '[CONNECTED]';
        if (statusBar) statusBar.textContent = 'STATUS: REAL-TIME CLOUD SYNC ACTIVE';
        startGarminRealtimePolling(state);
        fetchGarminCloudLiveMetrics(state);
      }
    };
  }

  // Manual fetch
  if (btnFetchLive) {
    btnFetchLive.onclick = () => fetchGarminCloudLiveMetrics(state);
  }

  // File import button
  if (btnImport && fileInput) {
    btnImport.onclick        = () => fileInput.click();
    fileInput.onchange       = (e) => {
      const file = e.target.files[0];
      if (file) parseGarminWorkoutFile(file, state);
    };
  }

  // Drag-and-drop zone
  if (dropZone) {
    dropZone.ondragover  = (e) => { e.preventDefault(); dropZone.classList.add('dragover'); };
    dropZone.ondragleave = ()  => dropZone.classList.remove('dragover');
    dropZone.ondrop      = (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer.files?.[0]) parseGarminWorkoutFile(e.dataTransfer.files[0], state);
    };
  }

  // Expose for inline onchange on garmin number inputs in index.html
  window.saveGarminMetrics = () => saveGarminMetrics(state);
}

/**
 * Populates the Garmin metric inputs from the current day's stored garminData.
 * Also updates the header badge.
 * @param {object} state
 */
export function renderGarminMetrics(state) {
  const entry = state.logs[state.selectedDateStr];
  const g     = entry?.garminData ?? { avgHr: '', maxHr: '', kcals: '' };

  const inputAvg  = document.getElementById('garmin-avg-hr');
  const inputMax  = document.getElementById('garmin-max-hr');
  const inputKcal = document.getElementById('garmin-kcals');

  if (inputAvg)  inputAvg.value  = g.avgHr ?? '';
  if (inputMax)  inputMax.value  = g.maxHr ?? '';
  if (inputKcal) inputKcal.value = g.kcals ?? '';

  const btn = document.getElementById('btn-garmin-toggle');
  if (btn) {
    btn.textContent = g.avgHr
      ? `[GARMIN: ${g.avgHr} BPM • ${g.kcals} KCAL (LIVE)]`
      : '[GARMIN: FORERUNNER 55]';
  }
}
