'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createOrg(formData: FormData) {
  const name = String(formData.get('name') || '').trim();
  if (!name) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase.rpc('create_org', { p_name: name });

  if (error) throw new Error(error.message);

  revalidatePath('/app');
  redirect(`/app/${data}`);
}
