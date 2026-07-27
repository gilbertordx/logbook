/**
 * LOGBOOK — Storage Service
 * Single responsibility: localStorage read/write, seed data, export/import.
 * Does NOT touch GitHub or any remote API.
 */

import { DEFAULT_ROUTINE } from '../config/constants.js';
import { formatDateKey }   from '../utils/dateUtils.js';

const STORAGE_KEY = 'tbjp_logbook_dmy_v18';

/* ── Historical seed data ─────────────────────────────────────────── */

function getHistoricalTestData() {
  return {
    '12/07/26': {
      armMode: 'STRAIGHT',
      durationSeconds: 2400,
      garminData: { avgHr: 128, maxHr: 155, kcals: 340 },
      exercises: [
        { name: 'DEAD-BUG',  category: 'MOBILITY', discomfort: 'NO DISCOMFORT', sets: [{ type: 'WORK', weight: 0, reps: 6, rir: 1 }, { type: 'WORK', weight: 0, reps: 8, rir: 1 }] },
        { name: 'BIRD-DOG',  category: 'MOBILITY', discomfort: 'NO DISCOMFORT', sets: [{ type: 'WORK', weight: 0, reps: 6, rir: 1 }, { type: 'WORK', weight: 0, reps: 8, rir: 1 }] },
        { name: 'CABLE LOW ROW (SHRUG AT END)', category: 'CABLE', discomfort: 'NO DISCOMFORT', sets: [{ type: 'WARMUP', weight: 40, reps: 6 }, { type: 'WARMUP', weight: 55, reps: 3 }, { type: 'WARMUP', weight: 65, reps: 2 }, { type: 'WORK', weight: 75, reps: 5, shrugReps: 3, rir: 1 }, { type: 'WORK', weight: 70, reps: 6, shrugReps: 3, rir: 1 }] },
        { name: 'ASSISTED CHIN', category: 'ASSISTED', discomfort: 'NO DISCOMFORT', sets: [{ type: 'WARMUP', weight: 25, reps: 5 }, { type: 'WORK', weight: 20, reps: 5, rir: 1 }, { type: 'WORK', weight: 15, reps: 6, rir: 1 }] },
        { name: 'LOW-INCLINE DB PRESS', category: 'DUMBBELL', discomfort: 'NO DISCOMFORT', sets: [{ type: 'WARMUP', weight: 16, reps: 6 }, { type: 'WARMUP', weight: 24, reps: 3 }, { type: 'WARMUP', weight: 28, reps: 2 }, { type: 'WORK', weight: 34, reps: 5, rir: 1 }, { type: 'WORK', weight: 30, reps: 6, rir: 1 }] },
        { name: 'INCLINE DB REAR DELT (SHRUG AT END)', category: 'DUMBBELL', discomfort: 'NO DISCOMFORT', sets: [{ type: 'WORK', weight: 12, reps: 6, shrugReps: 3, rir: 1 }, { type: 'WORK', weight: 10, reps: 7, shrugReps: 3, rir: 1 }] },
        { name: 'CABLE UPRIGHT ROW (SHRUG AT END)', category: 'CABLE', discomfort: 'NO DISCOMFORT', sets: [{ type: 'WORK', weight: 40, reps: 5, shrugReps: 3, rir: 1 }, { type: 'WORK', weight: 35, reps: 6, shrugReps: 3, rir: 1 }] },
        { name: 'CABLE OH EXT', category: 'CABLE', discomfort: 'LEFT ULNAR NERVE', isArm: true, sets: [{ type: 'WORK', weight: 30, reps: 6, rir: 1 }, { type: 'WORK', weight: 25, reps: 6, rir: 1 }] },
        { name: 'CABLE CURL',  category: 'CABLE', discomfort: 'NO DISCOMFORT',    isArm: true, sets: [{ type: 'WORK', weight: 25, reps: 6, rir: 1 }, { type: 'WORK', weight: 20, reps: 6, rir: 1 }] },
      ],
    },
    '17/07/26': {
      armMode: 'STRAIGHT',
      durationSeconds: 2580,
      garminData: { avgHr: 135, maxHr: 162, kcals: 385 },
      exercises: [
        { name: 'DEAD-BUG',  category: 'MOBILITY', discomfort: 'NO DISCOMFORT', sets: [{ type: 'WORK', weight: 0, reps: 8, rir: 1 }, { type: 'WORK', weight: 0, reps: 10, rir: 1 }] },
        { name: 'BIRD-DOG',  category: 'MOBILITY', discomfort: 'FEMORAL HEAD',  sets: [{ type: 'WORK', weight: 0, reps: 8, rir: 1 }, { type: 'WORK', weight: 0, reps: 10, rir: 1 }] },
        { name: 'CABLE LOW ROW (SHRUG AT END)', category: 'CABLE', discomfort: 'NO DISCOMFORT', sets: [{ type: 'WARMUP', weight: 40, reps: 6 }, { type: 'WARMUP', weight: 55, reps: 3 }, { type: 'WARMUP', weight: 70, reps: 2 }, { type: 'WORK', weight: 80, reps: 5, shrugReps: 3, rir: 1 }, { type: 'WORK', weight: 75, reps: 6, shrugReps: 3, rir: 1 }] },
        { name: 'ASSISTED CHIN', category: 'ASSISTED', discomfort: 'NO DISCOMFORT', sets: [{ type: 'WARMUP', weight: 20, reps: 5 }, { type: 'WORK', weight: 15, reps: 5, rir: 1 }, { type: 'WORK', weight: 10, reps: 6, rir: 1 }] },
        { name: 'LOW-INCLINE DB PRESS', category: 'DUMBBELL', discomfort: 'NO DISCOMFORT', sets: [{ type: 'WARMUP', weight: 18, reps: 6 }, { type: 'WARMUP', weight: 26, reps: 3 }, { type: 'WARMUP', weight: 30, reps: 2 }, { type: 'WORK', weight: 36, reps: 5, rir: 1 }, { type: 'WORK', weight: 32, reps: 6, rir: 1 }] },
        { name: 'INCLINE DB REAR DELT (SHRUG AT END)', category: 'DUMBBELL', discomfort: 'NO DISCOMFORT', sets: [{ type: 'WORK', weight: 14, reps: 6, shrugReps: 3, rir: 1 }, { type: 'WORK', weight: 12, reps: 7, shrugReps: 3, rir: 1 }] },
        { name: 'CABLE UPRIGHT ROW (SHRUG AT END)', category: 'CABLE', discomfort: 'NO DISCOMFORT', sets: [{ type: 'WORK', weight: 45, reps: 5, shrugReps: 3, rir: 1 }, { type: 'WORK', weight: 40, reps: 6, shrugReps: 3, rir: 1 }] },
        { name: 'CABLE OH EXT', category: 'CABLE', discomfort: 'NO DISCOMFORT', isArm: true, sets: [{ type: 'WORK', weight: 35, reps: 6, rir: 1 }, { type: 'WORK', weight: 30, reps: 6, rir: 1 }] },
        { name: 'CABLE CURL',  category: 'CABLE', discomfort: 'NO DISCOMFORT', isArm: true, sets: [{ type: 'WORK', weight: 30, reps: 6, rir: 1 }, { type: 'WORK', weight: 25, reps: 6, rir: 1 }] },
      ],
    },
    '24/07/26': JSON.parse(JSON.stringify(DEFAULT_ROUTINE)),
  };
}

