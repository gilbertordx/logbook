/**
 * LOGBOOK — Spotify UI
 * Single responsibility: wire Spotify card DOM events.
 * All API calls delegated to SpotifyService.
 */

import {
  startSpotifyPolling,
  fetchSpotifyPersonalTopSeeds,
  triggerPersonalizedVibe,
  spotifyControlCall,
} from '../services/SpotifyService.js';

/**
 * Initialises the Spotify card: card toggle, connect/auth, playback controls, vibe buttons.
 * @param {object} state
 */
export function initSpotifyController(state) {
  const btnToggle = document.getElementById('btn-spotify-toggle');
  const spCard    = document.getElementById('spotify-card');

  // Toggle card
  if (btnToggle && spCard) {
    btnToggle.onclick = () => {
      spCard.style.display = spCard.style.display !== 'none' ? 'none' : 'block';
    };
  }

  // Restore session token
  // Access tokens are limited to this tab. Remove tokens persisted by older versions.
  state.spotifyToken = sessionStorage.getItem('tbjp_spotify_token');
  localStorage.removeItem('tbjp_spotify_token');
  const btnConnect   = document.getElementById('btn-spotify-login');

  if (state.spotifyToken && btnConnect) {
    btnConnect.textContent = '[CONNECTED]';
    startSpotifyPolling(state);
    fetchSpotifyPersonalTopSeeds(state);
  }

  // Connect button: OAuth or manual token
  if (btnConnect) {
    btnConnect.onclick = () => {
      let clientId = localStorage.getItem('tbjp_spotify_client_id');

      if (!clientId) {
        clientId = prompt('[SPOTIFY AUTH]\nEnter Spotify App Client ID:');
        if (clientId?.trim()) {
          localStorage.setItem('tbjp_spotify_client_id', clientId.trim());
        }
      }

      if (clientId?.trim()) {
        const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
        const scopes      = encodeURIComponent(
          'user-read-playback-state user-modify-playback-state user-read-currently-playing user-top-read'
        );
        window.location.href =
          `https://accounts.spotify.com/authorize?client_id=${clientId.trim()}` +
          `&response_type=token&redirect_uri=${redirectUri}&scope=${scopes}`;
      } else {
        const inputVal = prompt('[SPOTIFY TOKEN / PLAYLIST]\nPaste Access Token or Playlist URL:');
        if (!inputVal) return;

        if (inputVal.includes('spotify.com/playlist/')) {
          const match = inputVal.match(/playlist\/([a-zA-Z0-9]+)/);
          if (match) {
            const iframe = document.getElementById('spotify-iframe');
            if (iframe) iframe.src = `https://open.spotify.com/embed/playlist/${match[1]}?utm_source=generator&theme=0`;
          }
        } else {
          state.spotifyToken = inputVal.trim();
          sessionStorage.setItem('tbjp_spotify_token', state.spotifyToken);
          btnConnect.textContent = '[CONNECTED]';
          startSpotifyPolling(state);
          fetchSpotifyPersonalTopSeeds(state);
        }
      }
    };
  }

  // Vibe buttons
  document.getElementById('sp-vibe-warmup').onclick = () => triggerPersonalizedVibe('warmup',   state);
  document.getElementById('sp-vibe-heavy').onclick  = () => triggerPersonalizedVibe('workset',  state);

  // Playback controls
  document.getElementById('sp-play').onclick = () => spotifyControlCall('play',     state);
  document.getElementById('sp-next').onclick = () => spotifyControlCall('next',     state);
  document.getElementById('sp-prev').onclick = () => spotifyControlCall('previous', state);
}
