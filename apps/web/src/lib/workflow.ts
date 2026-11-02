import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_WORKFLOW, STATUSES, type WorkflowStatus } from "@usercue/shared";
import { api, unwrap } from "./api";

export function useWorkflow() {
  const query = useQuery({
    queryKey: ["workflow"],
    queryFn: () => unwrap(api.workflow.$get()),
    staleTime: 60_000,
  });
  const statuses = [...(query.data ?? DEFAULT_WORKFLOW)].sort(
    (a, b) => STATUSES.indexOf(a.category) - STATUSES.indexOf(b.category),
  );
  return { ...query, statuses };
}

export function useWorkflowStatus(id: string) {
  const { statuses } = useWorkflow();
  return (
    statuses.find((status) => status.id === id) ?? {
      id,
      name: id,
      icon: "circle" as const,
      color: "#a8a29e",
      category: "open" as const,
    }
  );
}

export function useSaveWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: Omit<WorkflowStatus, "id"> & { id?: string }) =>
      status.id
        ? unwrap(api.workflow[":id"].$patch({ param: { id: status.id }, json: status }))
        : unwrap(api.workflow.$post({ json: status })),
    onSuccess: () =>
      Promise.all(
        ["workflow", "counts", "posts", "post"].map((key) =>
          qc.invalidateQueries({ queryKey: [key] }),
        ),
      ),
  });
}
