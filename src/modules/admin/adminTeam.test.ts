// Changing the admin team must never leave the panel without an active
// super admin, and nobody may lock themselves out.

import { describe, it, expect } from 'vitest';
import { adminChangeProblem } from './admin.team';

const superA = { id: 'a', role: 'super_admin', isActive: true };
const superB = { id: 'b', role: 'super_admin', isActive: true };
const plain = { id: 'c', role: 'admin', isActive: true };

describe('adminChangeProblem', () => {
  it('refuses to remove the last active super admin in any way', () => {
    for (const change of [{ role: 'admin' }, { isActive: false }, { delete: true }]) {
      expect(adminChangeProblem({ target: superB, actorId: 'x', change, activeSuperAdmins: 1 })).toMatch(/last active super admin/);
    }
  });

  it('allows it when another active super admin remains', () => {
    expect(adminChangeProblem({ target: superB, actorId: 'a', change: { role: 'admin' }, activeSuperAdmins: 2 })).toBe(null);
    expect(adminChangeProblem({ target: superB, actorId: 'a', change: { delete: true }, activeSuperAdmins: 2 })).toBe(null);
  });

  it('nobody changes their own role, deactivates or deletes themselves', () => {
    expect(adminChangeProblem({ target: superA, actorId: 'a', change: { role: 'admin' }, activeSuperAdmins: 5 })).toMatch(/own role/);
    expect(adminChangeProblem({ target: superA, actorId: 'a', change: { isActive: false }, activeSuperAdmins: 5 })).toMatch(/deactivate your own/);
    expect(adminChangeProblem({ target: superA, actorId: 'a', change: { delete: true }, activeSuperAdmins: 5 })).toMatch(/delete your own/);
  });

  it('allows harmless changes, including to yourself', () => {
    expect(adminChangeProblem({ target: superA, actorId: 'a', change: { role: 'super_admin', isActive: true }, activeSuperAdmins: 1 })).toBe(null);
    expect(adminChangeProblem({ target: superA, actorId: 'a', change: {}, activeSuperAdmins: 1 })).toBe(null);
    expect(adminChangeProblem({ target: plain, actorId: 'a', change: { role: 'finance', isActive: false }, activeSuperAdmins: 1 })).toBe(null);
  });

  it('an inactive super admin can be removed even when only one other is active', () => {
    const inactiveSuper = { id: 'd', role: 'super_admin', isActive: false };
    expect(adminChangeProblem({ target: inactiveSuper, actorId: 'a', change: { delete: true }, activeSuperAdmins: 1 })).toBe(null);
  });

  it('promoting someone never trips the guard', () => {
    expect(adminChangeProblem({ target: plain, actorId: 'a', change: { role: 'super_admin' }, activeSuperAdmins: 1 })).toBe(null);
  });
});
