'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function createTask(orgId: string, formData: FormData) {
  const title = String(formData.get('title') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const owner = String(formData.get('owner') || '').trim();
  const due = String(formData.get('due') || '').trim() || null;
  const severity = String(formData.get('severity') || 'medium');
  if (!title) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc('create_task', {
    p_org: orgId, p_title: title, p_description: description, p_owner: owner,
    p_due: due, p_severity: severity, p_finding: null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/app/${orgId}/tasks`);
}

export async function setTaskStatus(orgId: string, taskId: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_task_status', { p_task: taskId, p_status: status });
  if (error) throw new Error(error.message);
  revalidatePath(`/app/${orgId}/tasks`);
}
