/**
 * LOGBOOK — Session Timer Utility
 * Manages the live session duration counter.
 */

/**
 * Starts the session timer, incrementing durationSeconds in state.logs[selectedDateStr]
 * and updating the header display every second.
 * @param {object} state
 */
export function startSessionTimer(state) {
  clearInterval(state.sessionTimerInterval);
  const display = document.getElementById('session-timer-display');

  state.sessionTimerInterval = setInterval(() => {
    if (!state.logs[state.selectedDateStr]) return;
    if (state.logs[state.selectedDateStr].durationSeconds === undefined) {
      state.logs[state.selectedDateStr].durationSeconds = 0;
    }
    state.logs[state.selectedDateStr].durationSeconds++;
    state.sessionSeconds = state.logs[state.selectedDateStr].durationSeconds;

    const m = String(Math.floor(state.sessionSeconds / 60)).padStart(2, '0');
    const s = String(state.sessionSeconds % 60).padStart(2, '0');
    if (display) display.textContent = `[TIME: ${m}:${s}]`;
  }, 1000);
}

/**
 * Stops the session timer.
 * @param {object} state
 */
export function stopSessionTimer(state) {
  clearInterval(state.sessionTimerInterval);
  state.sessionTimerInterval = null;
}
