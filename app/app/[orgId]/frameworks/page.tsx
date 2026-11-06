import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { enableFramework, disableFramework } from './actions';

export const dynamic = 'force-dynamic';

type Req = { id: string; ref: string; title: string; description: string | null; category: string | null; sort: number; framework_id: string };
type Fw = { id: string; name: string; version: string | null; key: string };

export default async function FrameworksPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: org } = await supabase.from('orgs').select('id, name').eq('id', orgId).single();
  if (!org) notFound();

  const { data: allFw } = await supabase.from('frameworks').select('id, name, version, key').order('name', { ascending: true });
  const library = (allFw ?? []) as Fw[];

  const { data: ofw } = await supabase.from('org_frameworks').select('framework_id').eq('org_id', orgId);
  const enabledIds = new Set((ofw ?? []).map((r: { framework_id: string }) => r.framework_id));
  const enabledFw = library.filter((f) => enabledIds.has(f.id));

  const fwIds = enabledFw.map((f) => f.id);
  let requirements: Req[] = [];
  if (fwIds.length) {
    const { data } = await supabase
      .from('requirements').select('id, ref, title, description, category, sort, framework_id')
      .in('framework_id', fwIds).order('sort', { ascending: true });
    requirements = (data ?? []) as Req[];
  }

  return (
    <div className="page-pad">
      <div className="page-head">
        <div><h1>Frameworks — {org.name}</h1><div className="sub">Enable the standards this client pursues — controls cross-map across all of them</div></div>
        <div className="right"><Link className="btn btn-sm" href={`/app/${orgId}`}>← Workspace</Link></div>
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 22 }}>
        <h2 style={{ marginTop: 0 }}>Available frameworks</h2>
        {library.map((fw) => {
          const on = enabledIds.has(fw.id);
          return (
            <div key={fw.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '11px 0', borderTop: '1px solid var(--line)' }}>
              <div><b>{fw.name}</b> {fw.version && <span className="sub">· {fw.version}</span>}{on && <span className="pill" style={{ color: 'var(--good)', marginLeft: 8 }}>Enabled</span>}</div>
              {on ? (
                <form action={disableFramework.bind(null, orgId, fw.id)}><button className="btn btn-sm" type="submit">Disable</button></form>
              ) : (
                <form action={enableFramework.bind(null, orgId, fw.key)}><button className="btn btn-primary btn-sm" type="submit">Enable</button></form>
              )}
            </div>
          );
        })}
        {library.length === 0 && <div className="sub">No frameworks in the library yet.</div>}
      </div>

      {enabledFw.map((fw) => {
        const items = requirements.filter((r) => r.framework_id === fw.id);
        const groups: Record<string, Req[]> = {};
        items.forEach((r) => { const k = r.category ?? 'Other'; (groups[k] ||= []).push(r); });
        return (
          <div key={fw.id} className="card" style={{ padding: 18, marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <h2 style={{ margin: 0 }}>{fw.name} <span className="sub">{fw.version}</span></h2>
              <span className="pill">{items.length} criteria</span>
            </div>
            {Object.entries(groups).map(([cat, rows]) => (
              <div key={cat} style={{ marginTop: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--muted)', margin: '6px 0' }}>{cat}</div>
                {rows.map((r) => (
                  <div key={r.id} style={{ display: 'flex', gap: 12, padding: '9px 0', borderTop: '1px solid var(--line)' }}>
                    <span className="pill" style={{ minWidth: 58, textAlign: 'center', height: 'fit-content' }}>{r.ref}</span>
                    <div>
                      <div style={{ fontWeight: 600 }}>{r.title}</div>
                      <div className="sub" style={{ margin: 0 }}>{r.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
