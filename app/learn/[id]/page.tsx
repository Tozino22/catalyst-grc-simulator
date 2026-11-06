import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Sim from '@/components/Sim';
import type { ScenarioConfig, SimState } from '@/lib/sim';

export const dynamic = 'force-dynamic';

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: session } = await supabase
    .from('sim_sessions')
    .select('id, state, scenario:scenarios(title, config)')
    .eq('id', id)
    .single();

  if (!session) notFound();

  const scenario = session.scenario as unknown as { title: string; config: ScenarioConfig };
  const initial = { ...(session.state as SimState), _config: scenario.config };

  return <Sim sessionId={session.id} scenarioTitle={scenario.title} initial={initial} />;
}
