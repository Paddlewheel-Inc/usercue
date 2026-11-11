# UserCue releases

## [Unreleased]

## [1.2.1]

- Add board wipe, redesign the admin overview, and dock the sidebar.
- Showing '?' instead of '.

## [1.2.0]

- Suggest similar posts while someone writes a new one, and let staff merge duplicates. Votes and comments move to the kept post, and the old link redirects.
- Add impact and effort scoring, internal notes, and priority sorting for staff. Triage tools can be turned off in settings or limited to certain boards.
- Filter requests by tag, assignee, and minimum votes, and save views from the staff workspace.
- Notify voters when a request ships, show a shipped badge on posts, and link changelog entries to the posts they close.
- Add a weekly email digest for staff, with per-user opt out, plus email preferences on the account page.
- Add Slack notifications, signed webhooks, and an audit log.
- Accept feedback by email through Resend inbound webhooks.
- Add an embeddable feedback widget and inline board, roadmap, and changelog embeds.
- Import posts from Canny, Featurebase, Productboard, or CSV.
- Add optional AI assist with any OpenAI-compatible provider for thread summaries, tag suggestions, and changelog drafts.
- Add a per-person vote limit.
- Write changelog entries in markdown. Headings such as `## New` and `## Fixed`, or `[Removed]` tags, become section chips.
- Group settings under clearer tabs: Notifications, Integrations, and Team.
- Document the public API, webhook signatures, and Zapier and Make recipes in `docs/api.md`.

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
