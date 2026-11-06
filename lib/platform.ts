// Shared types + helpers for the GRC platform (real mode).

export type OrgRole =
  | 'consultant'
  | 'client_admin'
  | 'client_member'
  | 'client_viewer'
  | 'auditor';

export const ROLE_LABEL: Record<string, string> = {
  consultant: 'Consultant',
  client_admin: 'Client Admin',
  client_member: 'Member',
  client_viewer: 'Viewer',
  auditor: 'Auditor',
};

export const roleLabel = (r: string): string => ROLE_LABEL[r] ?? r;

// Who can edit content (controls, evidence, findings) vs. read-only roles.
export const canEdit = (r: OrgRole): boolean =>
  r === 'consultant' || r === 'client_admin' || r === 'client_member';

// Who can manage the org (members, settings).
export const canManage = (r: OrgRole): boolean =>
  r === 'consultant' || r === 'client_admin';
