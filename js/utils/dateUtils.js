/**
 * LOGBOOK — Date Utilities
 * Pure functions. No DOM access. No side effects.
 */

/**
 * Formats a Date object to DD/MM/YY key format used throughout the app.
 * @param {Date} d
 * @returns {string} e.g. "26/07/26"
 */
export function formatDateKey(d) {
  const day = String(d.getDate()).padStart(2, '0');
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const y   = String(d.getFullYear()).slice(-2);
  return `${day}/${m}/${y}`;
}

/**
 * Parses a DD/MM/YY string into a Date object.
 * @param {string} dmyStr e.g. "26/07/26"
 * @returns {Date}
 */
export function parseDMY(dmyStr) {
  const parts = dmyStr.split('/');
  if (parts.length !== 3) return new Date(0);
  const fullYear = 2000 + parseInt(parts[2], 10);
  return new Date(fullYear, parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
}
