import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { authorizeAudit, addFinding, mapFinding, unmapFinding, setFindingStatus, suggestCriteria, createTaskFromFinding, importFindings } from '../actions';

export const dynamic = 'force-dynamic';

type Req = { id: string; ref: string; title: string };
type Finding = { id: string; title: string; description: string | null; severity: string; cwe: string | null; status: string };

const SEV: Record<string, string> = { critical: 'var(--bad)', high: '#d9660b', medium: 'var(--warn)', low: 'var(--muted)', info: 'var(--faint)' };
const FSTATUS = [
  { k: 'open', l: 'Open' }, { k: 'remediated', l: 'Remediated' },
  { k: 'accepted', l: 'Accepted' }, { k: 'false_positive', l: 'False positive' },
];
const selStyle = { padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, background: '#fff', fontSize: 13, flex: 1 };

export default async function AuditDetail({ params }: { params: Promise<{ orgId: string; auditId: string }> }) {
  const { orgId, auditId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: audit } = await supabase
    .from('audits').select('id, name, target, authorized, status, org_id').eq('id', auditId).single();
  if (!audit || audit.org_id !== orgId) notFound();

  const { data: ofw } = await supabase.from('org_frameworks').select('framework_id').eq('org_id', orgId);
  const fwIds = (ofw ?? []).map((r: { framework_id: string }) => r.framework_id);
  let allReqs: Req[] = [];
  if (fwIds.length) {
    const { data } = await supabase.from('requirements').select('id, ref, title').in('framework_id', fwIds).order('sort', { ascending: true });
    allReqs = (data ?? []) as Req[];
  }

  const { data: findings } = await supabase
    .from('findings').select('id, title, description, severity, cwe, status').eq('audit_id', auditId).order('created_at', { ascending: true });
  const fRows = (findings ?? []) as Finding[];

  type MappedReq = Req & { rationale: string | null };
  const fIds = fRows.map((f) => f.id);
  const mapByFinding: Record<string, MappedReq[]> = {};
  if (fIds.length) {
    const { data: frs } = await supabase.from('finding_requirements').select('finding_id, requirement_id, rationale').in('finding_id', fIds);
    const reqById = new Map(allReqs.map((r) => [r.id, r] as const));
    (frs ?? []).forEach((fr: { finding_id: string; requirement_id: string; rationale: string | null }) => {
      const r = reqById.get(fr.requirement_id);
      if (r) (mapByFinding[fr.finding_id] ||= []).push({ ...r, rationale: fr.rationale });
    });
  }

  return (
    <div className="page-pad">
      <div className="page-head">
        <div><h1>{audit.name}</h1><div className="sub">Target: {audit.target || '—'}</div></div>
        <div className="right"><Link className="btn btn-sm" href={`/app/${orgId}/audits`}>← Audits</Link></div>
      </div>

      {!audit.authorized ? (
        <div className="card" style={{ padding: 20, borderLeft: '3px solid var(--warn)' }}>
          <h2 style={{ marginTop: 0 }}>Authorization required</h2>
          <p className="sub">
            You may only test a target you are authorized to test. Confirm you have <b>written authorization</b>
            {' '}(Rules of Engagement) for <b>{audit.target || 'this target'}</b> before logging any findings.
          </p>
          <form action={authorizeAudit.bind(null, orgId, auditId)}>
            <button className="btn btn-primary" type="submit">I confirm written authorization — start audit</button>
          </form>
        </div>
      ) : (
        <>
          <div className="card" style={{ padding: 18, marginBottom: 18, maxWidth: 640 }}>
            <h2 style={{ marginTop: 0 }}>Add a finding</h2>
            <form action={addFinding.bind(null, orgId, auditId)}>
              <div className="field"><label>Title</label><input name="title" placeholder="e.g. MFA not enforced on admin console" required /></div>
              <div className="field"><label>Description</label><input name="description" placeholder="What you found" /></div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="field" style={{ flex: 1 }}><label>Severity</label>
                  <select name="severity" defaultValue="medium">
                    <option value="critical">critical</option><option value="high">high</option>
                    <option value="medium">medium</option><option value="low">low</option><option value="info">info</option>
                  </select></div>
                <div className="field" style={{ flex: 1 }}><label>CWE (optional)</label><input name="cwe" placeholder="e.g. CWE-308" /></div>
              </div>
              <button className="btn btn-primary" type="submit" style={{ marginTop: 14 }}>Add finding</button>
            </form>
          </div>

          <details className="card" style={{ padding: 18, marginBottom: 18, maxWidth: 640 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Import findings from CSV (e.g. an AutoScan export)</summary>
            <p className="sub" style={{ marginTop: 10 }}>One finding per line: <b>title, severity, cwe, description</b></p>
            <form action={importFindings.bind(null, orgId, auditId)}>
              <textarea name="csv" rows={5}
                placeholder={'MFA not enforced, high, CWE-308, Admin console lacks MFA\nTLS 1.0 permitted, medium, , Weak transport security'}
                style={{ width: '100%', padding: 10, border: '1px solid var(--line)', borderRadius: 9, fontFamily: 'monospace', fontSize: 13 }} />
              <button className="btn btn-primary" type="submit" style={{ marginTop: 10 }}>Import findings</button>
            </form>
          </details>

          <h2>Findings ({fRows.length})</h2>
          {fRows.length === 0 && <div className="card" style={{ padding: 18, color: 'var(--muted)' }}>No findings yet.</div>}

          {fRows.map((f) => {
            const mapped = mapByFinding[f.id] || [];
            const mappedIds = new Set(mapped.map((r) => r.id));
            const unmapped = allReqs.filter((r) => !mappedIds.has(r.id));
            return (
              <div key={f.id} className="card" style={{ padding: 18, marginBottom: 14 }}>
                <div>
                  <span className="pill" style={{ color: SEV[f.severity], marginRight: 8, textTransform: 'uppercase', fontWeight: 700 }}>{f.severity}</span>
                  <b>{f.title}</b>{f.cwe && <span className="sub" style={{ marginLeft: 8 }}>{f.cwe}</span>}
                  {f.description && <div className="sub" style={{ margin: '4px 0 0' }}>{f.description}</div>}
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
                  {FSTATUS.map((s) => (
                    <form key={s.k} action={setFindingStatus.bind(null, orgId, auditId, f.id, s.k)}>
                      <button type="submit" className={f.status === s.k ? 'btn btn-primary btn-sm' : 'btn btn-sm'}>{s.l}</button>
                    </form>
                  ))}
                  <form action={createTaskFromFinding.bind(null, orgId, auditId, f.id)}>
                    <button type="submit" className="btn btn-sm">+ Task</button>
                  </form>
                </div>

                <div style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div className="sub" style={{ fontWeight: 700, margin: 0 }}>Impacts these criteria:</div>
                    <form action={suggestCriteria.bind(null, orgId, auditId, f.id)}>
                      <button type="submit" className="btn btn-sm" title="Let Gemini map this finding to compliance criteria">✨ Suggest with AI</button>
                    </form>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {mapped.map((r) => (
                      <div key={r.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <span className="pill" style={{ marginTop: 2 }}>{r.ref}</span>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 13 }}>{r.title}</span>
                          {r.rationale && <div className="sub" style={{ margin: 0, fontSize: 12 }}>{r.rationale}</div>}
                        </div>
                        <form action={unmapFinding.bind(null, orgId, auditId, f.id, r.id)}>
                          <button type="submit" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--bad)', fontWeight: 700, padding: 0, fontSize: 16 }}>×</button>
                        </form>
                      </div>
                    ))}
                    {mapped.length === 0 && <span className="sub">none yet — try “✨ Suggest with AI”, or map manually below</span>}
                  </div>
                  {unmapped.length > 0 && (
                    <form action={mapFinding.bind(null, orgId, auditId, f.id)} style={{ display: 'flex', gap: 8, marginTop: 10, maxWidth: 520 }}>
                      <select name="requirement_id" defaultValue="" style={selStyle} required>
                        <option value="" disabled>Map to a criterion manually…</option>
                        {unmapped.map((r) => <option key={r.id} value={r.id}>{r.ref} — {r.title}</option>)}
                      </select>
                      <button className="btn btn-primary btn-sm" type="submit">Map</button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
