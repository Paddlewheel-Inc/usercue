<div align="left">
  <img src="https://cdn.paddlewheel.org/brand/brandfull.svg" height="28px" alt="UserCue" />
</div>

# A board for ideas, and a desk for the people who ship them

[Website](https://usercue.app) · [Documentation](https://docs.usercue.app) · [GitHub](https://github.com/usercue/usercue)

UserCue is a feedback home from [Paddlewheel](https://paddlewheel.org). People leave suggestions, vote, and follow a public roadmap. The team triages that pile, writes a changelog, and tells Discord or Teams when something moves. The product stays out of the way.

If something feels off, or you want a board to behave differently, open an issue. We read them.

## Run it

You need [Bun](https://bun.com) and [PostgreSQL](https://www.postgresql.org) 17. The first boot creates the local `usercue` role and database if they are missing. Email and sign-in providers can wait until later. Set those in the workspace settings.

```bash
bun install
bun run dev
```

The app is at [http://localhost:5173](http://localhost:5173). The API is at [http://localhost:3000](http://localhost:3000). A new database has no staff yet, so the first visit asks you to create the owner.

Prefer Docker? That stack brings Postgres, the API, and Vite up together, with the source mounted so edits reload.

```bash
bun run docker:dev
bun run docker:dev:down
```

Dev Postgres is published on port `5433`, so it does not collide with a Postgres you already have on `5432`.

`docker-compose.yml` is the production image. `docker-compose.dev.yml` is the one above.

Copy `.env.example` if you need to point at another database, turn on secure cookies, or set a public URL for OAuth. Local development works without that file. Do not commit a real `.env`.

| | |
| --- | --- |
| `bun run dev` | App and API, with reload |
| `bun run docker:dev` | The same stack in Docker |
| `bun run build` | Production web build |
| `bun run start` | App and API from one process |
| `bun run typecheck` | TypeScript across the workspace |
| `bun run lint` | Biome |

## What you get

**Boards.** Suggestions land on a board. People vote, comment, and reply. Guests can post, or you can ask them to sign in first.

**Roadmap.** Status is public. Open, planned, in progress, complete, closed. The roadmap is the same work, shown as a path instead of a list.

**Changelog.** Staff write what shipped. Comments and reactions are their own switches. Subscribers can follow the RSS feed. The address for that feed lives in settings.

**Workspace.** Tags, roles, and assignment live with the team. Automatic assignment hands the next planned suggestion to the next person in line.

**Sign-in.** GitHub, Discord, Google, Roblox, and Microsoft. Turn on the ones you actually use.

**Out the door.** New suggestions, status changes, and comments can post to a Discord channel or a Teams webhook.

## Built with

[![Bun, React, PostgreSQL, and Tailwind CSS](https://skillicons.dev/icons?i=bun,react,postgres,tailwind)](https://skillicons.dev)

The React app is `apps/web`. The API is `apps/server`. Shared types and limits are `packages/shared`. Schema is applied from `apps/server/src/db.ts` on startup. Pages talk to the API through the typed client in `apps/web/src/lib/api.ts`. They do not talk to Postgres.

## Docs

Product setup, OAuth, and settings are in the [documentation](https://docs.usercue.app).

## Thank you

These are the people who have helped shape UserCue

<a href="https://github.com/Paddlewheel-Inc/usercue/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Paddlewheel-Inc/usercue&max=100" alt="People who have committed to UserCue" />
</a>

## License

Copyright Paddlewheel Inc. UserCue is licensed under the [SLI-HR-1.0](LICENSE).

Anyone who receives a copy has to keep that license and the `Required Notice` line in `LICENSE`. Commercial use is not allowed. The UserCue name and logo stay with Paddlewheel Inc. and are not part of the license.

Commits follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).
