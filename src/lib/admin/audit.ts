import { getAdminClientSafe, AdminEnv } from './db'

// Admin action audit trail (compliance finding #2).
//
// Best-effort by design: auditing must NEVER break the underlying admin action,
// and it must degrade gracefully when migration 020 has not yet been applied to
// the target environment (the table simply does not exist). Every failure is
// swallowed. Because of that, callers do not await-and-check this — they fire it
// and continue.
//
// `actor` is the shared 'admin' identity until per-person admin accounts exist
// (finding #1); the schema already carries the column for that future state.

export interface AdminAuditEntry {
  env:         AdminEnv
  action:      string                         // e.g. 'admin.login', 'user.plan_change'
  actor?:      string
  targetType?: string                         // e.g. 'user', 'contact_submission'
  targetId?:   string | null
  metadata?:   Record<string, unknown>
  ip?:         string | null
}

/** Extract the best-available client IP from a request's forwarding headers. */
export function clientIp(req: { headers: { get(name: string): string | null } }): string | null {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return null
}

export async function logAdminAction(entry: AdminAuditEntry): Promise<void> {
  try {
    const result = getAdminClientSafe(entry.env)
    if (!result.ok) return
    await result.db.from('admin_audit_log').insert({
      actor:       entry.actor ?? 'admin',
      action:      entry.action,
      target_type: entry.targetType ?? null,
      target_id:   entry.targetId ?? null,
      metadata:    entry.metadata ?? null,
      ip:          entry.ip ?? null,
    })
  } catch {
    // Swallow — a missing table (migration not yet applied) or a transient write
    // failure must not affect the admin action that triggered this log.
  }
}
