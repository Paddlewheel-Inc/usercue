<div align="center">

<img src="https://cdn.paddlewheel.org/brand/usercue/usercuesolobrand.svg" height="40" alt="UserCue" />

# UserCue

**A board for ideas, and a desk for the people who ship them.**

Collect suggestions, let people vote, publish a roadmap, and close the loop with a changelog.

<p>
  <a href="https://usercue.app">Website</a> &nbsp;|&nbsp;
  <a href="https://docs.usercue.app">Documentation</a> &nbsp;|&nbsp;
  <a href="https://discord.usercue.app">Discord</a> &nbsp;|&nbsp;
  <a href="https://docs.usercue.app/api">API</a> &nbsp;|&nbsp;
  <a href="CHANGELOG.md">Changelog</a>
</p>

<p>
  <a href="https://discord.usercue.app"><img src="https://img.shields.io/badge/Discord-Get%20support-5865F2?style=flat-square&logo=discord&logoColor=white" alt="Join the UserCue Discord" /></a>
  <img src="https://img.shields.io/badge/License-SLI--HR--1.0-ff2b87?style=flat-square" alt="SLI-HR-1.0 license" />
  <img src="https://img.shields.io/badge/Bun-React%20%2B%20Hono-black?style=flat-square&logo=bun&logoColor=white" alt="Built with Bun, React, and Hono" />
</p>

<br />

<img src="https://cdn.paddlewheel.org/brand/usercue/demo.png" alt="The UserCue workspace" width="900" />

</div>

<br />

## Overview

