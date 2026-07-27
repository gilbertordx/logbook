/**
 * LOGBOOK — Log Panel UI
 * Single responsibility: render the daily exercise log and wire all log-panel
 * button handlers. Inline HTML event handlers are exposed on window so that
 * dynamically-generated HTML strings can call them without bundler changes.
 *
 * Bug fixed: removeSet() previously called exercises.splice(setIdx, 1) instead
 * of exercises[exIdx].sets.splice(setIdx, 1), deleting the exercise instead.
 */

import { save }               from '../services/StorageService.js';
import { syncToGitHub }       from '../services/GitHubSyncService.js';
import { triggerPersonalizedVibe } from '../services/SpotifyService.js';
import { DEFAULT_ROUTINE }    from '../config/constants.js';
import {
  calculateE1RM,
  calculateSmartTargetLoad,
  findPreviousSetData,
  formatWorkSetLabel,
} from '../utils/mathUtils.js';
import {
  generateKgOptions,
  generateRepsOptions,
  generateShrugRepsOptions,
  generateDiscomfortOptions,
} from './DropdownHelpers.js';
import { renderMuscleGroupStats } from './WorkSetsStatsUI.js';
import { renderGarminMetrics }    from './GarminUI.js';

/* ── Init ──────────────────────────────────────────────────────────── */

/**
 * Wires the log-panel action buttons and registers all window-scoped handlers
 * needed by dynamically-rendered HTML.
 *
 * @param {object}   state
 * @param {function} refresh  () => void — full re-render (calendar + log panel)
 */
export function initLogPanel(state, refresh) {
  // Load routine
  document.getElementById('btn-load-routine').onclick = () => {
    state.logs[state.selectedDateStr] = JSON.parse(JSON.stringify(DEFAULT_ROUTINE));
    save(state.logs);
    refresh();
  };

  // Clear day
  document.getElementById('btn-clear').onclick = () => {
    if (!state.logs[state.selectedDateStr]) return;
    state.lastClearedState = {
      dateKey: state.selectedDateStr,
      data:    JSON.parse(JSON.stringify(state.logs[state.selectedDateStr])),
    };
    delete state.logs[state.selectedDateStr];
    save(state.logs);
    document.getElementById('btn-undo').style.display = 'inline-block';
    refresh();
  };

  // Undo clear
  document.getElementById('btn-undo').onclick = () => {
    if (!state.lastClearedState) return;
    state.logs[state.lastClearedState.dateKey] = state.lastClearedState.data;
    state.lastClearedState = null;
    save(state.logs);
    document.getElementById('btn-undo').style.display = 'none';
    refresh();
  };

  // Add exercise
  document.getElementById('btn-add-ex').onclick = () => {
    if (!state.logs[state.selectedDateStr]) {
      state.logs[state.selectedDateStr] = { exercises: [] };
    }
    state.logs[state.selectedDateStr].exercises.push({
      name:      'NEW EXERCISE',
      category:  'CABLE',
      discomfort: 'NO DISCOMFORT',
      sets: [{ type: 'WORK', weight: 20, reps: 5, rir: 1 }],
    });
    renderSelectedDate(state, refresh);
  };

  // Save & sync
  document.getElementById('btn-save').onclick = () => {
    save(state.logs);
    refresh();
    syncToGitHub(state);
  };

  // Register global window handlers for inline HTML event attributes
  _registerWindowHandlers(state, refresh);
}

/* ── Window handlers ────────────────────────────────────────────────
 * ES Modules do not expose symbols to global scope, so HTML onclick="..."
 * attributes cannot call module functions directly. We bridge this by
 * attaching closures (bound to state/refresh) onto window once at init.
 * ──────────────────────────────────────────────────────────────────── */

