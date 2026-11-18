import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Health, TaskPriority, TaskStatus } from "@usercue/shared";
import { api, unwrap } from "./api";

export interface TaskFilters {
  person?: string;
  status?: TaskStatus | "open";
}

export interface TaskInput {
  title: string;
  description?: string;
  managerId?: number | null;
  health?: Health | "";
  memberIds?: number[];
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  blockedReason?: string;
}

const strId = (id: number) => ({ id: String(id) });

function useRefreshWork() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["tasks"] }),
      qc.invalidateQueries({ queryKey: ["task"] }),
    ]);
}

export const useTasks = (filters: TaskFilters, enabled = true) =>
  useQuery({
    queryKey: ["tasks", filters],
    queryFn: () => unwrap(api.tasks.$get({ query: filters })),
    placeholderData: keepPreviousData,
    enabled,
  });

export const useTask = (id: number | undefined) =>
  useQuery({
    queryKey: ["task", id],
    queryFn: () => unwrap(api.tasks[":id"].$get({ param: strId(id ?? 0) })),
    enabled: id !== undefined,
  });

export const useTaskStaff = () =>
  useQuery({
    queryKey: ["task-staff"],
    queryFn: () => unwrap(api.tasks.staff.$get()),
    staleTime: 5 * 60_000,
  });

export function useCreateTask() {
  const refresh = useRefreshWork();
  return useMutation({
    mutationFn: (json: TaskInput) => unwrap(api.tasks.$post({ json })),
    onSuccess: refresh,
  });
}

export function useUpdateTask() {
  const refresh = useRefreshWork();
  return useMutation({
    mutationFn: ({ id, ...json }: Partial<TaskInput> & { id: number }) =>
      unwrap(api.tasks[":id"].$patch({ param: strId(id), json })),
    onSuccess: refresh,
  });
}

export function useDeleteTask() {
  const refresh = useRefreshWork();
  return useMutation({
    mutationFn: (id: number) => unwrap(api.tasks[":id"].$delete({ param: strId(id) })),
    onSuccess: refresh,
  });
}

export function usePostTaskActivity() {
  const refresh = useRefreshWork();
  return useMutation({
    mutationFn: ({
      id,
      ...json
    }: {
      id: number;
      body: string;
      status?: TaskStatus;
      health?: Health | "";
    }) => unwrap(api.tasks[":id"].activity.$post({ param: strId(id), json })),
    onSuccess: refresh,
  });
}

export function useDeleteTaskActivity() {
  const refresh = useRefreshWork();
  return useMutation({
    mutationFn: ({ id, activityId }: { id: number; activityId: number }) =>
      unwrap(
        api.tasks[":id"].activity[":activityId"].$delete({
          param: { id: String(id), activityId: String(activityId) },
        }),
      ),
    onSuccess: refresh,
  });
}

export function useAddBlocker() {
  const refresh = useRefreshWork();
  return useMutation({
    mutationFn: ({ id, blockerId }: { id: number; blockerId: number }) =>
      unwrap(
        api.tasks[":id"].blockers[":blockerId"].$put({
          param: { id: String(id), blockerId: String(blockerId) },
        }),
      ),
    onSuccess: refresh,
  });
}

export function useRemoveBlocker() {
  const refresh = useRefreshWork();
  return useMutation({
    mutationFn: ({ id, blockerId }: { id: number; blockerId: number }) =>
      unwrap(
        api.tasks[":id"].blockers[":blockerId"].$delete({
          param: { id: String(id), blockerId: String(blockerId) },
        }),
      ),
    onSuccess: refresh,
  });
}

export function useLinkTaskPost() {
  const refresh = useRefreshWork();
  return useMutation({
    mutationFn: ({ id, postId }: { id: number; postId: number }) =>
      unwrap(
        api.tasks[":id"].posts[":postId"].$put({
          param: { id: String(id), postId: String(postId) },
        }),
      ),
    onSuccess: refresh,
  });
}

export function useUnlinkTaskPost() {
  const refresh = useRefreshWork();
  return useMutation({
    mutationFn: ({ id, postId }: { id: number; postId: number }) =>
      unwrap(
        api.tasks[":id"].posts[":postId"].$delete({
          param: { id: String(id), postId: String(postId) },
        }),
      ),
    onSuccess: refresh,
  });
}

export function useAddMember() {
  const refresh = useRefreshWork();
  return useMutation({
    mutationFn: ({ id, userId }: { id: number; userId: number }) =>
      unwrap(
        api.tasks[":id"].members[":userId"].$put({
          param: { id: String(id), userId: String(userId) },
        }),
      ),
    onSuccess: refresh,
  });
}

export function useRemoveMember() {
  const refresh = useRefreshWork();
  return useMutation({
    mutationFn: ({ id, userId }: { id: number; userId: number }) =>
      unwrap(
        api.tasks[":id"].members[":userId"].$delete({
          param: { id: String(id), userId: String(userId) },
        }),
      ),
    onSuccess: refresh,
  });
}
