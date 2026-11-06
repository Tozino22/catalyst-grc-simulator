import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PrintButton } from '@/components/PrintButton';

export const dynamic = 'force-dynamic';

type Req = { id: string; ref: string; title: string; category: string | null };

export default async function ReportPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: org } = await supabase.from('orgs').select('id, name').eq('id', orgId).single();
  if (!org) notFound();

  const { data: ofw } = await supabase.from('org_frameworks').select('framework_id').eq('org_id', orgId);
  const fwIds = (ofw ?? []).map((r: { framework_id: string }) => r.framework_id);
  let reqs: Req[] = [];
  if (fwIds.length) {
    const { data } = await supabase.from('requirements').select('id, ref, title, category').in('framework_id', fwIds).order('sort', { ascending: true });
    reqs = (data ?? []) as Req[];
  }
  const reqSet = new Set(reqs.map((r) => r.id));

  const { data: controls } = await supabase.from('controls').select('id, title, status').eq('org_id', orgId);
  const ctrls = (controls ?? []) as Array<{ id: string; title: string; status: string }>;
  const implIds = ctrls.filter((c) => c.status === 'implemented').map((c) => c.id);
  const coveredSet = new Set<string>();
  if (implIds.length) {
    const { data: crs } = await supabase.from('control_requirements').select('requirement_id').in('control_id', implIds);
    (crs ?? []).forEach((x: { requirement_id: string }) => { if (reqSet.has(x.requirement_id)) coveredSet.add(x.requirement_id); });
  }

  const { data: openF } = await supabase.from('findings').select('id, title, severity').eq('org_id', orgId).eq('status', 'open');
  const openFindings = (openF ?? []) as Array<{ id: string; title: string; severity: string }>;
  const openIds = openFindings.map((f) => f.id);
  const atRiskSet = new Set<string>();
  if (openIds.length) {
    const { data: fr } = await supabase.from('finding_requirements').select('requirement_id').in('finding_id', openIds);
    (fr ?? []).forEach((x: { requirement_id: string }) => { if (reqSet.has(x.requirement_id)) atRiskSet.add(x.requirement_id); });
  }

  let covered = 0;
  coveredSet.forEach((id) => { if (!atRiskSet.has(id)) covered++; });
  const total = reqs.length;
  const readiness = total ? Math.round((covered / total) * 100) : 0;

  const { data: tasks } = await supabase.from('tasks').select('title, owner_name, due_date, status').eq('org_id', orgId).neq('status', 'done').order('created_at', { ascending: true });
  const openTasks = (tasks ?? []) as Array<{ title: string; owner_name: string | null; due_date: string | null; status: string }>;

  const statusOf = (id: string) => (atRiskSet.has(id) ? 'At risk' : coveredSet.has(id) ? 'Covered' : 'Gap');
  const statusColor = (s: string) => (s === 'Covered' ? 'var(--good)' : s === 'At risk' ? 'var(--bad)' : 'var(--muted)');
  const today = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="page-pad">
      <div className="page-head no-print">
        <div><h1>Report — {org.name}</h1><div className="sub">Compliance readiness &amp; gap report</div></div>
        <div className="right" style={{ display: 'flex', gap: 8 }}>
          <PrintButton />
          <Link className="btn btn-sm" href={`/app/${orgId}`}>← Workspace</Link>
        </div>
      </div>

      <div className="card" style={{ padding: 26 }}>
        <div style={{ borderBottom: '2px solid var(--line)', paddingBottom: 14, marginBottom: 18 }}>
          <h1 style={{ margin: 0 }}>{org.name}</h1>
          <div className="sub">SOC 2 Readiness &amp; Gap Report · {today}</div>
        </div>

        <div style={{ display: 'flex', gap: 30, flexWrap: 'wrap', marginBottom: 20 }}>
          <div><div className="sub">Readiness</div><div style={{ fontSize: 40, fontWeight: 800, color: readiness >= 80 ? 'var(--good)' : readiness >= 40 ? 'var(--warn)' : 'var(--bad)' }}>{readiness}%</div></div>
          <div><div className="sub">Covered</div><div style={{ fontSize: 24, fontWeight: 700 }}>{covered}/{total}</div></div>
          <div><div className="sub">At risk</div><div style={{ fontSize: 24, fontWeight: 700, color: 'var(--bad)' }}>{atRiskSet.size}</div></div>
          <div><div className="sub">Open findings</div><div style={{ fontSize: 24, fontWeight: 700 }}>{openFindings.length}</div></div>
          <div><div className="sub">Open tasks</div><div style={{ fontSize: 24, fontWeight: 700 }}>{openTasks.length}</div></div>
        </div>

        <h2>Criteria status</h2>
        <table>
          <thead><tr><th>Ref</th><th>Criterion</th><th>Status</th></tr></thead>
          <tbody>
            {reqs.map((r) => { const s = statusOf(r.id); return (
              <tr key={r.id}><td>{r.ref}</td><td>{r.title}</td><td style={{ color: statusColor(s), fontWeight: 700 }}>{s}</td></tr>
            ); })}
          </tbody>
        </table>

        <h2 style={{ marginTop: 24 }}>Controls ({ctrls.length})</h2>
        <table>
          <thead><tr><th>Control</th><th>Status</th></tr></thead>
          <tbody>
            {ctrls.map((c) => <tr key={c.id}><td>{c.title}</td><td>{c.status.replace('_', ' ')}</td></tr>)}
            {ctrls.length === 0 && <tr><td colSpan={2} className="sub">No controls yet.</td></tr>}
          </tbody>
        </table>

        <h2 style={{ marginTop: 24 }}>Open findings ({openFindings.length})</h2>
        <table>
          <thead><tr><th>Severity</th><th>Finding</th></tr></thead>
          <tbody>
            {openFindings.map((f) => <tr key={f.id}><td style={{ textTransform: 'uppercase', fontWeight: 700 }}>{f.severity}</td><td>{f.title}</td></tr>)}
            {openFindings.length === 0 && <tr><td colSpan={2} className="sub">None.</td></tr>}
          </tbody>
        </table>

        <h2 style={{ marginTop: 24 }}>Open remediation tasks ({openTasks.length})</h2>
        <table>
          <thead><tr><th>Task</th><th>Owner</th><th>Due</th><th>Status</th></tr></thead>
          <tbody>
            {openTasks.map((t, i) => <tr key={i}><td>{t.title}</td><td>{t.owner_name || '—'}</td><td>{t.due_date || '—'}</td><td>{t.status.replace('_', ' ')}</td></tr>)}
            {openTasks.length === 0 && <tr><td colSpan={4} className="sub">None.</td></tr>}
          </tbody>
        </table>

        <p className="sub" style={{ marginTop: 24, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          Generated by Catalyst GRC · Reflects self-attested control status; not an independent audit opinion.
        </p>
      </div>
    </div>
  );
}
