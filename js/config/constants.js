/**
 * LOGBOOK — Constants & Static Data
 * Pure data module. No side effects, no imports, no DOM access.
 */

export const GITHUB_REPO_OWNER = 'gilbertordx';
export const GITHUB_REPO_NAME  = 'logbook';
export const GITHUB_FILE_PATH  = 'data/logs.json';

export const ANATOMICAL_DISCOMFORT_MAP = {
  'CABLE LOW ROW (SHRUG AT END)': ['NO DISCOMFORT', 'ROTATOR CUFF', 'LEFT ULNAR NERVE', 'LOWER BACK', 'FOREARM/ELBOW'],
  'ASSISTED CHIN':                ['NO DISCOMFORT', 'ANTERIOR SHOULDER', 'ELBOW TENDINITIS', 'WRIST STRAIN'],
  'LOW-INCLINE DB PRESS':         ['NO DISCOMFORT', 'ANTERIOR DELT', 'ROTATOR CUFF', 'ELBOW TENDINITIS'],
  'INCLINE DB REAR DELT (SHRUG AT END)': ['NO DISCOMFORT', 'REAR DELT TENDON', 'NECK STRAIN'],
  'CABLE UPRIGHT ROW (SHRUG AT END)':    ['NO DISCOMFORT', 'AC JOINT / IMPINGEMENT', 'WRIST STRAIN', 'ROTATOR CUFF'],
  'CABLE OH EXT': ['NO DISCOMFORT', 'LEFT ULNAR NERVE', 'RIGHT ULNAR NERVE', 'TRICEPS TENDON', 'ELBOW DISCOMFORT'],
  'CABLE CURL':   ['NO DISCOMFORT', 'BICEPS TENDON', 'FOREARM / BRACHIALIS', 'WRIST TENDINITIS'],
  'DEAD-BUG':     ['NO DISCOMFORT', 'FEMORAL HEAD', 'HIP FLEXOR'],
  'BIRD-DOG':     ['NO DISCOMFORT', 'FEMORAL HEAD', 'LOWER BACK STRAIN', 'WRIST PRESSURE'],
};

export const MUSCLE_TARGET_MAP = {
  'DEAD-BUG':                           { primary: 'CORE' },
  'BIRD-DOG':                           { primary: 'CORE' },
  'CABLE LOW ROW (SHRUG AT END)':       { primary: 'UPPER BACK', secondary: 'TRAPS' },
  'ASSISTED CHIN':                      { primary: 'LATS' },
  'LOW-INCLINE DB PRESS':               { primary: 'CHEST', secondary: 'DELTS / TRICEPS' },
  'INCLINE DB REAR DELT (SHRUG AT END)':{ primary: 'REAR DELTS', secondary: 'TRAPS' },
  'CABLE UPRIGHT ROW (SHRUG AT END)':   { primary: 'LATERAL DELTS', secondary: 'TRAPS' },
  'CABLE OH EXT':                       { primary: 'TRICEPS' },
  'CABLE CURL':                         { primary: 'BICEPS' },
};

export const DEFAULT_DISCOMFORT_OPTIONS = [
  'NO DISCOMFORT', 'FEMORAL HEAD', 'JOINT ACHINESS', 'MUSCLE STRAIN',
];

export const DEFAULT_ROUTINE = {
  armMode: 'STRAIGHT',
  durationSeconds: 0,
  garminData: { avgHr: 135, maxHr: 162, kcals: 385 },
  exercises: [
    {
      name: 'DEAD-BUG', category: 'MOBILITY', discomfort: 'NO DISCOMFORT',
      sets: [
        { type: 'WORK', weight: 0, reps: 8,  rir: 1 },
        { type: 'WORK', weight: 0, reps: 10, rir: 1 },
      ],
    },
    {
      name: 'BIRD-DOG', category: 'MOBILITY', discomfort: 'NO DISCOMFORT',
      sets: [
        { type: 'WORK', weight: 0, reps: 8,  rir: 1 },
        { type: 'WORK', weight: 0, reps: 10, rir: 1 },
      ],
    },
    {
      name: 'CABLE LOW ROW (SHRUG AT END)', category: 'CABLE', discomfort: 'NO DISCOMFORT',
      sets: [
        { type: 'WARMUP', weight: 40, reps: 6 },
        { type: 'WARMUP', weight: 55, reps: 3 },
        { type: 'WARMUP', weight: 70, reps: 2 },
        { type: 'WORK',   weight: 80, reps: 5, shrugReps: 3, rir: 1 },
        { type: 'WORK',   weight: 75, reps: 6, shrugReps: 3, rir: 1 },
      ],
    },
    {
      name: 'ASSISTED CHIN', category: 'ASSISTED', discomfort: 'NO DISCOMFORT',
      sets: [
        { type: 'WARMUP', weight: 20, reps: 5 },
        { type: 'WORK',   weight: 15, reps: 5, rir: 1 },
        { type: 'WORK',   weight: 10, reps: 6, rir: 1 },
      ],
    },
    {
      name: 'LOW-INCLINE DB PRESS', category: 'DUMBBELL', discomfort: 'NO DISCOMFORT',
      sets: [
        { type: 'WARMUP', weight: 18, reps: 6 },
        { type: 'WARMUP', weight: 26, reps: 3 },
        { type: 'WARMUP', weight: 32, reps: 2 },
        { type: 'WORK',   weight: 38, reps: 5, rir: 1 },
        { type: 'WORK',   weight: 34, reps: 6, rir: 1 },
      ],
    },
    {
      name: 'INCLINE DB REAR DELT (SHRUG AT END)', category: 'DUMBBELL', discomfort: 'NO DISCOMFORT',
      sets: [
        { type: 'WORK', weight: 16, reps: 6, shrugReps: 3, rir: 1 },
        { type: 'WORK', weight: 14, reps: 7, shrugReps: 3, rir: 1 },
      ],
    },
    {
      name: 'CABLE UPRIGHT ROW (SHRUG AT END)', category: 'CABLE', discomfort: 'NO DISCOMFORT',
      sets: [
        { type: 'WORK', weight: 45, reps: 5, shrugReps: 3, rir: 1 },
        { type: 'WORK', weight: 40, reps: 6, shrugReps: 3, rir: 1 },
      ],
    },
    {
      name: 'CABLE OH EXT', category: 'CABLE', discomfort: 'NO DISCOMFORT', isArm: true,
      sets: [
        { type: 'WORK', weight: 35, reps: 6, rir: 1 },
        { type: 'WORK', weight: 30, reps: 6, rir: 1 },
      ],
    },
    {
      name: 'CABLE CURL', category: 'CABLE', discomfort: 'NO DISCOMFORT', isArm: true,
      sets: [
        { type: 'WORK', weight: 30, reps: 6, rir: 1 },
        { type: 'WORK', weight: 25, reps: 6, rir: 1 },
      ],
    },
  ],
};
