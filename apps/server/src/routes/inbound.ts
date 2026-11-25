import { Hono } from "hono";
import { InboundError, inboundSecret, noteInbound, processInbound } from "../inbound";
import { verifyWebhookSignature } from "../signatures";

interface PostboundEvent {
  type?: string;
  data?: { email_id?: string };
}

export const inbound = new Hono().post("/postbound", async (c) => {
  const secret = await inboundSecret();
  if (!secret) return c.json({ error: "Not found" }, 404);

  const body = await c.req.text();
  const verified = verifyWebhookSignature(
    secret,
    {
      id: c.req.header("webhook-id") ?? "",
      timestamp: c.req.header("webhook-timestamp") ?? "",
      signature: c.req.header("webhook-signature") ?? "",
    },
    body,
  );
  if (!verified) {
    noteInbound(
      false,
      "A request failed the signature check. Paste the signing secret from the same Postbound webhook.",
    );
    return c.json({ error: "Invalid signature" }, 401);
  }

  let event: PostboundEvent;
  try {
    event = JSON.parse(body) as PostboundEvent;
  } catch {
    return c.json({ error: "Invalid payload" }, 400);
  }
  const emailId = event.data?.email_id;
  if (event.type !== "email.received" || !emailId) return c.json({ ok: true });

  try {
    const result = await processInbound(emailId);
    noteInbound(result.ok, result.message);
  } catch (error) {
    if (error instanceof InboundError) {
      noteInbound(false, error.message);
      return c.json({ error: error.message }, 502);
    }
    noteInbound(false, "Could not save the request. Check the server logs.");
    throw error;
  }
  return c.json({ ok: true });
});
