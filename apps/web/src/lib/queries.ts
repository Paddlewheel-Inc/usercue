import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AssignmentMode,
  AuthProviderId,
  ChangelogReaction,
  Permission,
  Sort,
  Status,
  TagColor,
} from "@usercue/shared";
import { applyAccent } from "./accent";
import { type AuthProvider, api, type Post, type PostDetail, unwrap } from "./api";

export type { AuthProvider };

export interface PostFilters {
  board?: string;
  status?: Status;
  sort?: Sort;
  q?: string;
}

export const useMe = () =>
  useQuery({
    queryKey: ["me"],
    queryFn: () => unwrap(api.auth.me.$get()),
    staleTime: 60_000,
    retry: 2,
  });

export function can(
  me: { user: { permissions: Permission[] } | null } | undefined,
  permission: Permission,
) {
  return Boolean(me?.user?.permissions.includes(permission));
}

export function isStaff(me: { user: { staff?: boolean } | null } | undefined) {
  return Boolean(me?.user?.staff);
}

export const useBoards = () =>
  useQuery({
    queryKey: ["boards"],
    queryFn: () => unwrap(api.boards.$get()),
    staleTime: 5 * 60_000,
  });

export const usePosts = (filters: PostFilters) =>
  useQuery({
    queryKey: ["posts", filters],
    queryFn: () => unwrap(api.posts.$get({ query: filters })),
    placeholderData: keepPreviousData,
  });

export const useCounts = (board?: string) =>
  useQuery({
    queryKey: ["counts", board],
    queryFn: () => unwrap(api.posts.counts.$get({ query: { board } })),
  });

export const usePost = (id: number | undefined) =>
  useQuery({
    queryKey: ["post", id],
    queryFn: () => unwrap(api.posts[":id"].$get({ param: { id: String(id) } })),
    enabled: id !== undefined,
  });

function useInvalidatePosts() {
  const qc = useQueryClient();
  return () =>
    Promise.all(
      ["posts", "post", "counts"].map((key) => qc.invalidateQueries({ queryKey: [key] })),
    );
}

export function useCreatePost() {
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: (body: {
      board: string;
      title: string;
      body: string;
      name?: string;
      tagIds?: number[];
    }) => unwrap(api.posts.$post({ json: body })),
    onSuccess: invalidate,
  });
}

export function useVote() {
  const qc = useQueryClient();
  const invalidate = useInvalidatePosts();

  const toggle = <T extends Pick<Post, "id" | "voted" | "voteCount">>(id: number, post: T): T =>
    post.id === id
      ? { ...post, voted: !post.voted, voteCount: post.voteCount + (post.voted ? -1 : 1) }
      : post;

  return useMutation({
    mutationFn: (id: number) => unwrap(api.posts[":id"].vote.$post({ param: { id: String(id) } })),
    onMutate: (id) => {
      qc.setQueriesData<Post[]>({ queryKey: ["posts"] }, (old) => old?.map((p) => toggle(id, p)));
      qc.setQueryData<PostDetail>(["post", id], (old) => old && toggle(id, old));
    },
    onSettled: invalidate,
  });
}

export function useAddComment(postId: number) {
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: (body: { body: string; name?: string; parentId?: number }) =>
      unwrap(api.posts[":id"].comments.$post({ param: { id: String(postId) }, json: body })),
    onSuccess: invalidate,
  });
}

export function useDeleteComment(postId: number) {
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: (commentId: number) =>
      unwrap(
        api.posts[":id"].comments[":commentId"].$delete({
          param: { id: String(postId), commentId: String(commentId) },
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useUpdatePost(id: number) {
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: (patch: {
      status?: Status;
      title?: string;
      body?: string;
      assigneeId?: number | null;
      tagIds?: number[];
    }) => unwrap(api.posts[":id"].$patch({ param: { id: String(id) }, json: patch })),
    onSuccess: invalidate,
  });
}

export function useDeletePost(id: number) {
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: () => unwrap(api.posts[":id"].$delete({ param: { id: String(id) } })),
    onSuccess: invalidate,
  });
}

function useInvalidateChangelog() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["changelog"] });
}

export const useChangelog = (enabled = true) =>
  useQuery({
    queryKey: ["changelog"],
    queryFn: () => unwrap(api.changelog.$get()),
    enabled,
  });

export const useChangelogEntry = (id: number | undefined) =>
  useQuery({
    queryKey: ["changelog", id],
    queryFn: () => unwrap(api.changelog[":id"].$get({ param: { id: String(id) } })),
    enabled: id !== undefined,
  });

export interface ChangelogDraft {
  title: string;
  body: string;
  postId?: number | null;
  sections: { label: string; body: string }[];
  contributorIds: number[];
}

export function useCreateChangelogEntry() {
  const invalidate = useInvalidateChangelog();
  return useMutation({
    mutationFn: (body: ChangelogDraft) => unwrap(api.changelog.$post({ json: body })),
    onSuccess: invalidate,
  });
}

