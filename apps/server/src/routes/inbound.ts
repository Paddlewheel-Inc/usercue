import { Hono } from "hono";
import { InboundError, inboundSecret, processInbound } from "../inbound";
import { verifySvixSignature } from "../signatures";

interface ResendEvent {
  type?: string;
  data?: { email_id?: string };
}

export const inbound = new Hono().post("/resend", async (c) => {
  const secret = await inboundSecret();
  if (!secret) return c.json({ error: "Not found" }, 404);

  const body = await c.req.text();
  const verified = verifySvixSignature(
    secret,
    {
      id: c.req.header("svix-id") ?? "",
      timestamp: c.req.header("svix-timestamp") ?? "",
      signature: c.req.header("svix-signature") ?? "",
    },
    body,
  );
  if (!verified) return c.json({ error: "Invalid signature" }, 401);

  let event: ResendEvent;
  try {
    event = JSON.parse(body) as ResendEvent;
  } catch {
    return c.json({ error: "Invalid payload" }, 400);
  }
  const emailId = event.data?.email_id;
  if (event.type !== "email.received" || !emailId) return c.json({ ok: true });

  try {
    await processInbound(emailId);
  } catch (error) {
    if (error instanceof InboundError) return c.json({ error: error.message }, 502);
    throw error;
  }
  return c.json({ ok: true });
});
