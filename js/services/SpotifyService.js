/**
 * LOGBOOK — Spotify Service
 * Single responsibility: Spotify Web API integration.
 * Handles OAuth callback, playback polling, controls, and vibe recommendations.
 */

/* ── OAuth ─────────────────────────────────────────────────────────── */

/**
 * Extracts and stores the Spotify access token from the URL hash (implicit grant flow).
 * Must be called before any DOM rendering so the hash can be cleared cleanly.
 * @param {object} state
 */
export function handleSpotifyAuthCallback(state) {
  const hash = window.location.hash;
  if (hash && hash.includes('access_token=')) {
    const params = new URLSearchParams(hash.substring(1));
    const token  = params.get('access_token');
    if (token) {
      state.spotifyToken = token;
      localStorage.setItem('tbjp_spotify_token', token);
      window.location.hash = '';
    }
  }
}

/* ── Seed / personalization ────────────────────────────────────────── */

/**
 * Fetches the user's top 3 artists to use as recommendation seeds.
 * @param {object} state
 */
export async function fetchSpotifyPersonalTopSeeds(state) {
  if (!state.spotifyToken) return;
  try {
    const res = await fetch('https://api.spotify.com/v1/me/top/artists?limit=3', {
      headers: { Authorization: `Bearer ${state.spotifyToken}` },
    });
    if (res.status === 200) {
      const data = await res.json();
      if (data?.items?.length > 0) {
        state.spotifyUserTopArtistSeeds = data.items.map(a => a.id);
      }
    }
  } catch (err) {
    console.warn('Spotify seeds error:', err);
  }
}

/* ── Vibe ──────────────────────────────────────────────────────────── */

/**
 * Triggers a personalized playlist recommendation based on workout phase.
 * @param {'warmup'|'workset'} vibeType
 * @param {object} state
 */
export async function triggerPersonalizedVibe(vibeType, state) {
  if (!state.spotifyToken) return;
  try {
    const seedsQuery = state.spotifyUserTopArtistSeeds.length > 0
      ? `seed_artists=${state.spotifyUserTopArtistSeeds.slice(0, 2).join(',')}`
      : 'seed_genres=metal,rock,electronic';

    const targetEnergy  = vibeType === 'workset' ? '0.95' : '0.45';
    const targetValence = vibeType === 'workset' ? '0.80' : '0.50';

    const res = await fetch(
      `https://api.spotify.com/v1/recommendations?${seedsQuery}&target_energy=${targetEnergy}&target_valence=${targetValence}&limit=10`,
      { headers: { Authorization: `Bearer ${state.spotifyToken}` } }
    );
    if (res.status === 200) {
      const data = await res.json();
      if (data?.tracks?.length > 0) {
        await fetch('https://api.spotify.com/v1/me/player/play', {
          method:  'PUT',
          headers: { Authorization: `Bearer ${state.spotifyToken}`, 'Content-Type': 'application/json' },
          body:    JSON.stringify({ uris: data.tracks.map(t => t.uri) }),
        });
        setTimeout(() => fetchSpotifyCurrentlyPlaying(state), 500);
      }
    }
  } catch (err) {
    console.error('Spotify Vibe Error:', err);
  }
}

/* ── Polling ───────────────────────────────────────────────────────── */

/**
 * Starts polling the currently-playing endpoint every 4 seconds.
 * @param {object} state
 */
export function startSpotifyPolling(state) {
  clearInterval(state.spotifyPollInterval);
  fetchSpotifyCurrentlyPlaying(state);
  state.spotifyPollInterval = setInterval(() => fetchSpotifyCurrentlyPlaying(state), 4_000);
}

/* ── Playback controls ─────────────────────────────────────────────── */

/**
 * Sends a playback control command (play / next / previous).
 * @param {'play'|'next'|'previous'} endpoint
 * @param {object} state
 */
export async function spotifyControlCall(endpoint, state) {
  if (!state.spotifyToken) return;
  try {
    const method = endpoint === 'play' ? 'PUT' : 'POST';
    const res    = await fetch(`https://api.spotify.com/v1/me/player/${endpoint}`, {
      method,
      headers: { Authorization: `Bearer ${state.spotifyToken}` },
    });
    if (res.status === 204 || res.status === 200) {
      setTimeout(() => fetchSpotifyCurrentlyPlaying(state), 500);
    }
  } catch (err) {
    console.error('Spotify API Error:', err);
  }
}

/**
 * Fetches and displays the currently-playing track.
 * Clears the token if it has expired (401).
 * @param {object} state
 */
export async function fetchSpotifyCurrentlyPlaying(state) {
  if (!state.spotifyToken) return;
  try {
    const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: `Bearer ${state.spotifyToken}` },
    });

    const trackEl = document.getElementById('spotify-track-name');
    if (res.status === 200) {
      const data = await res.json();
      if (data?.item && trackEl) {
        const artist    = data.item.artists.map(a => a.name).join(', ');
        const isPlaying = data.is_playing ? '▶' : '❚❚';
        trackEl.textContent = `${isPlaying} ${data.item.name.toUpperCase()} — ${artist.toUpperCase()}`;
      }
    } else if (res.status === 401) {
      if (trackEl) trackEl.textContent = '[SESSION EXPIRED — CLICK CONNECT]';
      localStorage.removeItem('tbjp_spotify_token');
      state.spotifyToken = null;
    }
  } catch (err) {
    console.warn('Spotify fetch error:', err);
  }
}