/* ── Public API ────────────────────────────────────────────────────── */

/**
 * Loads logs from localStorage. Seeds with historical data on first run.
 * @param {string} todayStr  DD/MM/YY — used to stamp today's default entry
 * @returns {object}  logs map
 */
export function load(todayStr) {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch { return {}; }
  }
  const data = getHistoricalTestData();
  data[todayStr] = JSON.parse(JSON.stringify(DEFAULT_ROUTINE));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  return data;
}

/**
 * Persists logs to localStorage.
 * @param {object} logs
 */
export function save(logs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
}

/**
 * Wires up the Export and Import buttons.
 * @param {object}   state
 * @param {function} refresh  () => void — called after successful import
 */
export function initExportImport(state, refresh) {
  document.getElementById('btn-export').onclick = () => {
    const dataStr   = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state.logs, null, 2));
    const dlAnchor  = document.createElement('a');
    const dateSlug  = formatDateKey(new Date()).replace(/\//g, '-');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `logbook_backup_${dateSlug}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  };

  const fileInput = document.getElementById('import-file');
  document.getElementById('btn-import').onclick = () => fileInput.click();

  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported  = JSON.parse(event.target.result);
        state.logs      = { ...state.logs, ...imported };
        save(state.logs);
        refresh();
        alert('[SYSTEM] DATA IMPORT SUCCESSFUL.');
      } catch {
        alert('[ERROR] INVALID BACKUP FILE.');
      }
    };
    reader.readAsText(file);
  };
}
