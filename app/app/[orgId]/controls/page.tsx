import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createControl } from './actions';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, { label: string; color: string }> = {
  not_started: { label: 'Not started', color: 'var(--faint)' },
  in_progress: { label: 'In progress', color: 'var(--warn)' },
  implemented: { label: 'Implemented', color: 'var(--good)' },
  not_applicable: { label: 'N/A', color: 'var(--faint)' },
};

export default async function ControlsPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: org } = await supabase.from('orgs').select('id, name').eq('id', orgId).single();
  if (!org) notFound();

  const { data: controls } = await supabase
    .from('controls').select('id, title, status').eq('org_id', orgId).order('created_at', { ascending: true });
  const rows = (controls ?? []) as Array<{ id: string; title: string; status: string }>;

  const ids = rows.map((r) => r.id);
  const counts: Record<string, number> = {};
  if (ids.length) {
    const { data: crs } = await supabase.from('control_requirements').select('control_id').in('control_id', ids);
    (crs ?? []).forEach((c: { control_id: string }) => { counts[c.control_id] = (counts[c.control_id] || 0) + 1; });
  }

  const bind = createControl.bind(null, orgId);

  return (
    <div className="page-pad">
      <div className="page-head">
        <div>
          <h1>Controls — {org.name}</h1>
          <div className="sub">The safeguards you implement to satisfy the SOC 2 criteria</div>
        </div>
        <div className="right"><Link className="btn btn-sm" href={`/app/${orgId}`}>← Workspace</Link></div>
      </div>

      <div className="card" style={{ padding: 6, marginBottom: 20 }}>
        <table>
          <thead><tr><th>Control</th><th>Status</th><th>Mapped criteria</th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td><Link href={`/app/${orgId}/controls/${c.id}`} style={{ fontWeight: 600 }}>{c.title}</Link></td>
                <td><span className="pill" style={{ color: STATUS[c.status]?.color }}>{STATUS[c.status]?.label ?? c.status}</span></td>
                <td>{counts[c.id] || 0}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={3} style={{ color: 'var(--muted)', padding: 16 }}>No controls yet — add your first one below.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ padding: 18, maxWidth: 520 }}>
        <h2 style={{ marginTop: 0 }}>Add a control</h2>
        <form action={bind}>
          <div className="field"><label>Title</label>
            <input name="title" placeholder="e.g. MFA enforced on all accounts" required /></div>
          <div className="field"><label>Description (optional)</label>
            <input name="description" placeholder="What this control does" /></div>
          <button className="btn btn-primary" type="submit" style={{ marginTop: 16 }}>Add control</button>
        </form>
      </div>
    </div>
  );
}
