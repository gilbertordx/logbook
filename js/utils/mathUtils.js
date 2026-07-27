/**
 * LOGBOOK — Math / Training Calculation Utilities
 * Pure functions. No DOM access. No side effects.
 * Depends only on dateUtils.
 */

import { parseDMY } from './dateUtils.js';

/**
 * Returns a human-readable workset label.
 * @param {number} workSetIndex
 * @returns {string}
 */
export function formatWorkSetLabel(workSetIndex) {
  return `WORKSET ${workSetIndex}`;
}

/**
 * Epley formula: estimated 1-rep max.
 * @param {number} weight kg
 * @param {number} reps
 * @returns {number} rounded kg
 */
export function calculateE1RM(weight, reps) {
  if (!weight || !reps) return 0;
  return Math.round(weight * (1 + reps / 30));
}

/**
 * Smart progressive overload target string based on previous session's set data.
 * @param {string} exCategory
 * @param {object|null} prevSet
 * @returns {string|null}
 */
export function calculateSmartTargetLoad(exCategory, prevSet) {
  if (!prevSet || prevSet.weight === undefined) return null;

  let inc = 2.5;
  if (exCategory === 'CABLE')    inc = 5;
  if (exCategory === 'DUMBBELL') inc = 2;
  if (exCategory === 'ASSISTED') inc = -5;

  if (prevSet.reps >= 7) {
    const targetKg = Math.max(0, prevSet.weight + inc);
    return exCategory === 'ASSISTED'
      ? `TARGET: ${targetKg}KG ASSIST (-5KG COUNTERWEIGHT)`
      : `TARGET: ${targetKg}KG (+${inc}KG INC)`;
  } else if (prevSet.reps < 3) {
    return `TARGET: MAINTAIN ${prevSet.weight}KG OR DROP LOAD`;
  } else {
    return `TARGET: ${prevSet.weight}KG (+1 REP)`;
  }
}

/**
 * Finds the most recent previous session data for a given exercise and set index.
 * @param {string} exName
 * @param {number} setIdx
 * @param {string} currentDateStr  DD/MM/YY
 * @param {object} logs            full logs map
 * @returns {object|null}
 */
export function findPreviousSetData(exName, setIdx, currentDateStr, logs) {
  const currTime = parseDMY(currentDateStr).getTime();
  const sortedKeys = Object.keys(logs)
    .filter(k => parseDMY(k).getTime() < currTime)
    .sort((a, b) => parseDMY(b).getTime() - parseDMY(a).getTime());

  for (const dateKey of sortedKeys) {
    const session = logs[dateKey];
    if (session && session.exercises) {
      const match = session.exercises.find(
        e => e.name.toUpperCase() === exName.toUpperCase()
      );
      if (match && match.sets && match.sets[setIdx]) {
        return { dateKey, ...match.sets[setIdx] };
      }
    }
  }
  return null;
}
