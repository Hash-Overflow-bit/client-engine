export type OperationLog = Readonly<{
  operation: string;
  outcome: 'succeeded' | 'failed';
  durationMs?: number;
  workspaceId?: string;
  entityId?: string;
  errorCategory?: string;
}>;

/** Creates a small, secret-free log record for server actions and jobs. */
export function toSafeOperationLog(entry: OperationLog): Record<string, string | number> {
  const record: Record<string, string | number> = {
    operation: entry.operation,
    outcome: entry.outcome,
  };
  if (typeof entry.durationMs === 'number') record.duration_ms = Math.max(0, Math.round(entry.durationMs));
  if (entry.workspaceId) record.workspace_id = entry.workspaceId;
  if (entry.entityId) record.entity_id = entry.entityId;
  if (entry.errorCategory) record.error_category = entry.errorCategory;
  return record;
}

export function logOperation(entry: OperationLog): void {
  console.info(JSON.stringify(toSafeOperationLog(entry)));
}
