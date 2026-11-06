import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SignOut } from '@/components/SignOut';

export const dynamic = 'force-dynamic';

export default async function InstructorPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single();
  if (!me || (me.role !== 'instructor' && me.role !== 'admin')) redirect('/learn');

  // RLS lets staff read all sessions + profiles
  const { data: sessions } = await supabase
    .from('sim_sessions')
    .select('id, readiness, compliance, points, status, updated_at, learner:profiles(full_name), scenario:scenarios(title)')
    .order('updated_at', { ascending: false });

  const rows = (sessions ?? []) as unknown as Array<{
    id: string; readiness: number; compliance: number; points: number; status: string; updated_at: string;
    learner: { full_name: string | null } | null; scenario: { title: string } | null;
  }>;

  const learners = new Set(rows.map((r) => r.learner?.full_name ?? '—')).size;
  const avg = rows.length ? Math.round(rows.reduce((a, r) => a + r.readiness, 0) / rows.length) : 0;
  const completed = rows.filter((r) => r.status === 'completed').length;

  const fmt = (d: string) => new Date(d).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="page-pad">
      <div className="page-head">
        <div><h1>Instructor Dashboard</h1><div className="sub">Every learner’s progress across the labs</div></div>
        <div className="right">
          <a className="btn btn-sm" href="/learn">Learner view</a>
          <SignOut />
        </div>
      </div>

      <div className="stat-row">
        <div className="card kpi"><span className="n">{learners}</span><span className="l">Learners active</span></div>
        <div className="card kpi"><span className="n">{rows.length}</span><span className="l">Sessions</span></div>
        <div className="card kpi"><span className="n" style={{ color: 'var(--teal-ink)' }}>{avg}%</span><span className="l">Avg readiness</span></div>
        <div className="card kpi"><span className="n" style={{ color: 'var(--good)' }}>{completed}</span><span className="l">Completed</span></div>
      </div>

      <div className="card" style={{ padding: 6 }}>
        <table>
          <thead><tr><th>Learner</th><th>Lab</th><th>Readiness</th><th>Compliance</th><th>Points</th><th>Status</th><th>Last active</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><b>{r.learner?.full_name ?? '—'}</b></td>
                <td style={{ color: 'var(--muted)' }}>{r.scenario?.title ?? '—'}</td>
                <td><div className="bar-cell"><div className="mini-bar"><span style={{ width: `${r.readiness}%` }} /></div><b>{r.readiness}%</b></div></td>
                <td>{r.compliance}%</td>
                <td>{r.points}</td>
                <td><span className={`pill ${r.status === 'completed' ? 'done' : 'open'}`}>{r.status === 'completed' ? 'Completed' : 'In progress'}</span></td>
                <td style={{ color: 'var(--faint)', fontSize: 12.5 }}>{fmt(r.updated_at)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} style={{ color: 'var(--muted)', padding: 20 }}>No learner sessions yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
