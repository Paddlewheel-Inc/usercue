import { Hono } from "hono";
import { InboundError, inboundSecret, noteInbound, processInbound } from "../inbound";
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
  if (!verified) {
    noteInbound(
      false,
      "A request failed the signature check. Paste the signing secret from the same Resend webhook.",
    );
    return c.json({ error: "Invalid signature" }, 401);
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(body) as ResendEvent;
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
