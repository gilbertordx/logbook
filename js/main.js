/**
 * LOGBOOK — Application Bootstrap (main.js)
 * Single responsibility: wire all subsystems together and trigger the first render.
 * Contains NO business logic — orchestration only.
 *
 * Dependency Inversion: high-level bootstrap imports low-level modules,
 * never the other way around.
 */

import { state }                     from './state.js';
import { formatDateKey }             from './utils/dateUtils.js';
import { startSessionTimer }         from './utils/timerUtils.js';
import { load, initExportImport }    from './services/StorageService.js';
import { initGitHubSync }            from './services/GitHubSyncService.js';
import { handleSpotifyAuthCallback } from './services/SpotifyService.js';
import { initGarminController }      from './ui/GarminUI.js';
import { initSpotifyController }     from './ui/SpotifyUI.js';
import { initCalendar, renderCalendar } from './ui/CalendarUI.js';
import { initLogPanel, renderSelectedDate } from './ui/LogPanelUI.js';

document.addEventListener('DOMContentLoaded', () => {

  /* ── 1. OAuth callbacks must fire before any rendering ─────────── */
  handleSpotifyAuthCallback(state);

  /* ── 2. Seed state ──────────────────────────────────────────────── */
  state.selectedDateStr = formatDateKey(new Date());
  state.logs            = load(state.selectedDateStr);

  /* ── 3. Define the single shared refresh function ───────────────── *
   * All subsystems receive this callback so they can trigger a full
   * re-render without importing rendering modules directly (avoids
   * circular dependencies and keeps the DI boundary clean).
   * ─────────────────────────────────────────────────────────────── */
  function refresh() {
    renderCalendar(state, refresh);
    renderSelectedDate(state, refresh);
  }

  /* ── 4. Initialise subsystems ────────────────────────────────────── */
  initCalendar(state, refresh);           // calendar nav + date select
  initLogPanel(state, refresh);           // log buttons + window handlers
  initExportImport(state, refresh);       // export/import JSON
  initGitHubSync(state, refresh);         // GitHub pull on load, sync on save
  initGarminController(state);            // Garmin card (no full refresh needed)
  initSpotifyController(state);           // Spotify card (no full refresh needed)
  startSessionTimer(state);              // live session duration ticker

  /* ── 5. First render ────────────────────────────────────────────── */
  refresh();
});
