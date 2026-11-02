import type { WorkflowStatus } from "@usercue/shared";
import { db } from "./db";

export const listWorkflow = db.query<WorkflowStatus>(
  "SELECT id, name, icon, color, category FROM workflow_statuses ORDER BY position, id",
);
export const findWorkflowStatus = db.query<WorkflowStatus>(
  "SELECT id, name, icon, color, category FROM workflow_statuses WHERE id = ?",
);
export async function workflowName(id: string) {
  return (await findWorkflowStatus.get(id))?.name ?? id;
}
