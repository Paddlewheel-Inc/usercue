# UserCue releases

## [Unreleased]

## [1.1.0]

- Add instance plan limits on staff seats. When `USERCUE_PLAN_FILE` points to a plan file, staff accounts and pending invites are capped by the plan. An invalid or unreadable plan file falls back to the free plan. If the variable is unset, nothing is limited.
- Show staff seat usage and a plan-limit notice in Settings.
- Register the PWA service worker in dev only when `PWA_DEV=true`.

## [1.0.3]

- Implemented app version label to Dockerfile for better version tracking on hosted versions of Usercue

## [1.0.2]

- Publish native AMD64 and ARM64 Docker images under matching release tags.

## [1.0.1]

- Fix database initialization on fresh installations and preserve existing API key permissions during upgrades.

## [1.0.0]

- Initial versioned release.
- Automated Docker image publishing through GitHub Actions.
- Application version information at `GET /api/version`.
