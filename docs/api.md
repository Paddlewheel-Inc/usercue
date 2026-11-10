# API, webhooks, and automation

Everything the app does goes through the same HTTP API. Create a key in **Settings → API keys**, choose the permissions it needs, and send it as a bearer token.

```sh
curl -H "Authorization: Bearer uc_..." https://feedback.example.com/api/v1/posts
```

A key can only do what its permissions allow. `GET /api/v1/me` returns the key's identity, which is handy for checking a connection.

## Useful endpoints

| Endpoint | Permission | What it does |
| --- | --- | --- |
| `GET /api/v1/posts` | none | List posts. Filters: `board`, `status`, `q`, `tag`, `assignee`, `minVotes`, `sort` (`top`, `new`, plus `priority` for staff keys). |
| `POST /api/v1/posts` | none | Create a post. |
| `PATCH /api/v1/posts/:id` | `manage_posts` | Change status, board, assignee, tags, `impact`, and `effort` (1 to 5). |
| `POST /api/v1/posts/:id/merge` | `manage_posts` | Merge into `{ "targetId": 12 }`. Votes and comments move over. |
| `GET /api/v1/posts/similar?q=` | none | Posts that look like the text you pass. |
| `GET /api/v1/changelog` | none | Published changelog entries. |
| `GET/POST /api/v1/integrations/webhooks` | `manage_settings` | List or create webhooks. |

## Webhooks

Add one in **Settings → Integrations**, or with `POST /api/v1/integrations/webhooks`. The signing secret is shown once.

Events:

- `post.created`
- `post.status_changed`
- `post.merged`
- `comment.created`
- `changelog.published`
- `ping`, sent by the **Send test** button

Each delivery is a `POST` with a JSON body:

```json
{
  "id": "6f1c...",
  "event": "post.status_changed",
  "createdAt": "2026-11-09T18:20:00.000Z",
  "data": { "id": 12, "title": "Dark mode", "status": "planned", "url": "https://feedback.example.com/post/12" }
}
```

Headers:

| Header | Value |
| --- | --- |
| `X-UserCue-Event` | The event name |
| `X-UserCue-Timestamp` | Unix seconds |
| `X-UserCue-Signature` | `sha256=` and the hex HMAC-SHA256 of `${timestamp}.${rawBody}` with your secret |

Reply with any `2xx` within 8 seconds. A timeout or `5xx` is retried once.

Verify the signature before you trust a request:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

export function verify(secret: string, headers: Headers, rawBody: string) {
  const timestamp = headers.get("x-usercue-timestamp") ?? "";
  const given = headers.get("x-usercue-signature") ?? "";
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")}`;
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}
```

## Zapier and Make

Neither needs a special app. Both can receive webhooks and call the API.

**Trigger a Zap or scenario from UserCue.** Create a **Webhooks by Zapier** (Catch Hook) or **Make** (Custom webhook) trigger, copy its URL, and add it under **Settings → Integrations → Webhooks**. Press **Send test** so the tool sees a sample, then map the fields from `data`.

**Act on UserCue from a Zap or scenario.** Use the HTTP module with:

- URL: `https://feedback.example.com/api/v1/posts`
- Header: `Authorization: Bearer uc_...`
- Body: JSON, for example `{ "board": "feature-requests", "title": "From Zapier" }`

Common recipes:

- New post → create a Linear or Jira issue.
- Status changed to `complete` → post to a customer success channel.
- New row in a spreadsheet → `POST /api/v1/posts` to turn it into a request.

## Email in

Turn emails into posts with Resend. Details live in **Settings → Integrations → Email in**.

1. In Resend, add a domain, enable receiving, and add the MX records.
2. Add a webhook pointing at `https://feedback.example.com/api/inbound/resend` for the `email.received` event.
3. Paste the endpoint's signing secret into UserCue and switch the feature on.

Mail to `board-slug@your-domain` goes to that board. Anything else goes to your first board. Your Resend API key (under **General**) is used to read the message body.

## Embeds

```html
<script src="https://feedback.example.com/api/embed.js" defer></script>
```

That adds a floating feedback button. Options on the script tag: `data-board`, `data-label`, `data-position` (`left` or `right`), `data-color` (a hex color), and `data-widget="off"` to skip the button.

Place the board, roadmap, or changelog inline:

```html
<div data-usercue-embed="feedback" data-board="feature-requests"></div>
<div data-usercue-embed="roadmap"></div>
<div data-usercue-embed="changelog"></div>
<script src="https://feedback.example.com/api/embed.js" data-widget="off" defer></script>
```

Visitors on your site vote without signing in. Each browser gets an anonymous id that is kept in local storage.
