# UserCue releases

## [Unreleased]

- Add staff-only tasks for planning work next to your feedback. Give a task a status, priority, due date, and health (on track, at risk, or delayed), then name one manager and any number of members.
- Show tasks under Work in the sidebar, with Mine, Everyone, and Unowned views, quick add, and a My tasks count. Overview lists your open tasks.
- Mark a task as blocked and record why and which tasks it is waiting on. Blockers clear when the task leaves Blocked, and people waiting on a task are notified when it is done. Circular blockers are rejected.
- Link tasks to feedback requests so the work stays connected to what people asked for.
- Leave comments on a task. A comment can also change the task's status or health in the same step, and status changes, blockers, and member changes appear in the activity timeline. Long runs of updates collapse so the timeline stays short.
- Notify people in the bell when they are added to a task, made its manager, commented on, or when a blocker they were waiting on finishes.
- Add a Manage tasks permission for deleting tasks and comments that other people wrote. Existing roles that can manage posts get it automatically.
- Add task endpoints to the public API, documented in `docs/api.md`.
- Redesign dropdown menus across the app. They are borderless, thinner, and highlight one row at a time. The workflow Stage field now uses the same dropdown as everything else.
- Add a themed calendar date picker and auto-growing text fields.

## [1.2.2-rc.2]
- Add video support to media, drag-and-drop media support

## [1.2.2]
- Add video support to media, drag-and-drop media support

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
