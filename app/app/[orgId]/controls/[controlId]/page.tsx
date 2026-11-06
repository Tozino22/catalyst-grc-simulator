import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { setStatus, mapRequirement, unmapRequirement, addEvidence } from '../actions';

export const dynamic = 'force-dynamic';

const STATUS_OPTS = [
  { key: 'not_started', label: 'Not started' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'implemented', label: 'Implemented' },
  { key: 'not_applicable', label: 'N/A' },
];

type Req = { id: string; ref: string; title: string; category: string | null };
type Ev = { id: string; type: string; ref: string | null; description: string | null; collected_at: string };
const selStyle = { padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 9, background: '#fff', fontSize: 14, flex: 1 };

export default async function ControlDetail({ params }: { params: Promise<{ orgId: string; controlId: string }> }) {
  const { orgId, controlId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: control } = await supabase
    .from('controls').select('id, title, description, status, org_id').eq('id', controlId).single();
  if (!control || control.org_id !== orgId) notFound();

  const { data: ofw } = await supabase.from('org_frameworks').select('framework_id').eq('org_id', orgId);
  const fwIds = (ofw ?? []).map((r: { framework_id: string }) => r.framework_id);
  let allReqs: Req[] = [];
  if (fwIds.length) {
    const { data } = await supabase.from('requirements')
      .select('id, ref, title, category').in('framework_id', fwIds).order('sort', { ascending: true });
    allReqs = (data ?? []) as Req[];
  }

  const { data: mapped } = await supabase.from('control_requirements').select('requirement_id').eq('control_id', controlId);
  const mappedIds = new Set((mapped ?? []).map((m: { requirement_id: string }) => m.requirement_id));
  const mappedReqs = allReqs.filter((r) => mappedIds.has(r.id));
  const unmappedReqs = allReqs.filter((r) => !mappedIds.has(r.id));

  const { data: evidence } = await supabase.from('evidence')
    .select('id, type, ref, description, collected_at').eq('control_id', controlId).order('collected_at', { ascending: false });
  const evRows = (evidence ?? []) as Ev[];

  return (
    <div className="page-pad">
      <div className="page-head">
        <div><h1>{control.title}</h1><div className="sub">{control.description || 'Control'}</div></div>
        <div className="right"><Link className="btn btn-sm" href={`/app/${orgId}/controls`}>← Controls</Link></div>
      </div>

      <div className="grid cols-2">
        <div className="card" style={{ padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>Status</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {STATUS_OPTS.map((s) => (
              <form key={s.key} action={setStatus.bind(null, orgId, controlId, s.key)}>
                <button type="submit" className={control.status === s.key ? 'btn btn-primary btn-sm' : 'btn btn-sm'}>{s.label}</button>
              </form>
            ))}
          </div>
          <p className="sub" style={{ marginTop: 12, marginBottom: 0 }}>
            Mark a control <b>Implemented</b> to cover its mapped criteria and raise readiness.
          </p>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>Mapped criteria</h2>
          {mappedReqs.length === 0 && <p className="sub">Not mapped to any criteria yet.</p>}
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {mappedReqs.map((r) => (
              <li key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '7px 0', borderTop: '1px solid var(--line)' }}>
                <span><span className="pill" style={{ marginRight: 8 }}>{r.ref}</span>{r.title}</span>
                <form action={unmapRequirement.bind(null, orgId, controlId, r.id)}>
                  <button className="btn btn-sm" type="submit">Unmap</button>
                </form>
              </li>
            ))}
          </ul>
          {unmappedReqs.length > 0 && (
            <form action={mapRequirement.bind(null, orgId, controlId)} style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <select name="requirement_id" defaultValue="" style={selStyle} required>
                <option value="" disabled>Add a criterion…</option>
                {unmappedReqs.map((r) => <option key={r.id} value={r.id}>{r.ref} — {r.title}</option>)}
              </select>
              <button className="btn btn-primary btn-sm" type="submit">Map</button>
            </form>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 18, marginTop: 18 }}>
        <h2 style={{ marginTop: 0 }}>Evidence</h2>
        {evRows.length === 0 && <p className="sub">No evidence attached yet.</p>}
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {evRows.map((e) => (
            <li key={e.id} style={{ padding: '9px 0', borderTop: '1px solid var(--line)' }}>
              <b>{e.type === 'link' ? '🔗 ' : '📝 '}</b>
              {e.ref && e.type === 'link'
                ? <a href={e.ref} target="_blank" rel="noopener noreferrer">{e.ref}</a>
                : <span>{e.ref}</span>}
              {e.description && <div className="sub" style={{ margin: 0 }}>{e.description}</div>}
            </li>
          ))}
        </ul>
        <form action={addEvidence.bind(null, orgId, controlId)} style={{ marginTop: 12, maxWidth: 520 }}>
          <div className="field"><label>Type</label>
            <select name="type"><option value="link">Link</option><option value="note">Note</option></select></div>
          <div className="field"><label>Link or reference</label>
            <input name="ref" placeholder="https://…  or a document name" /></div>
          <div className="field"><label>Description (optional)</label>
            <input name="description" placeholder="What this evidence proves" /></div>
          <button className="btn btn-primary" type="submit" style={{ marginTop: 14 }}>Add evidence</button>
        </form>
      </div>
    </div>
  );
}
