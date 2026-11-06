import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { roleLabel } from '@/lib/platform';
import { createOrg } from './actions';

export const dynamic = 'force-dynamic';

export default async function AppHome() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: memberships } = await supabase
    .from('memberships')
    .select('role, org:orgs(id, name)')
    .order('created_at', { ascending: true });

  const rows = (memberships ?? []) as unknown as Array<{
    role: string; org: { id: string; name: string } | null;
  }>;

  return (
    <div className="page-pad">
      <div className="page-head">
        <div>
          <h1>Client Workspaces</h1>
          <div className="sub">Pick an organization to manage its compliance — or create a new one</div>
        </div>
        <div className="right"><Link className="btn btn-sm" href="/">Home</Link></div>
      </div>

      <div className="grid cols-3">
        {rows.map((r) => r.org && (
          <Link key={r.org.id} className="card" href={`/app/${r.org.id}`}
            style={{ padding: 18, display: 'block', textDecoration: 'none' }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{r.org.name}</div>
            <span className="pill">{roleLabel(r.role)}</span>
          </Link>
        ))}
        {rows.length === 0 && (
          <div className="card" style={{ padding: 18, color: 'var(--muted)' }}>
            No workspaces yet — create your first one below.
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 18, marginTop: 22, maxWidth: 460 }}>
        <h2 style={{ marginTop: 0 }}>Create a client workspace</h2>
        <form action={createOrg}>
          <div className="field">
            <label>Organization name</label>
            <input name="name" placeholder="e.g. Acme Health Inc." required />
          </div>
          <button className="btn btn-primary" type="submit" style={{ marginTop: 16 }}>
            Create workspace
          </button>
        </form>
      </div>
    </div>
  );
}
