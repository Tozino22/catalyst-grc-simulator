import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createTask, setTaskStatus } from './actions';

export const dynamic = 'force-dynamic';

type Task = {
  id: string; title: string; description: string | null; owner_name: string | null;
  due_date: string | null; severity: string; status: string;
};
const SEV: Record<string, string> = { critical: 'var(--bad)', high: '#d9660b', medium: 'var(--warn)', low: 'var(--muted)', info: 'var(--faint)' };
const NEXT: Record<string, { to: string; label: string }> = {
  open: { to: 'in_progress', label: 'Start' },
  in_progress: { to: 'done', label: 'Mark done' },
  done: { to: 'open', label: 'Reopen' },
};

export default async function TasksPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: org } = await supabase.from('orgs').select('id, name').eq('id', orgId).single();
  if (!org) notFound();

  const { data: tasks } = await supabase
    .from('tasks').select('id, title, description, owner_name, due_date, severity, status')
    .eq('org_id', orgId).order('created_at', { ascending: true });
  const rows = (tasks ?? []) as Task[];

  const cols: Array<{ key: string; label: string }> = [
    { key: 'open', label: 'Open' }, { key: 'in_progress', label: 'In progress' }, { key: 'done', label: 'Done' },
  ];
  const bind = createTask.bind(null, orgId);

  return (
    <div className="page-pad">
      <div className="page-head">
        <div><h1>Tasks — {org.name}</h1><div className="sub">Remediation tracking — owner &amp; due date</div></div>
        <div className="right"><Link className="btn btn-sm" href={`/app/${orgId}`}>← Workspace</Link></div>
      </div>

      <div className="grid cols-3" style={{ marginBottom: 20 }}>
        {cols.map((c) => {
          const items = rows.filter((t) => t.status === c.key);
          return (
            <div key={c.key} className="card" style={{ padding: 14 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>{c.label} <span className="pill">{items.length}</span></div>
              {items.length === 0 && <div className="sub">Nothing here.</div>}
              {items.map((t) => (
                <div key={t.id} style={{ borderTop: '1px solid var(--line)', padding: '10px 0' }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span className="pill" style={{ color: SEV[t.severity], textTransform: 'uppercase', fontSize: 10, fontWeight: 700 }}>{t.severity}</span>
                    <b style={{ fontSize: 13.5 }}>{t.title}</b>
                  </div>
                  {t.description && <div className="sub" style={{ margin: '3px 0 0' }}>{t.description}</div>}
                  <div className="sub" style={{ margin: '5px 0 0', fontSize: 12 }}>
                    {t.owner_name ? `👤 ${t.owner_name}` : 'Unassigned'}{t.due_date ? ` · due ${t.due_date}` : ''}
                  </div>
                  <form action={setTaskStatus.bind(null, orgId, t.id, NEXT[t.status].to)} style={{ marginTop: 6 }}>
                    <button className="btn btn-sm" type="submit">{NEXT[t.status].label}</button>
                  </form>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="card" style={{ padding: 18, maxWidth: 560 }}>
        <h2 style={{ marginTop: 0 }}>Add a task</h2>
        <form action={bind}>
          <div className="field"><label>Title</label><input name="title" placeholder="e.g. Enforce MFA on admin console" required /></div>
          <div className="field"><label>Description</label><input name="description" placeholder="What needs doing" /></div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="field" style={{ flex: 1 }}><label>Owner</label><input name="owner" placeholder="Name" /></div>
            <div className="field" style={{ flex: 1 }}><label>Due date</label><input name="due" type="date" /></div>
            <div className="field" style={{ flex: 1 }}><label>Severity</label>
              <select name="severity" defaultValue="medium">
                <option value="critical">critical</option><option value="high">high</option>
                <option value="medium">medium</option><option value="low">low</option><option value="info">info</option>
              </select></div>
          </div>
          <button className="btn btn-primary" type="submit" style={{ marginTop: 14 }}>Add task</button>
        </form>
      </div>
    </div>
  );
}