export function useUpdateChangelogEntry(id: number) {
  const invalidate = useInvalidateChangelog();
  return useMutation({
    mutationFn: (body: ChangelogDraft) =>
      unwrap(api.changelog[":id"].$patch({ param: { id: String(id) }, json: body })),
    onSuccess: invalidate,
  });
}

export const useChangelogPeople = (enabled = true) =>
  useQuery({
    queryKey: ["changelog-people"],
    queryFn: () => unwrap(api.changelog.people.$get()),
    enabled,
  });

export function useDeleteChangelogEntry(id: number) {
  const invalidate = useInvalidateChangelog();
  return useMutation({
    mutationFn: () => unwrap(api.changelog[":id"].$delete({ param: { id: String(id) } })),
    onSuccess: invalidate,
  });
}

export function useAddChangelogComment(id: number) {
  const invalidate = useInvalidateChangelog();
  return useMutation({
    mutationFn: (body: string) =>
      unwrap(api.changelog[":id"].comments.$post({ param: { id: String(id) }, json: { body } })),
    onSuccess: invalidate,
  });
}

export function useDeleteChangelogComment(id: number) {
  const invalidate = useInvalidateChangelog();
  return useMutation({
    mutationFn: (commentId: number) =>
      unwrap(
        api.changelog[":id"].comments[":commentId"].$delete({
          param: { id: String(id), commentId: String(commentId) },
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useChangelogReaction(id: number) {
  const invalidate = useInvalidateChangelog();
  return useMutation({
    mutationFn: (reaction: ChangelogReaction) =>
      unwrap(
        api.changelog[":id"].reactions.$post({ param: { id: String(id) }, json: { reaction } }),
      ),
    onSuccess: invalidate,
  });
}

export function useCreateBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => unwrap(api.boards.$post({ json: { name } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["boards"] }),
  });
}

export function useRenameBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, name }: { slug: string; name: string }) =>
      unwrap(api.boards[":slug"].$patch({ param: { slug }, json: { name } })),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["boards"] }),
        qc.invalidateQueries({ queryKey: ["posts"] }),
      ]),
  });
}

function refreshTags(qc: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ["tags"] }),
    qc.invalidateQueries({ queryKey: ["posts"] }),
    qc.invalidateQueries({ queryKey: ["post"] }),
  ]);
}

export function useTags(enabled = true) {
  return useQuery({
    queryKey: ["tags"],
    queryFn: () => unwrap(api.tags.$get()),
    enabled,
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; color: TagColor }) => unwrap(api.tags.$post({ json: body })),
    onSuccess: () => refreshTags(qc),
  });
}

export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: number; name?: string; color?: TagColor }) =>
      unwrap(api.tags[":id"].$patch({ param: { id: String(id) }, json: patch })),
    onSuccess: () => refreshTags(qc),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => unwrap(api.tags[":id"].$delete({ param: { id: String(id) } })),
    onSuccess: () => refreshTags(qc),
  });
}

export const useAuthMethods = () =>
  useQuery({
    queryKey: ["auth-methods"],
    queryFn: () => unwrap(api.auth.methods.$get()),
    staleTime: 60_000,
  });

export const useLinkedAccounts = () =>
  useQuery({
    queryKey: ["auth-links"],
    queryFn: () => unwrap(api.auth.links.$get()),
  });

export function useUnlinkAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (provider: string) =>
      unwrap(api.auth.links[":provider"].$delete({ param: { provider } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auth-links"] }),
  });
}

export const useProviders = () =>
  useQuery({
    queryKey: ["auth-providers"],
    queryFn: () => unwrap(api.auth.providers.$get()),
  });

export function useSaveProvider(id: AuthProviderId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (json: {
      clientId: string;
      secret?: string;
      enabled: boolean;
      allowSignup: boolean;
    }) => unwrap(api.auth.providers[":provider"].$put({ param: { provider: id }, json })),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["auth-providers"] }),
        qc.invalidateQueries({ queryKey: ["auth-methods"] }),
      ]),
  });
}

export function useDeleteProvider(id: AuthProviderId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.auth.providers[":provider"].$delete({ param: { provider: id } })),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["auth-providers"] }),
        qc.invalidateQueries({ queryKey: ["auth-methods"] }),
      ]),
  });
}

export const useSettings = (enabled = true) =>
  useQuery({
    queryKey: ["settings"],
    queryFn: () => unwrap(api.settings.$get()),
    enabled,
  });

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (json: {
      allowGuestFeedback?: boolean;
      changelogEnabled?: boolean;
      changelogComments?: boolean;
      changelogReactions?: boolean;
      assignmentMode?: AssignmentMode;
      resendEnabled?: boolean;
      resendFrom?: string;
      resendApiKey?: string;
      smtpHost?: string;
      smtpEnabled?: boolean;
      smtpPort?: number;
      smtpUser?: string;
      smtpPass?: string;
      smtpFrom?: string;
      smtpSecure?: boolean;
      discordEnabled?: boolean;
      discordWebhookUrl?: string;
      teamsEnabled?: boolean;
      teamsWebhookUrl?: string;
      oauthOnly?: boolean;
      customerTags?: boolean;
      customerTagsRequired?: boolean;
    }) => unwrap(api.settings.$patch({ json })),
    onSuccess: (data) => {
      qc.setQueryData(["settings"], data);
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["auth-methods"] });
    },
  });
}

