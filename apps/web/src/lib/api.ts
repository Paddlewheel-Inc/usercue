import type { AppType } from "@usercue/server";
import type { Permission } from "@usercue/shared";
import type { InferResponseType } from "hono/client";
import { hc } from "hono/client";

export const api = hc<AppType>("/").api;

export type Post = InferResponseType<typeof api.posts.$get, 200>[number];
export type PostDetail = InferResponseType<(typeof api.posts)[":id"]["$get"], 200>;
export type Comment = PostDetail["comments"][number];
export type ChangelogList = InferResponseType<typeof api.changelog.$get, 200>;
export type ChangelogEntry = ChangelogList["entries"][number];
export type ChangelogDetail = InferResponseType<(typeof api.changelog)[":id"]["$get"], 200>;
export type ChangelogComment = ChangelogDetail["comments"][number];
export type Board = InferResponseType<typeof api.boards.$get, 200>[number];
export type AuthProvider = InferResponseType<typeof api.auth.providers.$get, 200>[number];
export type WorkspaceSettings = InferResponseType<typeof api.settings.$get, 200>;
type ApiKeysRoute = (typeof api.settings)["api-keys"];
export type ApiKey = InferResponseType<ApiKeysRoute["$get"], 200>[number];
export type CreatedApiKey = InferResponseType<ApiKeysRoute["$post"], 201>;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export const apiKeys = {
  list: () => unwrap(api.settings["api-keys"].$get()),
  create: (body: { name: string; permissions: Permission[] }) =>
    unwrap(api.settings["api-keys"].$post({ json: body })),
  updatePermissions: (id: number, permissions: Permission[]) =>
    unwrap(
      api.settings["api-keys"][":id"].$patch({
        param: { id: String(id) },
        json: { permissions },
      }),
    ),
  revoke: (id: number) =>
    unwrap(api.settings["api-keys"][":id"].$delete({ param: { id: String(id) } })),
};

type JsonResponse = { ok: boolean; status: number; json(): Promise<unknown> };
type Success<R extends JsonResponse> = Exclude<Awaited<ReturnType<R["json"]>>, { error: string }>;

export async function uploadImage(file: File): Promise<string> {
  const data = new FormData();
  data.append("file", file);
  const res = await fetch("/api/uploads", { method: "POST", body: data });
  const body = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !body.url) throw new ApiError(body.error ?? "Could not upload image", res.status);
  return body.url;
}

export async function unwrap<R extends JsonResponse>(response: Promise<R>): Promise<Success<R>> {
  const res = await response;
  const body = await res.json();
  if (!res.ok) {
    const message = (body as { error?: string } | null)?.error ?? "Something went wrong";
    throw new ApiError(message, res.status);
  }
  return body as Success<R>;
}
