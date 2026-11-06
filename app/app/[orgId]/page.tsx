import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { roleLabel } from '@/lib/platform';

export const dynamic = 'force-dynamic';

export default async function OrgHome({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: org } = await supabase.from('orgs').select('id, name').eq('id', orgId).single();
  if (!org) notFound();

  const { data: me } = await supabase
    .from('memberships').select('role').eq('org_id', orgId).eq('user_id', user.id).single();
  const myRole = me?.role ?? 'client_viewer';

  // ---- Readiness computation ----
  const { data: ofw } = await supabase.from('org_frameworks').select('framework_id').eq('org_id', orgId);
  const fwIds = (ofw ?? []).map((r: { framework_id: string }) => r.framework_id);

  let reqIds: string[] = [];
  if (fwIds.length) {
    const { data } = await supabase.from('requirements').select('id').in('framework_id', fwIds);
    reqIds = (data ?? []).map((r: { id: string }) => r.id);
  }
  const totalReq = reqIds.length;

  const { data: controls } = await supabase.from('controls').select('id, status').eq('org_id', orgId);
  const ctrls = (controls ?? []) as Array<{ id: string; status: string }>;
  const implIds = ctrls.filter((c) => c.status === 'implemented').map((c) => c.id);

  const reqSet = new Set(reqIds);
  const coveredSet = new Set<string>();
  if (implIds.length && totalReq) {
    const { data: crs } = await supabase.from('control_requirements').select('requirement_id').in('control_id', implIds);
    (crs ?? []).forEach((cr: { requirement_id: string }) => { if (reqSet.has(cr.requirement_id)) coveredSet.add(cr.requirement_id); });
  }
  // Open findings put a criterion "at risk" — it stops counting as covered.
  const atRiskSet = new Set<string>();
  const { data: openF } = await supabase.from('findings').select('id').eq('org_id', orgId).eq('status', 'open');
  const openIds = (openF ?? []).map((f: { id: string }) => f.id);
  if (openIds.length) {
    const { data: fr } = await supabase.from('finding_requirements').select('requirement_id').in('finding_id', openIds);
    (fr ?? []).forEach((x: { requirement_id: string }) => { if (reqSet.has(x.requirement_id)) atRiskSet.add(x.requirement_id); });
  }
  let covered = 0;
  coveredSet.forEach((id) => { if (!atRiskSet.has(id)) covered++; });
  const atRisk = atRiskSet.size;
  const readiness = totalReq ? Math.round((covered / totalReq) * 100) : 0;

  const byStatus: Record<string, number> = { not_started: 0, in_progress: 0, implemented: 0, not_applicable: 0 };
  ctrls.forEach((c) => { byStatus[c.status] = (byStatus[c.status] || 0) + 1; });

  // ---- Members ----
  const { data: members } = await supabase
    .from('memberships').select('role, user:profiles(full_name)').eq('org_id', orgId).order('created_at', { ascending: true });
  const memberRows = (members ?? []) as unknown as Array<{ role: string; user: { full_name: string | null } | null }>;

  const barColor = readiness >= 80 ? 'var(--good)' : readiness >= 40 ? 'var(--warn)' : 'var(--bad)';

  return (
    <div className="page-pad">
      <div className="page-head">
        <div><h1>{org.name}</h1><div className="sub">Compliance workspace · your role: {roleLabel(myRole)}</div></div>
        <div className="right"><Link className="btn btn-sm" href="/app">← All workspaces</Link></div>
      </div>

      {/* Readiness */}
      <div className="card" style={{ padding: 20, marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="sub" style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '.08em', fontSize: 11, fontWeight: 700 }}>Compliance readiness</div>
            <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1.05, color: barColor }}>{readiness}%</div>
            <div className="sub" style={{ margin: 0 }}>
              {covered} of {totalReq} criteria covered by an implemented control
              {atRisk > 0 && <> · <span style={{ color: 'var(--bad)', fontWeight: 700 }}>{atRisk} at risk</span> from open findings</>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link className="btn btn-primary btn-sm" href={`/app/${orgId}/controls`}>Controls</Link>
            <Link className="btn btn-sm" href={`/app/${orgId}/audits`}>App audits</Link>
            <Link className="btn btn-sm" href={`/app/${orgId}/tasks`}>Tasks</Link>
            <Link className="btn btn-sm" href={`/app/${orgId}/report`}>Report</Link>
            <Link className="btn btn-sm" href={`/app/${orgId}/frameworks`}>Criteria</Link>
          </div>
        </div>
        <div style={{ height: 12, borderRadius: 6, background: 'var(--surface-2, #eef)', overflow: 'hidden', marginTop: 14, border: '1px solid var(--line)' }}>
          <div style={{ width: `${readiness}%`, height: '100%', background: barColor, transition: 'width .3s' }} />
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap', fontSize: 13 }}>
          <span><b style={{ color: 'var(--good)' }}>{byStatus.implemented}</b> implemented</span>
          <span><b style={{ color: 'var(--warn)' }}>{byStatus.in_progress}</b> in progress</span>
          <span><b style={{ color: 'var(--faint)' }}>{byStatus.not_started}</b> not started</span>
          <span><b style={{ color: 'var(--faint)' }}>{byStatus.not_applicable}</b> N/A</span>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card" style={{ padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>Get to a higher score</h2>
          <ol className="sub" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
            <li>Add a <b>control</b> (a safeguard you have in place)</li>
            <li><b>Map</b> it to the criteria it satisfies</li>
            <li>Mark it <b>Implemented</b> and attach <b>evidence</b></li>
            <li>Watch readiness climb ↑</li>
          </ol>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>Members</h2>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {memberRows.map((m, i) => (
              <li key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderTop: i === 0 ? 'none' : '1px solid var(--line)' }}>
                <span>{m.user?.full_name ?? '—'}</span>
                <span className="pill">{roleLabel(m.role)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
