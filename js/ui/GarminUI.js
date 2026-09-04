/** UI wiring for manual Garmin metrics and JSON/TCX imports. */

import { saveGarminMetrics, parseGarminWorkoutFile } from '../services/GarminService.js';

export function initGarminController(state) {
  const btnToggle = document.getElementById('btn-garmin-toggle');
  const garminCard = document.getElementById('garmin-card');
  const btnImport = document.getElementById('btn-garmin-import');
  const fileInput = document.getElementById('garmin-file-input');
  const dropZone = document.getElementById('garmin-drop-zone');

  if (btnToggle && garminCard) {
    btnToggle.onclick = () => {
      garminCard.style.display = garminCard.style.display !== 'none' ? 'none' : 'block';
    };
  }

  if (btnImport && fileInput) {
    btnImport.onclick = () => fileInput.click();
    fileInput.onchange = event => {
      const file = event.target.files[0];
      if (file) parseGarminWorkoutFile(file, state);
      fileInput.value = '';
    };
  }

  if (dropZone) {
    dropZone.ondragover = event => {
      event.preventDefault();
      dropZone.classList.add('dragover');
    };
    dropZone.ondragleave = () => dropZone.classList.remove('dragover');
    dropZone.ondrop = event => {
      event.preventDefault();
      dropZone.classList.remove('dragover');
      const file = event.dataTransfer.files?.[0];
      if (file) parseGarminWorkoutFile(file, state);
    };
  }

  window.saveGarminMetrics = () => saveGarminMetrics(state);
}

export function renderGarminMetrics(state) {
  const metrics = state.logs[state.selectedDateStr]?.garminData ?? {};
  const inputAvg = document.getElementById('garmin-avg-hr');
  const inputMax = document.getElementById('garmin-max-hr');
  const inputKcal = document.getElementById('garmin-kcals');

  if (inputAvg) inputAvg.value = metrics.avgHr ?? '';
  if (inputMax) inputMax.value = metrics.maxHr ?? '';
  if (inputKcal) inputKcal.value = metrics.kcals ?? '';

  const btn = document.getElementById('btn-garmin-toggle');
  if (btn) btn.textContent = metrics.avgHr
    ? `[GARMIN DATA: ${metrics.avgHr} BPM • ${metrics.kcals ?? 0} KCAL]`
    : '[GARMIN DATA]';
}
