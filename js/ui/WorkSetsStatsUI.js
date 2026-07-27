/**
 * LOGBOOK — Work Sets Stats UI
 * Single responsibility: compute and render the collapsible muscle-group
 * breakdown card. Reads logs entry, never mutates state.
 */

import { MUSCLE_TARGET_MAP } from '../config/constants.js';

/**
 * Computes work-set counts per muscle group and renders the stats card.
 * @param {object|null} entry             logs entry for the selected date (may be null)
 * @param {boolean}     isWorkSetsExpanded  state.isWorkSetsExpanded
 */
export function renderMuscleGroupStats(entry, isWorkSetsExpanded) {
  const listContainer = document.getElementById('muscle-group-list');
  const totalEl       = document.getElementById('stat-total-worksets');
  const btnExpand     = document.getElementById('btn-expand-worksets');

  if (!entry || !entry.exercises) {
    if (totalEl)       totalEl.textContent      = '// WORK SETS: 0 SETS';
    if (listContainer) listContainer.style.display = 'none';
    return;
  }

  const counts = {};
  let overallWorkSets = 0;

  entry.exercises.forEach(ex => {
    const target      = MUSCLE_TARGET_MAP[ex.name.toUpperCase()] || { primary: ex.category || 'OTHER' };
    const workSets    = ex.sets.filter(s => s.type === 'WORK');
    const workSetCount = workSets.length;
    overallWorkSets  += workSetCount;

    if (workSetCount > 0) {
      counts[target.primary] = (counts[target.primary] || 0) + workSetCount;

      // Shrug reps count as extra TRAPS work-sets
      const shrugSets = workSets.filter(s => s.shrugReps && s.shrugReps > 0).length;
      if (shrugSets > 0) {
        counts['TRAPS'] = (counts['TRAPS'] || 0) + shrugSets;
      }
    }
  });

  if (totalEl)   totalEl.textContent  = `// WORK SETS: ${overallWorkSets} SETS`;
  if (btnExpand) btnExpand.textContent = isWorkSetsExpanded ? '[-]' : '[+]';

  if (!listContainer) return;

  if (isWorkSetsExpanded) {
    const html = Object.entries(counts)
      .map(([group, count]) =>
        `<div class="math-row"><span>${group}:</span> <strong>${count} SETS</strong></div>`
      )
      .join('') || `<div style="color:var(--dim); font-size:0.7rem;">[NO LOGGED SETS]</div>`;
    listContainer.innerHTML    = html;
    listContainer.style.display = 'block';
  } else {
    listContainer.style.display = 'none';
  }
}
