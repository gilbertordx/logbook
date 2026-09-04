/**
 * LOGBOOK — GitHub Sync Service
 * Single responsibility: pull/push workout logs to GitHub REST API.
 * Does NOT touch localStorage directly (delegates to StorageService.save).
 */

import { GITHUB_REPO_OWNER, GITHUB_REPO_NAME, GITHUB_FILE_PATH } from '../config/constants.js';
import { save } from './StorageService.js';

/* ── Badge helper ──────────────────────────────────────────────────── */

export function updateSyncBadge(statusText) {
  const btn = document.getElementById('btn-github-sync');
  if (btn) btn.textContent = `[SYNC: ${statusText}]`;
}

/* ── Pull ──────────────────────────────────────────────────────────── */

/**
 * Pulls remote logs from GitHub and merges them into state.logs.
 * @param {string}   token
 * @param {object}   state
 * @param {function} onDone  () => void — refresh callback
 */
export async function pullFromGitHub(token, state, onDone) {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${GITHUB_FILE_PATH}`,
      { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
    );
    if (res.status === 200) {
      const data       = await res.json();
      const contentStr = decodeURIComponent(escape(atob(data.content)));
      const remoteLogs = JSON.parse(contentStr);
      state.logs       = { ...state.logs, ...remoteLogs };
      save(state.logs);
      updateSyncBadge('OK');
      if (onDone) onDone();
    }
  } catch (err) {
    console.warn('GitHub Pull Warning:', err);
  }
}

/* ── Push ──────────────────────────────────────────────────────────── */

/**
 * Pushes state.logs to GitHub (PUT with SHA update).
 * @param {object} state
 * @param {string} [tokenOverride]
 */
export async function syncToGitHub(state, tokenOverride = null) {
  const token = tokenOverride || sessionStorage.getItem('tbjp_gh_token');
  if (!token) return;

  updateSyncBadge('BUSY...');

  try {
    let sha = null;
    const getRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${GITHUB_FILE_PATH}`,
      { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
    );
    if (getRes.status === 200) {
      const existing = await getRes.json();
      sha = existing.sha;
    }

    const contentEncoded = btoa(unescape(encodeURIComponent(JSON.stringify(state.logs, null, 2))));
    const payload = {
      message: `sync: update workout logs [${state.selectedDateStr}]`,
      content: contentEncoded,
      branch:  'main',
    };
    if (sha) payload.sha = sha;

    const putRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${GITHUB_FILE_PATH}`,
      {
        method:  'PUT',
        headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github.v3+json' },
        body:    JSON.stringify(payload),
      }
    );

    updateSyncBadge(putRes.status === 200 || putRes.status === 201 ? 'OK' : 'ERR');
  } catch (err) {
    console.error('GitHub Sync Error:', err);
    updateSyncBadge('ERR');
  }
}

/* ── Init ──────────────────────────────────────────────────────────── */

/**
 * Initialises the GitHub sync button and auto-pulls if a token exists.
 * @param {object}   state
 * @param {function} onPullDone  () => void — refresh callback after pull
 */
export function initGitHubSync(state, onPullDone) {
  // PATs are deliberately limited to this tab. Remove tokens persisted by older versions.
  const token = sessionStorage.getItem('tbjp_gh_token');
  localStorage.removeItem('tbjp_gh_token');
  if (token) {
    updateSyncBadge('OK');
    pullFromGitHub(token, state, onPullDone);
  } else {
    updateSyncBadge('LOCAL');
  }

  document.getElementById('btn-github-sync').onclick = () => {
    const existing   = sessionStorage.getItem('tbjp_gh_token');
    const inputToken = prompt(
      '[GITHUB BACKUP SETUP]\n\nEnter a fine-grained PAT limited to this repository with Contents read/write access. It will be retained only for this browser tab.\n\nLeave blank to disconnect.',
      existing || ''
    );
    if (inputToken === null) return;

    if (inputToken.trim() === '') {
      sessionStorage.removeItem('tbjp_gh_token');
      updateSyncBadge('LOCAL');
      alert('[SYSTEM] GITHUB SYNC DISCONNECTED.');
    } else {
      sessionStorage.setItem('tbjp_gh_token', inputToken.trim());
      updateSyncBadge('SYNCING...');
      syncToGitHub(state, inputToken.trim());
    }
  };
}
