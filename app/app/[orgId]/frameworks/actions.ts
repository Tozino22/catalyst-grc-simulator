'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function enableFramework(orgId: string, key: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('enable_framework', { p_org: orgId, p_framework_key: key });
  if (error) throw new Error(error.message);
  revalidatePath(`/app/${orgId}/frameworks`);
  revalidatePath(`/app/${orgId}`);
}

export async function disableFramework(orgId: string, frameworkId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('disable_framework', { p_org: orgId, p_framework: frameworkId });
  if (error) throw new Error(error.message);
  revalidatePath(`/app/${orgId}/frameworks`);
  revalidatePath(`/app/${orgId}`);
}
