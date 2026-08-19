# logbook

Personal workout tracking app + learning lab. A browser-based tool for logging training sessions with real-time Garmin heart-rate sync, Spotify control, and GitHub-backed storage. Built as both a practical solution to a personal need and a constant experiment in code organization, API integration, and responsive UI design.

## What It Does

- **Workout Logging**: Calendar-based session tracking with exercise details, sets, reps, weight, and form notes
- **Garmin Forerunner 55 Integration**: Real-time heart-rate and calorie data synced from Garmin Connect cloud API
- **Spotify Control**: In-app music playback control during workouts
- **GitHub Sync**: Automatic backup and version control of all workout data via GitHub API
- **Mobile Responsive**: Full touch-optimized interface for training floor use
- **Local-First Storage**: JSON-backed data stored locally with GitHub as optional sync layer

## Architecture

Modular ES6 design split across 14 focused components:

```
js/
├── main.js              # App bootstrap and orchestration
├── state.js             # Central state management
├── config/              # API credentials, constants
├── services/            # API integrations (Garmin, Spotify, GitHub)
├── ui/                  # UI components (calendar, forms, cards)
└── utils/               # Helpers (parsing, formatting, storage)
```

Single responsibility principle throughout — each module handles one concern. No frameworks; vanilla JS with modern ES module syntax.

## Getting Started

```bash
# Serve locally (requires Node.js or simple HTTP server)
./serve.sh
# or
python -m http.server 8000
```

Open `http://localhost:8000` in browser. Data persists in browser localStorage and syncs to GitHub if credentials are configured.

## External Integrations

**Garmin Connect API**
- OAuth flow for read-only access to heart-rate and activity data
- Real-time polling every 10 seconds during active session
- Forerunner 55 device-specific data parsing

**Spotify Web API**
- Player control (play, pause, skip, volume) during workouts
- Requires Spotify Premium and OAuth token refresh

**GitHub API**
- Automatic JSON backup commits to repo
- Retrieves workout history from git commits
- Read/write access needed; credentials stored in browser config

## Study Notes

This project is intentionally hacked and evolved. Expect experimentation: feature branches, architectural changes, API tweaks. It's as much about understanding how integrations work as it is about the final product.

Originally paired with [`devsecops-pipeline`](https://github.com/gilbertordx/devsecops-pipeline) — a study project exploring CI/CD, infrastructure-as-code, and AWS provisioning. If this app ever needs containerization and automated deployment, those patterns would apply here.

## Training Philosophy

Built around Dorian Yates-inspired training: form over volume, 3–7 reps at 1 RIR (rep in reserve). The app reinforces this through the header tagline and session timer.
