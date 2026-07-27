/**
 * LOGBOOK — Global Mutable State
 * Single source of truth. All modules receive this object and mutate it directly.
 * Never import from UI or service layers here.
 */

export const state = {
  // Data
  logs: {},
  selectedDateStr: '',
  currentDate: new Date(),
  lastClearedState: null,

  // UI expand state
  expandedKgSet: {},
  expandedRepsSet: {},
  expandedShrugSet: {},
  isWorkSetsExpanded: false,

  // Timer
  sessionTimerInterval: null,
  sessionSeconds: 0,

  // Spotify
  spotifyToken: null,
  spotifyPollInterval: null,
  spotifyUserTopArtistSeeds: [],

  // Garmin
  garminPollInterval: null,
  garminUserToken: null,
};
