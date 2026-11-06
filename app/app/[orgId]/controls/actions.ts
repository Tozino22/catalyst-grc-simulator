'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createControl(orgId: string, formData: FormData) {
  const title = String(formData.get('title') || '').trim();
  const description = String(formData.get('description') || '').trim();
  if (!title) return;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_control', {
    p_org: orgId, p_title: title, p_description: description,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/app/${orgId}/controls`);
  redirect(`/app/${orgId}/controls/${data}`);
}

export async function setStatus(orgId: string, controlId: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_control_status', { p_control: controlId, p_status: status });
  if (error) throw new Error(error.message);
  revalidatePath(`/app/${orgId}/controls/${controlId}`);
  revalidatePath(`/app/${orgId}/controls`);
  revalidatePath(`/app/${orgId}`);
}

export async function mapRequirement(orgId: string, controlId: string, formData: FormData) {
  const requirementId = String(formData.get('requirement_id') || '');
  if (!requirementId) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc('map_control', { p_control: controlId, p_requirement: requirementId });
  if (error) throw new Error(error.message);
  revalidatePath(`/app/${orgId}/controls/${controlId}`);
  revalidatePath(`/app/${orgId}`);
}

export async function unmapRequirement(orgId: string, controlId: string, requirementId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('unmap_control', { p_control: controlId, p_requirement: requirementId });
  if (error) throw new Error(error.message);
  revalidatePath(`/app/${orgId}/controls/${controlId}`);
  revalidatePath(`/app/${orgId}`);
}

export async function addEvidence(orgId: string, controlId: string, formData: FormData) {
  const type = String(formData.get('type') || 'link');
  const ref = String(formData.get('ref') || '').trim();
  const description = String(formData.get('description') || '').trim();
  if (!ref && !description) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc('add_evidence', {
    p_control: controlId, p_type: type, p_ref: ref, p_description: description,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/app/${orgId}/controls/${controlId}`);
  revalidatePath(`/app/${orgId}`);
}