function _registerWindowHandlers(state, refresh) {

  window.handleKgChange = (exIdx, setIdx, valStr) => {
    const key = `${exIdx}_${setIdx}`;
    if (valStr === '__MORE__')  { state.expandedKgSet[key] = true;  renderSelectedDate(state, refresh); }
    else if (valStr === '__LESS__') { delete state.expandedKgSet[key]; renderSelectedDate(state, refresh); }
    else _updateSet(state, exIdx, setIdx, 'weight', parseFloat(valStr) || 0, refresh);
  };

  window.handleRepsChange = (exIdx, setIdx, valStr) => {
    const key = `${exIdx}_${setIdx}`;
    if (valStr === '__MORE__')  { state.expandedRepsSet[key] = true;  renderSelectedDate(state, refresh); }
    else if (valStr === '__LESS__') { delete state.expandedRepsSet[key]; renderSelectedDate(state, refresh); }
    else _updateSet(state, exIdx, setIdx, 'reps', parseInt(valStr, 10) || 0, refresh);
  };

  window.handleShrugChange = (exIdx, setIdx, valStr) => {
    const key = `${exIdx}_${setIdx}`;
    if (valStr === '__MORE__')  { state.expandedShrugSet[key] = true;  renderSelectedDate(state, refresh); }
    else if (valStr === '__LESS__') { delete state.expandedShrugSet[key]; renderSelectedDate(state, refresh); }
    else _updateSet(state, exIdx, setIdx, 'shrugReps', parseInt(valStr, 10) || 0, refresh);
  };

  // Generic field update (used for RIR select)
  window.updateSet = (exIdx, setIdx, field, val) => {
    _updateSet(state, exIdx, setIdx, field, val, refresh);
  };

  // Exercise name (replaces the former unsafe inline assignment)
  window.updateExName = (exIdx, val) => {
    state.logs[state.selectedDateStr].exercises[exIdx].name = val.toUpperCase();
    // No save/re-render needed on every keystroke; saved on next action.
  };

  // Discomfort dropdown
  window.updateExDiscomfort = (exIdx, val) => {
    state.logs[state.selectedDateStr].exercises[exIdx].discomfort = val;
    save(state.logs);
    renderSelectedDate(state, refresh);
  };

  // Toggle WARMUP ↔ WORK; triggers workout vibe on WORK
  window.toggleSetType = (exIdx, setIdx) => {
    const sets  = state.logs[state.selectedDateStr].exercises[exIdx].sets;
    const cur   = sets[setIdx].type;
    sets[setIdx].type = cur === 'WARMUP' ? 'WORK' : 'WARMUP';
    if (sets[setIdx].type === 'WORK') {
      sets[setIdx].rir = 1;
      triggerPersonalizedVibe('workset', state);
    }
    save(state.logs);
    renderSelectedDate(state, refresh);
  };

  // ── BUGFIX: was exercises.splice(setIdx, 1) — deleted wrong index ──
  window.removeSet = (exIdx, setIdx) => {
    state.logs[state.selectedDateStr].exercises[exIdx].sets.splice(setIdx, 1);
    save(state.logs);
    renderSelectedDate(state, refresh);
  };

  window.removeEx = (exIdx) => {
    state.logs[state.selectedDateStr].exercises.splice(exIdx, 1);
    save(state.logs);
    renderSelectedDate(state, refresh);
  };

  window.addSet = (exIdx, setType = 'WORK') => {
    const ex   = state.logs[state.selectedDateStr].exercises[exIdx];
    const last = ex.sets[ex.sets.length - 1] || { weight: 0, reps: 5, rir: 1 };
    ex.sets.push({ ...last, type: setType, rir: setType === 'WORK' ? 1 : 3 });
    save(state.logs);
    renderSelectedDate(state, refresh);
  };

  window.toggleArmMode = () => {
    if (!state.logs[state.selectedDateStr]) return;
    const cur = state.logs[state.selectedDateStr].armMode || 'STRAIGHT';
    state.logs[state.selectedDateStr].armMode = cur === 'STRAIGHT' ? 'ZIGZAG' : 'STRAIGHT';
    save(state.logs);
    renderSelectedDate(state, refresh);
  };

  window.toggleWorkSetsExpand = () => {
    state.isWorkSetsExpanded = !state.isWorkSetsExpanded;
    renderSelectedDate(state, refresh);
  };
}

/* ── Internal helpers ──────────────────────────────────────────────── */

function _updateSet(state, exIdx, setIdx, field, val, refresh) {
  state.logs[state.selectedDateStr].exercises[exIdx].sets[setIdx][field] = val;
  save(state.logs);
  renderSelectedDate(state, refresh);
}

/* ── Render ────────────────────────────────────────────────────────── */

/**
 * Full re-render of the log panel for the currently selected date.
 * @param {object}   state
 * @param {function} refresh  () => void — passed through to child renders if needed
 */
