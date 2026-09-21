// src/modules/admin/admin.team.ts
//
// Rules for changing who the admins are. The one outcome that must never
// happen is a panel with no active super admin: nobody could then manage
// admins, plans or platform settings, and fixing it would take a database
// edit on production.

export interface AdminTarget {
  id: string;
  role: string;
  isActive: boolean;
}

export interface AdminChange {
  role?: string;
  isActive?: boolean;
  delete?: boolean;
}

/** Why this change is not allowed, or null if it is. */
export const adminChangeProblem = (params: {
  target: AdminTarget;
  actorId: string;
  change: AdminChange;
  /** Active super admins right now, the target included. */
  activeSuperAdmins: number;
}): string | null => {
  const { target, actorId, change, activeSuperAdmins } = params;
  const self = target.id === actorId;

  if (self && change.delete) return 'You cannot delete your own admin account.';
  if (self && change.role !== undefined && change.role !== target.role) {
    return 'You cannot change your own role. Ask another super admin.';
  }
  if (self && change.isActive === false) return 'You cannot deactivate your own admin account.';

  const isActiveSuper = target.role === 'super_admin' && target.isActive;
  const staysActiveSuper =
    !change.delete &&
    (change.role ?? target.role) === 'super_admin' &&
    (change.isActive ?? target.isActive);

  if (isActiveSuper && !staysActiveSuper && activeSuperAdmins <= 1) {
    return 'This is the last active super admin. Make someone else a super admin first.';
  }

  return null;
};
