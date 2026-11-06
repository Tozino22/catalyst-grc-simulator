'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'learner' | 'instructor'>('learner');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setOk(''); setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/');
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name } },
        });
        if (error) throw error;
        // set the chosen role on the freshly-created profile (trigger created it)
        if (data.user) {
          await supabase.from('profiles').update({ full_name: name, role }).eq('id', data.user.id);
        }
        if (data.session) { router.push('/'); router.refresh(); }
        else setOk('Account created. Check your email to confirm, then sign in.');
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <div className="brand"><div className="mk">G</div>
          <div><h1>Catalyst GRC Simulator</h1><div className="sub">Practice GRC in a simulated enterprise</div></div>
        </div>

        {mode === 'signup' && (
          <div className="field"><label>Full name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Jane Doe" />
          </div>
        )}
        <div className="field"><label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@company.com" />
        </div>
        <div className="field"><label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" />
        </div>
        {mode === 'signup' && (
          <div className="field"><label>I am a…</label>
            <select value={role} onChange={(e) => setRole(e.target.value as 'learner' | 'instructor')}>
              <option value="learner">Learner</option>
              <option value="instructor">Instructor</option>
            </select>
          </div>
        )}

        {err && <div className="auth-err">{err}</div>}
        {ok && <div className="auth-ok">{ok}</div>}

        <button className="auth-btn" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>

        <div className="auth-alt">
          {mode === 'signin'
            ? <>New here? <button type="button" onClick={() => { setMode('signup'); setErr(''); }}>Create an account</button></>
            : <>Have an account? <button type="button" onClick={() => { setMode('signin'); setErr(''); }}>Sign in</button></>}
        </div>
      </form>
    </div>
  );
}
