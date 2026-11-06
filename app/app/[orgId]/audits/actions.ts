'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { suggestMappings } from '@/lib/ai';

export async function createAudit(orgId: string, formData: FormData) {
  const name = String(formData.get('name') || '').trim();
  const target = String(formData.get('target') || '').trim();
  if (!name) return;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_audit', { p_org: orgId, p_name: name, p_target: target });
  if (error) throw new Error(error.message);
  revalidatePath(`/app/${orgId}/audits`);
  redirect(`/app/${orgId}/audits/${data}`);
}

export async function authorizeAudit(orgId: string, auditId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('authorize_audit', { p_audit: auditId });
  if (error) throw new Error(error.message);
  revalidatePath(`/app/${orgId}/audits/${auditId}`);
}

export async function addFinding(orgId: string, auditId: string, formData: FormData) {
  const title = String(formData.get('title') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const severity = String(formData.get('severity') || 'medium');
  const cwe = String(formData.get('cwe') || '').trim();
  if (!title) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc('add_finding', {
    p_audit: auditId, p_title: title, p_description: description, p_severity: severity, p_cwe: cwe,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/app/${orgId}/audits/${auditId}`);
}

export async function mapFinding(orgId: string, auditId: string, findingId: string, formData: FormData) {
  const requirementId = String(formData.get('requirement_id') || '');
  if (!requirementId) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc('map_finding', { p_finding: findingId, p_requirement: requirementId, p_rationale: '' });
  if (error) throw new Error(error.message);
  revalidatePath(`/app/${orgId}/audits/${auditId}`);
  revalidatePath(`/app/${orgId}`);
}

export async function unmapFinding(orgId: string, auditId: string, findingId: string, requirementId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('unmap_finding', { p_finding: findingId, p_requirement: requirementId });
  if (error) throw new Error(error.message);
  revalidatePath(`/app/${orgId}/audits/${auditId}`);
  revalidatePath(`/app/${orgId}`);
}

export async function setFindingStatus(orgId: string, auditId: string, findingId: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_finding_status', { p_finding: findingId, p_status: status });
  if (error) throw new Error(error.message);
  revalidatePath(`/app/${orgId}/audits/${auditId}`);
}

export async function createTaskFromFinding(orgId: string, auditId: string, findingId: string) {
  const supabase = await createClient();
  const { data: f } = await supabase.from('findings').select('title, description, severity').eq('id', findingId).single();
  if (!f) return;
  const { error } = await supabase.rpc('create_task', {
    p_org: orgId, p_title: `Remediate: ${f.title}`, p_description: f.description,
    p_owner: '', p_due: null, p_severity: f.severity, p_finding: findingId,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/app/${orgId}/tasks`);
  revalidatePath(`/app/${orgId}/audits/${auditId}`);
}

// Import findings from pasted CSV: title, severity, cwe, description
export async function importFindings(orgId: string, auditId: string, formData: FormData) {
  const csv = String(formData.get('csv') || '').trim();
  if (!csv) return;
  const supabase = await createClient();
  const valid = ['critical', 'high', 'medium', 'low', 'info'];
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const parts = line.split(',').map((p) => p.trim());
    const title = parts[0];
    if (!title || title.toLowerCase() === 'title') continue;
    const sevRaw = (parts[1] || 'medium').toLowerCase();
    const severity = valid.includes(sevRaw) ? sevRaw : 'medium';
    const cwe = parts[2] || '';
    const description = parts.slice(3).join(', ') || '';
    await supabase.rpc('add_finding', {
      p_audit: auditId, p_title: title, p_description: description, p_severity: severity, p_cwe: cwe,
    });
  }
  revalidatePath(`/app/${orgId}/audits/${auditId}`);
}

// AI: suggest the SOC 2 criteria this finding impacts, and map them (with rationale).
export async function suggestCriteria(orgId: string, auditId: string, findingId: string) {
  const supabase = await createClient();

  const { data: finding } = await supabase
    .from('findings').select('title, description, severity, cwe').eq('id', findingId).single();
  if (!finding) return;

  const { data: ofw } = await supabase.from('org_frameworks').select('framework_id').eq('org_id', orgId);
  const fwIds = (ofw ?? []).map((r: { framework_id: string }) => r.framework_id);
  let reqs: Array<{ id: string; ref: string; title: string }> = [];
  if (fwIds.length) {
    const { data } = await supabase.from('requirements').select('id, ref, title').in('framework_id', fwIds).order('sort', { ascending: true });
    reqs = (data ?? []) as Array<{ id: string; ref: string; title: string }>;
  }
  if (!reqs.length) return;

  const suggestions = await suggestMappings(finding as { title: string; description: string | null; severity: string; cwe: string | null }, reqs);
  const byRef = new Map(reqs.map((r) => [r.ref.toUpperCase(), r] as const));

  for (const s of suggestions) {
    const req = byRef.get(String(s.ref).toUpperCase());
    if (req) {
      await supabase.rpc('map_finding', { p_finding: findingId, p_requirement: req.id, p_rationale: s.rationale || 'AI-suggested' });
    }
  }
  revalidatePath(`/app/${orgId}/audits/${auditId}`);
  revalidatePath(`/app/${orgId}`);
}
