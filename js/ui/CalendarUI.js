/**
 * LOGBOOK — Calendar UI
 * Single responsibility: render and wire the monthly calendar grid.
 * Reads state.logs (for dot markers) and state.selectedDateStr (for highlight).
 * Never writes to logs directly.
 */

import { formatDateKey } from '../utils/dateUtils.js';

/**
 * Initialises calendar navigation buttons and renders the initial grid.
 * @param {object}   state
 * @param {function} onDateSelect  () => void — called whenever the selected date changes
 */
export function initCalendar(state, onDateSelect) {
  document.getElementById('cal-prev').onclick = () => {
    state.currentDate.setMonth(state.currentDate.getMonth() - 1);
    renderCalendar(state, onDateSelect);
  };

  document.getElementById('cal-next').onclick = () => {
    state.currentDate.setMonth(state.currentDate.getMonth() + 1);
    renderCalendar(state, onDateSelect);
  };

  document.getElementById('today-btn').onclick = () => {
    state.currentDate    = new Date();
    state.selectedDateStr = formatDateKey(state.currentDate);
    renderCalendar(state, onDateSelect);
    if (onDateSelect) onDateSelect();
  };

  renderCalendar(state, onDateSelect);
}

/**
 * Re-renders the calendar grid for state.currentDate.
 * @param {object}   state
 * @param {function} onDateSelect  () => void
 */
export function renderCalendar(state, onDateSelect) {
  const year  = state.currentDate.getFullYear();
  const month = state.currentDate.getMonth();

  const monthNames = ['01','02','03','04','05','06','07','08','09','10','11','12'];
  document.getElementById('cal-title').textContent =
    `${monthNames[month]}/${String(year).slice(-2)}`;

  const grid    = document.getElementById('calendar-grid');
  grid.innerHTML = '';

  const firstDay  = new Date(year, month, 1).getDay();
  const padding   = firstDay === 0 ? 6 : firstDay - 1; // Mon-start grid
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevDays  = new Date(year, month, 0).getDate();
  const todayKey  = formatDateKey(new Date());

  // Padding cells from previous month
  for (let i = padding; i > 0; i--) {
    const cell = document.createElement('div');
    cell.className   = 'day-cell other-month';
    cell.textContent = prevDays - i + 1;
    grid.appendChild(cell);
  }

  // Current month cells
  for (let d = 1; d <= totalDays; d++) {
    const key   = formatDateKey(new Date(year, month, d));
    const dayEl = document.createElement('div');
    dayEl.className = 'day-cell';
    if (key === todayKey)            dayEl.classList.add('today');
    if (key === state.selectedDateStr) dayEl.classList.add('selected');

    dayEl.innerHTML = state.logs[key]
      ? `<span>${d}</span><span class="has-data">•</span>`
      : String(d);

    dayEl.onclick = () => {
      state.selectedDateStr = key;
      renderCalendar(state, onDateSelect);
      if (onDateSelect) onDateSelect();
    };

    grid.appendChild(dayEl);
  }
}