UserCue is a feedback home from [Paddlewheel](https://paddlewheel.org). People leave suggestions, vote, and follow a public roadmap. Your team triages that pile, writes a changelog, and tells Discord, Teams, or Slack when something moves.

The product stays out of the way. You can run it yourself or let us host it.

| | |
| --- | --- |
| **Hosted** | Create an instance at [usercue.app](https://usercue.app) and you are live in a minute |
| **Self hosted** | Run it on your own server with Docker, or locally with Bun and Postgres |
| **Support** | Join the [Discord](https://discord.usercue.app) or open an [issue](https://github.com/Paddlewheel-Inc/usercue/issues) |

## Features

| Area | What you get |
| --- | --- |
| **Boards** | Suggestions land on a board. People vote, comment, and reply. Guests can post, or you can ask them to sign in first |
| **Roadmap** | Status is public: open, planned, in progress, complete, closed. The roadmap is the same work shown as a path |
| **Changelog** | Write in the rich editor or in markdown. Headings such as `## New`, `## Changed`, `## Fixed`, and `## Removed` become section chips. Readers can follow the RSS feed |
| **Triage** | Similar posts appear while someone types, so people vote instead of duplicating. Merge duplicates, score impact against effort, keep internal notes, filter by tag or assignee, and save views |
| **Closing the loop** | Voters hear when their request ships. Changelog entries link to the posts they close, and posts show a shipped badge. A weekly digest keeps the team current |
| **Workspace** | Tags, roles, and assignment live with the team. Automatic assignment hands the next planned suggestion to the next person in line |
| **Sign in** | GitHub, Discord, Google, Roblox, and Microsoft. Turn on the ones you use |
| **Out the door** | New suggestions, status changes, and comments can post to Discord, Teams, or Slack. Signed webhooks work with Zapier and Make |
| **In the door** | Feedback can arrive by email through Resend, from an embeddable widget or inline board, or from an import of Canny, Featurebase, Productboard, or any CSV |
| **Optional AI** | Bring any OpenAI-compatible key to summarize long threads, suggest tags, and draft changelog entries. It stays off until you add a key |
| **Control** | Limit votes per person, manage API keys, and review an audit log of who changed what |

> [!CAUTION]
> Wiping a board in **Settings, Danger zone** permanently deletes every request on it, along with its votes, comments, notes, and tags. There is no undo.

## Hosted

Do not want to run it yourself? Go to [usercue.app](https://usercue.app), create your instance, and skip the servers, Postgres, and upgrades.

| | Free | Pro |
| --- | --- | --- |
| **Price** | Free | 16.99 CAD$ per month |
| **Users per instance** | Up to 5 | Unlimited |
| **Extra instances** | No | Yes |

Custom domains are an add-on at 3.99 CAD$ per month and apply to any instance.

> [!WARNING]
> Only your first instance is free. Free instances are capped at 5 users, and once that limit is reached, new invitations are blocked until you upgrade to Pro or move to an additional instance. Upgrading removes the limit immediately.
>
> Pro costs 16.99 CAD$ per month. Custom domains are charged separately at 3.99 CAD$ per month.

## Self host

### Install on a server

The installer sets up Docker, generates your secrets, and can put automatic HTTPS in front of the app with Caddy. Point your domain at the server first.

```sh
curl -fsSL https://usercue.app/install.sh | sudo bash
```

| Flag | Default | Purpose |
| --- | --- | --- |
| `--domain` | none | Public domain. Turns on HTTPS |
| `--port` | `3000` | Port for plain HTTP mode |
| `--dir` | `/opt/usercue` | Install directory |
| `--branch` | `main` | Git branch or tag to deploy |
| `--yes` | off | Never prompt |
| `--force` | off | Continue even if the domain does not point at this server yet |

Running it again on an existing install upgrades it and keeps your `.env`.

> [!IMPORTANT]
> The installer writes a `.env` with a generated `SECRET_KEY`. Back that file up. The key encrypts OAuth secrets and webhook URLs in your database, and if you lose it those stored values become unreadable.

### Docker Compose

Use this when you already manage your own server or reverse proxy.

```sh
git clone https://github.com/Paddlewheel-Inc/usercue.git
cd usercue
cp .env.example .env
docker compose up -d
```

The app listens on port `3000`. The first visit asks you to create the owner account, because a new database has no staff yet.

> [!WARNING]
> Before you expose an instance to the internet, set these in `.env`:
>
> | Variable | Why |
> | --- | --- |
> | `POSTGRES_PASSWORD` | The default password is `usercue` |
> | `SECRET_KEY` | A long random value, so your encryption key survives a new disk |
> | `PUBLIC_URL` | The address people open, such as `https://feedback.example.com` |
> | `COOKIE_SECURE` | Set to `true` once the site is served over HTTPS |

> [!NOTE]
> Setting `COOKIE_SECURE=true` on a site served over plain HTTP stops sign in from working, because browsers will not send Secure cookies over HTTP.

### Configuration

Copy `.env.example` and change only what you need. Email, sign in providers, and chat channels can all be set later in the workspace settings.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Port the API listens on |
| `DATABASE_URL` | local Postgres | Postgres connection string |
| `DATA_DIR` | `data` | Uploaded images, and the generated key file when `SECRET_KEY` is empty |
| `SECRET_KEY` | empty | Encrypts OAuth client secrets and webhook URLs |
| `PUBLIC_URL` | empty | Used for OAuth redirects, shipped notices, the weekly digest, and email in |
| `COOKIE_SECURE` | `false` | Marks session cookies Secure for HTTPS sites |
| `USERCUE_IMAGE` | published image | The image the production stack runs |
| `RESEND_API_KEY`, `RESEND_FROM` | empty | Email for staff invites, used when settings have no key |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_SECURE` | empty | SMTP fallback when Resend is not configured |
| `USERCUE_PLAN_FILE` | empty | Path to a JSON plan file that limits staff seats |

> [!TIP]
> The settings page is the better place for email credentials. Keys saved there are hashed and encrypted.

## Develop

You need [Bun](https://bun.com) and [PostgreSQL](https://www.postgresql.org) 17. The first boot creates the local `usercue` role and database if they are missing.

```sh
bun install
bun run dev
```

| Service | Address |
| --- | --- |
| App | [http://localhost:5173](http://localhost:5173) |
| API | [http://localhost:3000](http://localhost:3000) |

Prefer Docker? One command starts Postgres, the API, and Vite together with the source mounted, so edits reload.

```sh
bun run docker:dev
bun run docker:dev:down
```

> [!NOTE]
> Dev Postgres is published on port `5433`, so it does not collide with a Postgres you already run on `5432`. `docker-compose.yml` is the production stack and `docker-compose.dev.yml` is the one above.

> [!WARNING]
> Never commit a real `.env`. Local development works without one.

### Scripts

| Command | What it does |
| --- | --- |
| `bun run dev` | App and API with reload |
| `bun run docker:dev` | The same stack in Docker |
| `bun run build` | Production web build |
| `bun run start` | App and API from one process |
| `bun run typecheck` | TypeScript across the workspace |
| `bun run lint` | Biome |
| `bun run format` | Biome, with fixes applied |

### Project layout

| Path | Contents |
| --- | --- |
| `apps/web` | React 19 app with wouter, TanStack Query, and Tailwind 4 |
| `apps/server` | Hono API. The schema is applied from `src/db.ts` on startup |
| `packages/shared` | Types and limits shared by both |
| `docs` | The [API guide](docs/api.md) and [release process](docs/releases.md) |

Pages talk to the API through the typed client in `apps/web/src/lib/api.ts`. They never talk to Postgres directly.

## API and integrations

Everything the app does goes through the same HTTP API. Create a key in **Settings, API keys**, choose its permissions, and send it as a bearer token.

```sh
curl -H "Authorization: Bearer uc_..." https://feedback.example.com/api/v1/posts
```

The [API guide](docs/api.md) covers endpoints, signed webhooks, and recipes for Zapier and Make.

## Support

Stuck, or want a board to behave differently? We would like to hear from you.

| Where | Best for |
| --- | --- |
| [Discord](https://discord.usercue.app) | Questions, setup help, and talking to the team |
| [GitHub issues](https://github.com/Paddlewheel-Inc/usercue/issues) | Bugs and feature requests |
| [Documentation](https://docs.usercue.app) | Product setup, OAuth, and settings |

## Contributing

Commits follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). To merge changes and publish an update, see [the release guide](docs/releases.md).

## Thank you

<a href="https://github.com/Paddlewheel-Inc/usercue/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Paddlewheel-Inc/usercue&max=100" alt="People who have committed to UserCue" />
</a>

## License

Copyright Paddlewheel Inc. UserCue is licensed under the [SLI-HR-1.0](LICENSE).

> [!IMPORTANT]
> Anyone who receives a copy has to keep that license and the `Required Notice` line in `LICENSE`. Commercial use is not allowed. The UserCue name and logo stay with Paddlewheel Inc and are not part of the license.