export function useSaveBranding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (json: {
      accent?: string;
      logoUrl?: string;
      logoDarkUrl?: string;
      faviconUrl?: string;
      shareImageUrl?: string;
      siteName?: string;
      siteDescription?: string;
    }) => unwrap(api.settings.branding.$patch({ json })),
    onSuccess: (data) => {
      applyAccent(data.accent);
      qc.setQueryData(["settings"], data);
      return qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useInviteStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => unwrap(api.settings.invites.$post({ json: { email } })),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["settings"] }),
        qc.invalidateQueries({ queryKey: ["settings-users"] }),
      ]),
  });
}

export function useRevokeInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      unwrap(api.settings.invites[":id"].$delete({ param: { id: String(id) } })),
    onSuccess: (data) => qc.setQueryData(["settings"], data),
  });
}

export function useRemoveStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      unwrap(api.settings.staff[":id"].$delete({ param: { id: String(id) } })),
    onSuccess: (data) => qc.setQueryData(["settings"], data),
  });
}

export const useInvite = (token: string | undefined) =>
  useQuery({
    queryKey: ["invite", token],
    queryFn: () => unwrap(api.auth.invite[":token"].$get({ param: { token: token ?? "" } })),
    enabled: Boolean(token),
    retry: false,
  });

export const useWorkspaceUsers = (enabled = true) =>
  useQuery({
    queryKey: ["settings-users"],
    queryFn: () => unwrap(api.settings.users.$get()),
    enabled,
  });

export function useUpdateWorkspaceUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...json }: { id: number; suspended?: boolean; roleId?: number }) =>
      unwrap(api.settings.users[":id"].$patch({ param: { id: String(id) }, json })),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["settings-users"] }),
        qc.invalidateQueries({ queryKey: ["settings"] }),
        qc.invalidateQueries({ queryKey: ["settings-roles"] }),
      ]),
  });
}

export function useDeleteWorkspaceUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      unwrap(api.settings.users[":id"].$delete({ param: { id: String(id) } })),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["settings-users"] }),
        qc.invalidateQueries({ queryKey: ["settings"] }),
        qc.invalidateQueries({ queryKey: ["settings-roles"] }),
      ]),
  });
}

export const useRoles = () =>
  useQuery({
    queryKey: ["settings-roles"],
    queryFn: () => unwrap(api.settings.roles.$get()),
  });

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (json: { name: string; permissions: Permission[] }) =>
      unwrap(api.settings.roles.$post({ json })),
    onSuccess: (data) => qc.setQueryData(["settings-roles"], data),
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...json
    }: {
      id: number;
      name?: string;
      permissions?: Permission[];
      iconUrl?: string;
    }) => unwrap(api.settings.roles[":id"].$patch({ param: { id: String(id) }, json })),
    onSuccess: (data) => {
      qc.setQueryData(["settings-roles"], data);
      qc.invalidateQueries({ queryKey: ["posts"] });
      qc.invalidateQueries({ queryKey: ["post"] });
      qc.invalidateQueries({ queryKey: ["settings-users"] });
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useReorderRoles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => unwrap(api.settings.roles.order.$patch({ json: { ids } })),
    onSuccess: (data) => qc.setQueryData(["settings-roles"], data),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      unwrap(api.settings.roles[":id"].$delete({ param: { id: String(id) } })),
    onSuccess: (data) => qc.setQueryData(["settings-roles"], data),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (json: {
      name?: string;
      password?: string;
      currentPassword?: string;
      avatarUrl?: string;
    }) => unwrap(api.auth.me.$patch({ json })),
    onSuccess: () =>
      Promise.all(
        ["me", "posts", "post", "changelog", "settings", "settings-users"].map((key) =>
          qc.invalidateQueries({ queryKey: [key] }),
        ),
      ),
  });
}

export function useAcceptInvite(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (json: { email: string; name: string; password: string }) =>
      unwrap(api.auth.invite[":token"].$post({ param: { token }, json })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });
}

export function useAuth() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["me"] });
  return {
    login: useMutation({
      mutationFn: (json: { email: string; password: string }) =>
        unwrap(api.auth.login.$post({ json })),
      onSuccess: refresh,
    }),
    setup: useMutation({
      mutationFn: (json: { email: string; password: string; name: string }) =>
        unwrap(api.auth.setup.$post({ json })),
      onSuccess: () => Promise.all([refresh(), qc.invalidateQueries({ queryKey: ["boards"] })]),
    }),
    logout: useMutation({
      mutationFn: () => unwrap(api.auth.logout.$post()),
      onSuccess: () => {
        qc.setQueryData(["me"], (current) =>
          current ? { ...current, user: null, identity: null } : current,
        );
        return refresh();
      },
    }),
  };
}