export function renderSelectedDate(state, refresh) {  // eslint-disable-line no-unused-vars
  document.getElementById('log-date').textContent = state.selectedDateStr;

  const container = document.getElementById('exercise-container');
  const actions   = document.getElementById('log-actions');
  const entry     = state.logs[state.selectedDateStr];

  renderGarminMetrics(state);

  if (!entry) {
    container.innerHTML =
      `<div class="empty-msg">[NO LOGGED SESSION FOR ${state.selectedDateStr}]<br><br>` +
      `Click [LOAD ROUTINE] above to load exercises.</div>`;
    actions.style.display = 'none';
    renderMuscleGroupStats(null, state.isWorkSetsExpanded);
    return;
  }

  renderMuscleGroupStats(entry, state.isWorkSetsExpanded);
  actions.style.display = 'flex';
  container.innerHTML   = '';

  const armMode = entry.armMode || 'STRAIGHT';
  let hasRenderedMobilityDivider = false;
  let hasRenderedLiftsDivider    = false;
  let hasRenderedArmDivider      = false;

  entry.exercises.forEach((ex, exIdx) => {
    const isMobility = ex.category === 'MOBILITY' || ex.name.includes('BUG') || ex.name.includes('DOG');
    const isAssisted = ex.category === 'ASSISTED' || ex.name.includes('ASSISTED');
    const hasShrugs  = ex.name.toUpperCase().includes('SHRUG');
    const isArm      = ex.isArm || ex.name.includes('OH EXT') || ex.name.includes('CURL');

    /* Section dividers */
    if (isMobility && !hasRenderedMobilityDivider) {
      container.appendChild(_divider('// SECTION: <span>MOBILITY &amp; ACTIVATION</span>'));
      hasRenderedMobilityDivider = true;
    } else if (!isMobility && !isArm && !hasRenderedLiftsDivider) {
      container.appendChild(_divider('// SECTION: <span>WORKING LIFTS</span>'));
      hasRenderedLiftsDivider = true;
    } else if (isArm && !hasRenderedArmDivider) {
      const div = document.createElement('div');
      div.className = 'section-divider arm-section-divider';
      div.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
          <span>// SECTION: ARMS</span>
          <button class="btn-subtle" onclick="toggleArmMode()">MODE: [${armMode}] (CLICK TO TOGGLE)</button>
        </div>`;
      container.appendChild(div);
      hasRenderedArmDivider = true;
    }

    /* Exercise card */
    const card = document.createElement('div');
    card.className = isMobility
      ? 'ex-row mobility-row'
      : (isArm && armMode === 'ZIGZAG' ? 'ex-row arm-zigzag-row' : 'ex-row');

    /* Smart target / e1RM */
    const firstPrev        = findPreviousSetData(ex.name, 0, state.selectedDateStr, state.logs);
    const smartTarget      = calculateSmartTargetLoad(ex.category, firstPrev);
    const topWorkSet       = ex.sets.find(s => s.type === 'WORK') || ex.sets[0];
    const e1rm             = calculateE1RM(topWorkSet?.weight ?? 0, topWorkSet?.reps ?? 0);

    let workSetCount = 0;
    const rowsHtml = ex.sets.map((s, setIdx) => {
      const isWarmup     = s.type === 'WARMUP';
      if (!isWarmup) workSetCount++;
      const setLabelText = isWarmup ? 'WARMUP' : formatWorkSetLabel(workSetCount);
      const prevSet      = findPreviousSetData(ex.name, setIdx, state.selectedDateStr, state.logs);

      /* Progressive overload badge */
      let poBadge = '';
      if (!isWarmup && prevSet) {
        if (isMobility) {
          const dR = s.reps - prevSet.reps;
          if (dR > 0) poBadge = `<span class="po-badge-inline">+${dR} REP PO</span>`;
        } else if (isAssisted) {
          const diff = prevSet.weight - s.weight;
          if (diff > 0) poBadge = `<span class="po-badge-inline">+${diff}kg BODYWEIGHT</span>`;
          else if (diff === 0 && s.reps > prevSet.reps) poBadge = `<span class="po-badge-inline">+${s.reps - prevSet.reps}rep</span>`;
        } else {
          const dW = s.weight - prevSet.weight;
          const dR = s.reps   - prevSet.reps;
          if (dW > 0)              poBadge = `<span class="po-badge-inline">+${dW}kg</span>`;
          else if (dW === 0 && dR > 0) poBadge = `<span class="po-badge-inline">+${dR}rep</span>`;
        }
      }

      /* Previous session hint */
      let prevHint = '—';
      if (prevSet) {
        if (isMobility)  prevHint = `${prevSet.reps} reps`;
        else if (isAssisted) prevHint = `Ass:${prevSet.weight}k×${prevSet.reps}`;
        else                 prevHint = `${prevSet.weight}k×${prevSet.reps}`;
      }

      /* Weight control */
      const weightHtml = isMobility
        ? `<span style="font-size:0.7rem;color:var(--dim);">BW</span>`
        : `<select class="kg-select" onchange="handleKgChange(${exIdx},${setIdx},this.value)">
             ${generateKgOptions(ex.category, s.weight, exIdx, setIdx, state.expandedKgSet)}
           </select>`;

      /* Reps control */
      const repsHtml = `<select class="small-caps-select reps-select" onchange="handleRepsChange(${exIdx},${setIdx},this.value)">
                          ${generateRepsOptions(s.reps, exIdx, setIdx, state.expandedRepsSet)}
                        </select>`;

      /* Shrug reps control */
      const shrugHtml = (hasShrugs && !isWarmup)
        ? `<div class="shrug-tracker" title="Shrug Reps at End">
             <select class="small-caps-select" onchange="handleShrugChange(${exIdx},${setIdx},this.value)">
               ${generateShrugRepsOptions(s.shrugReps ?? 0, exIdx, setIdx, state.expandedShrugSet)}
             </select>
           </div>`
        : '';

      /* RIR control */
      const curRir  = s.rir !== undefined ? s.rir : 1;
      const rirHtml = isWarmup
        ? `<span style="font-size:0.7rem;color:var(--dim);">—</span>`
        : `<select class="small-caps-select rir-select" onchange="updateSet(${exIdx},${setIdx},'rir',parseInt(this.value))">
             <option value="3" ${curRir === 3 ? 'selected' : ''}>3 RIR</option>
             <option value="2" ${curRir === 2 ? 'selected' : ''}>2 RIR</option>
             <option value="1" ${curRir === 1 ? 'selected' : ''}>1 RIR (STD)</option>
             <option value="0" ${curRir === 0 ? 'selected' : ''}>0 (FAIL)</option>
           </select>`;

      return `
        <tr>
          <td width="18%">
            <button class="btn-set-type ${isWarmup ? 'is-warmup' : 'is-work'}"
                    onclick="toggleSetType(${exIdx},${setIdx})">
              ${setLabelText}
            </button>
          </td>
          <td width="16%" class="prev-hint-td">${prevHint}</td>
          <td width="20%">
            <div style="display:flex;align-items:center;gap:4px;">${weightHtml}</div>
          </td>
          <td width="${hasShrugs && !isWarmup ? '36%' : '22%'}">
            <div style="display:flex;align-items:center;gap:4px;">
              ${repsHtml}${shrugHtml}${poBadge}
            </div>
          </td>
          <td width="14%">${rirHtml}</td>
          <td width="2%">
            <button class="btn-del" onclick="removeSet(${exIdx},${setIdx})">&times;</button>
          </td>
        </tr>`;
    }).join('');

    const discomfortVal      = ex.discomfort || 'NO DISCOMFORT';
    const isDiscomfortActive = discomfortVal !== 'NO DISCOMFORT';

    card.innerHTML = `
      <div class="ex-row-header">
        <div style="display:flex;align-items:center;gap:8px;width:70%;">
          <input type="text" class="ex-title-input"
                 value="${ex.name.toUpperCase()}"
                 onchange="updateExName(${exIdx},this.value)">
          ${isArm && armMode === 'ZIGZAG' ? '<span class="arm-tag">[ZIG-ZAG]</span>' : ''}
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          ${e1rm > 0 ? `<span class="e1rm-tag">e1RM: ${e1rm}kg</span>` : ''}
          ${smartTarget && !isMobility ? `<span class="smart-target-badge">${smartTarget}</span>` : ''}
        </div>
        <button class="btn-del" onclick="removeEx(${exIdx})">[DEL]</button>
      </div>

      <div class="ex-discomfort-row ${isDiscomfortActive ? 'active-discomfort' : ''}">
        <span class="discomfort-label">FEEDBACK:</span>
        <select class="discomfort-select" onchange="updateExDiscomfort(${exIdx},this.value)">
          ${generateDiscomfortOptions(ex.name, discomfortVal)}
        </select>
      </div>

      <div class="table-responsive-wrapper">
        <table class="tbl">
          <thead>
            <tr>
              <th>SET TYPE</th>
              <th>PREV</th>
              <th>${isMobility ? 'LOAD' : (isAssisted ? 'ASSIST KG' : 'KG')}</th>
              <th class="small-caps-header">${hasShrugs ? 'REPS + SHRUGS' : 'REPS'}</th>
              <th class="small-caps-header">RIR</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
      <div style="display:flex;gap:8px;margin-top:4px;">
        <button class="btn" style="font-size:0.7rem;padding:4px 8px;"
                onclick="addSet(${exIdx},'WORK')">+ WORK SET</button>
        <button class="btn" style="font-size:0.7rem;padding:4px 8px;color:var(--gray);"
                onclick="addSet(${exIdx},'WARMUP')">+ WARMUP SET</button>
      </div>`;

    container.appendChild(card);
  });
}

/* ── Private DOM helpers ───────────────────────────────────────────── */

function _divider(innerHTML) {
  const div = document.createElement('div');
  div.className = 'section-divider';
  div.innerHTML = innerHTML;
  return div;
}
