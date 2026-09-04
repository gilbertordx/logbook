# Logbook

Logbook is a local-first workout log implemented as a static browser application. It records exercises, sets, repetitions, weight, RIR, discomfort notes, session duration, and optional heart-rate/calorie metrics.

This repository is a learning project, not a production service. The sections below distinguish implemented behavior from current limitations.

## Implemented features

- Calendar-based workout entry and editing
- A reusable default routine and previous-session comparisons
- Session timer and work-set statistics
- Browser `localStorage` persistence
- JSON backup export and import
- Optional backup of the complete log file through the GitHub Contents API
- Optional Spotify playback controls using a user-provided client ID and browser OAuth token
- Manual Garmin metric entry and limited import from JSON or TCX files
- Responsive, touch-oriented interface

## Technical stack and architecture

- HTML5 and CSS3
- Vanilla JavaScript with native ES modules
- No framework, transpiler, bundler, package manager, or backend

The application has 16 JavaScript modules:

```text
js/
├── main.js       # bootstrap and dependency wiring
├── state.js      # shared in-memory state
├── config/       # static application data
├── services/     # local persistence and third-party API clients
├── ui/           # rendering and DOM event handling
└── utils/        # date, timer, and workout calculations
```

`main.js` creates a shared render callback and supplies the state object to the UI and service controllers. Data is stored as a JSON object keyed by `DD/MM/YY`. There is no database, server-side API, user model, or schema migration layer.

## Running locally

The ES modules must be served over HTTP:

```bash
./serve.sh
```

Then open `http://localhost:8080`.

Alternatively:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Integrations and limitations

### Garmin data

Garmin metrics can be entered manually or imported from:

- JSON containing `averageHR`/`avgHr`, `maxHR`/`maxHr`, and `calories`/`kcals`
- TCX containing `AverageHeartRateBpm`, `MaximumHeartRateBpm`, and `Calories`

The repository does **not** implement Garmin OAuth, Garmin Connect cloud synchronization, live heart-rate polling, FIT decoding, GPX metric extraction, or device-specific Forerunner parsing. Unsupported or malformed files are rejected; the application does not substitute sample values.

### Spotify

Spotify controls call the Spotify Web API directly from the browser. The current authentication implementation uses the OAuth implicit-grant response and stores the access token only in `sessionStorage`. There is no refresh-token flow or backend token exchange. Playback endpoints generally require Spotify Premium and an active playback device.

### GitHub backup

GitHub synchronization uses the Contents API to read or replace `data/logs.json` on the `main` branch. It creates commits containing the complete workout dataset. The user supplies a personal access token, which is kept in `sessionStorage` for the current tab rather than persisted across browser sessions.

This is a convenience backup mechanism, not a multi-user database. It has no conflict-resolution protocol beyond GitHub's file SHA check. Use a fine-grained token limited to this repository and Contents read/write access. Workout data committed to a public repository is public.

## Testing and deployment status

There is currently no automated test suite, lint configuration, CI workflow, container image, or cloud deployment configuration in this repository. The application can be deployed to a static host, but no production deployment is defined here.

## Product direction

The intended next version is a full-stack training intelligence application. Its goal is to replace memory and guesswork with consistent logging, reproducible training metrics, explicit habit/accountability signals, and an in-app assistant that can question the user and explain patterns using the user's own data.

This is planned work, not functionality in the current static application. The proposed architecture, metric definitions, AI boundaries, delivery phases, and open decisions are maintained in [docs/ROADMAP.md](docs/ROADMAP.md).

## Training model

The default routine is based on low-volume training with a target of 3–7 repetitions at approximately one rep in reserve. This is application seed data, not medical or training advice.
