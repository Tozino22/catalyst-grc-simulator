import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { initState, type ScenarioConfig } from '@/lib/sim';
import { SignOut } from '@/components/SignOut';

export const dynamic = 'force-dynamic';

// Server action: start (or resume) a session for a scenario, then open it.
async function openScenario(formData: FormData) {
  'use server';
  const scenarioId = String(formData.get('scenarioId'));
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: existing } = await supabase
    .from('sim_sessions')
    .select('id')
    .eq('user_id', user.id)
    .eq('scenario_id', scenarioId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) redirect(`/learn/${existing.id}`);

  const { data: scenario } = await supabase
    .from('scenarios').select('config').eq('id', scenarioId).single();
  const state = initState(scenario!.config as ScenarioConfig);

  const { data: created } = await supabase
    .from('sim_sessions')
    .insert({ user_id: user.id, scenario_id: scenarioId, state })
    .select('id').single();

  redirect(`/learn/${created!.id}`);
}

export default async function LearnPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
  const { data: scenarios } = await supabase
    .from('scenarios').select('id, title, description').eq('published', true).order('created_at');
  const { data: sessions } = await supabase
    .from('sim_sessions').select('scenario_id, readiness, status');

  const byScenario = new Map((sessions ?? []).map((s) => [s.scenario_id, s]));

  return (
    <div className="page-pad">
      <div className="page-head">
        <div>
          <h1>Welcome{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}</h1>
          <div className="sub">Choose a lab and start working as the GRC analyst.</div>
        </div>
        <div className="right"><SignOut /></div>
      </div>

      <div className="grid" style={{ gap: 14 }}>
        {(scenarios ?? []).map((s) => {
          const sess = byScenario.get(s.id);
          return (
            <div className="card scenario-card" key={s.id}>
              <div className="ic2">GRC</div>
              <div style={{ flex: 1 }}>
                <b style={{ fontSize: 17 }}>{s.title}</b>
                <div style={{ color: 'var(--muted)', fontSize: 13.5, marginTop: 4 }}>{s.description}</div>
                {sess && (
                  <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--muted)' }}>
                    In progress · Readiness <b style={{ color: 'var(--teal-ink)' }}>{sess.readiness}%</b>
                  </div>
                )}
              </div>
              <form action={openScenario}>
                <input type="hidden" name="scenarioId" value={s.id} />
                <button className="btn btn-primary" type="submit">{sess ? 'Resume →' : 'Start lab →'}</button>
              </form>
            </div>
          );
        })}
        {(!scenarios || scenarios.length === 0) && (
          <div className="card">No labs published yet. (Run the seed in <code>supabase/schema.sql</code>.)</div>
        )}
      </div>
    </div>
  );
}
