import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAudit } from './actions';

export const dynamic = 'force-dynamic';

export default async function AuditsPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: org } = await supabase.from('orgs').select('id, name').eq('id', orgId).single();
  if (!org) notFound();

  const { data: audits } = await supabase
    .from('audits').select('id, name, target, authorized, status').eq('org_id', orgId).order('created_at', { ascending: false });
  const rows = (audits ?? []) as Array<{ id: string; name: string; target: string | null; authorized: boolean; status: string }>;

  const ids = rows.map((r) => r.id);
  const fCount: Record<string, number> = {};
  if (ids.length) {
    const { data: fs } = await supabase.from('findings').select('audit_id').in('audit_id', ids);
    (fs ?? []).forEach((f: { audit_id: string }) => { fCount[f.audit_id] = (fCount[f.audit_id] || 0) + 1; });
  }

  const bind = createAudit.bind(null, orgId);

  return (
    <div className="page-pad">
      <div className="page-head">
        <div>
          <h1>App Audits — {org.name}</h1>
          <div className="sub">Technically audit an app, then map findings to SOC 2 criteria</div>
        </div>
        <div className="right"><Link className="btn btn-sm" href={`/app/${orgId}`}>← Workspace</Link></div>
      </div>

      <div className="card" style={{ padding: 6, marginBottom: 20 }}>
        <table>
          <thead><tr><th>Audit</th><th>Target</th><th>Status</th><th>Findings</th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td><Link href={`/app/${orgId}/audits/${a.id}`} style={{ fontWeight: 600 }}>{a.name}</Link></td>
                <td style={{ color: 'var(--muted)' }}>{a.target || '—'}</td>
                <td>{a.authorized
                  ? <span className="pill" style={{ color: 'var(--good)' }}>Authorized</span>
                  : <span className="pill" style={{ color: 'var(--warn)' }}>Needs authorization</span>}</td>
                <td>{fCount[a.id] || 0}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} style={{ color: 'var(--muted)', padding: 16 }}>No audits yet — create one below.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ padding: 18, maxWidth: 520 }}>
        <h2 style={{ marginTop: 0 }}>New audit</h2>
        <form action={bind}>
          <div className="field"><label>Audit name</label>
            <input name="name" placeholder="e.g. Q3 web app security review" required /></div>
          <div className="field"><label>Target (app name / URL)</label>
            <input name="target" placeholder="e.g. app.acmehealth.com" /></div>
          <button className="btn btn-primary" type="submit" style={{ marginTop: 16 }}>Create audit</button>
        </form>
        <p className="sub" style={{ marginTop: 12, marginBottom: 0 }}>
          You must confirm written authorization to test the target before logging findings.
        </p>
      </div>
    </div>
  );
}
