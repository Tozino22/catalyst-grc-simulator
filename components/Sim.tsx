'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  type SimState, type ScenarioConfig, sev, sevLabel, riskScore,
  compliancePct, readiness, initState,
} from '@/lib/sim';

type View = 'dashboard' | 'inbox' | 'risks' | 'assess' | 'ai' | 'compliance';

const TITLES: Record<View, [string, string]> = {
  dashboard: ['Enterprise Overview', 'Your simulated organization at a glance'],
  inbox: ['Work Inbox', 'Action tasks like a real GRC team'],
  risks: ['Risk Register', 'Assess and treat enterprise risk'],
  assess: ['Assessments', 'Review controls to refresh compliance'],
  ai: ['AI Governance', 'Assess and govern the company’s AI'],
  compliance: ['Compliance', 'Posture across your frameworks'],
};

const ICONS: Record<string, [string, string]> = {
  triangle: ['M12 2 2 21h20L12 2z M12 9v5 M12 17h.01', 'high'],
  file: ['M4 4h16v16H4z M4 7l8 6 8-6', 'med'],
  building: ['M3 21h18 M5 21V7l7-4 7 4v14 M9 21v-6h6v6', 'low'],
  shield: ['M12 3 4 6v6c0 5 3.4 7.7 8 9 4.6-1.3 8-4 8-9V6l-8-3Z', 'med'],
  alert: ['M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z M12 9v4 M12 17h.01', 'high'],
  check: ['M9 11l3 3 8-8 M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9', 'low'],
};
const feedIcon = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 8v4l3 2" /><circle cx="12" cy="12" r="9" /></svg>;

export default function Sim({
  sessionId, scenarioTitle, initial,
}: { sessionId: string; scenarioTitle: string; initial: SimState & { _config: ScenarioConfig } }) {
  const supabase = createClient();
  const [view, setView] = useState<View>('dashboard');
  const config = initial._config;
  const [S, setS] = useState<SimState>(() => {
    const { _config, ...rest } = initial as SimState & { _config: ScenarioConfig };
    void _config;
    return rest;
  });
  const [toast, setToast] = useState<string>('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const persist = useCallback(async (next: SimState) => {
    await supabase.from('sim_sessions').update({
      state: next, readiness: readiness(next), compliance: compliancePct(next.controls), points: next.points,
    }).eq('id', sessionId);
  }, [supabase, sessionId]);

  const commit = useCallback((next: SimState, msg?: string, pts?: number) => {
    setS(next);
    persist(next);
    if (msg) {
      setToast(msg + (pts ? `  +${pts} pts` : ''));
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(''), 2200);
    }
  }, [persist]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  function addActivity(s: SimState, t: string): SimState {
    return { ...s, activity: [{ t, tm: 'just now' }, ...s.activity].slice(0, 8) };
  }

  // ----- actions -----
  const resolveTask = (id: string) => {
    const t = S.tasks.find((x) => x.id === id); if (!t || t.resolved) return;
    let next = { ...S, tasks: S.tasks.map((x) => x.id === id ? { ...x, resolved: true } : x), points: S.points + 15 };
    next = addActivity(next, `Completed: ${t.title}`);
    commit(next, `Completed: ${t.title}`, 15);
  };
  const decide = (id: string, choice: string) => {
    const t = S.tasks.find((x) => x.id === id); if (!t || t.resolved) return;
    let next = { ...S, tasks: S.tasks.map((x) => x.id === id ? { ...x, resolved: true } : x), points: S.points + 15 };
    next = addActivity(next, `${t.title} → ${choice}`);
    commit(next, `${t.title} → ${choice}`, 15);
  };
  const setScore = (id: string, k: 'l' | 'i', v: number) =>
    commit({ ...S, risks: S.risks.map((r) => r.id === id ? { ...r, [k]: v } : r) });
  const setTreat = (id: string, v: string) => {
    const r = S.risks.find((x) => x.id === id)!; const was = r.treat;
    let next = { ...S, risks: S.risks.map((x) => x.id === id ? { ...x, treat: v } : x) };
    if (was === 'Untreated' && v !== 'Untreated') {
      next = { ...next, tasks: next.tasks.map((t) => t.action === 'goto:risks' && !t.resolved ? { ...t, resolved: true } : t), points: next.points + 12 };
      next = addActivity(next, `Risk treated: ${r.title}`);
      commit(next, `Risk treated: ${r.title}`, 12);
    } else commit(next);
  };
  const setCtrl = (id: string, st: 'pass' | 'fail' | 'na') => {
    const c = S.controls.find((x) => x.id === id)!;
    let next = { ...S, controls: S.controls.map((x) => x.id === id ? { ...x, state: st } : x) };
    if (S.controls.every((x) => x.id === id ? true : x.state !== 'na')) {
      next = { ...next, tasks: next.tasks.map((t) => t.action === 'goto:assess' && !t.resolved ? { ...t, resolved: true } : t) };
    }
    next = addActivity(next, `Control reviewed: ${c.name} → ${st.toUpperCase()}`);
    commit(next, 'Assessment updated');
  };
  const toggleAI = (id: string) => {
    const a = S.ai.find((x) => x.id === id)!; const now = !a.ok;
    let next = { ...S, ai: S.ai.map((x) => x.id === id ? { ...x, ok: now } : x), points: S.points + (now ? 8 : 0) };
    if (now) next = addActivity(next, 'AI control confirmed');
    commit(next, now ? 'AI control confirmed' : undefined, now ? 8 : undefined);
  };
  const reset = () => commit({ ...initState(config) }, 'Simulation reset');

  // ----- derived -----
  const open = S.tasks.filter((t) => !t.resolved).length;
  const r = readiness(S);
  const comp = compliancePct(S.controls);
  const counts = { high: 0, med: 0, low: 0 };
  S.risks.forEach((rk) => counts[sev(riskScore(rk))]++);
  const total = S.risks.length || 1;
  const hp = counts.high / total * 100, mp = counts.med / total * 100;
  const compColor = comp >= 75 ? 'var(--good)' : comp >= 50 ? 'var(--med)' : 'var(--high)';

  const NavBtn = ({ v, label, icon, badge }: { v: View; label: string; icon: React.ReactNode; badge?: number }) => (
    <button className={`nav ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>{icon}{label}
      {badge ? <span className="badge">{badge}</span> : null}</button>
  );

  return (
    <div className="app">
      <aside className="side">
        <div className="logo"><div className="mk">G</div><div><b>GRC Simulator</b><small>Simulated Enterprise</small></div></div>
        <NavBtn v="dashboard" label="Dashboard" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" /></svg>} />
        <NavBtn v="inbox" label="Work Inbox" badge={open} icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 4h16v16H4z" /><path d="m4 7 8 6 8-6" /></svg>} />
        <NavBtn v="risks" label="Risk Register" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 2 2 21h20L12 2z" /><path d="M12 9v5M12 17h.01" /></svg>} />
        <NavBtn v="assess" label="Assessments" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 11l3 3 8-8" /><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" /></svg>} />
        <NavBtn v="ai" label="AI Governance" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M9 9h.01M15 9h.01M9 14c1 1 5 1 6 0" /></svg>} />
        <NavBtn v="compliance" label="Compliance" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 3 4 6v6c0 5 3.4 7.7 8 9 4.6-1.3 8-4 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></svg>} />
        <div className="foot">
          <div className="readiness">GRC Readiness<b>{r}%</b><div className="rbar"><span style={{ width: `${r}%` }} /></div></div>
          <a className="signout" href="/learn">← All labs</a>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <div><h1>{TITLES[view][0]}</h1><div className="sub">{TITLES[view][1]}</div></div>
          <div className="right">
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{scenarioTitle}</span>
            <button className="btn btn-sm" onClick={reset}>Reset</button>
            <div className="avatar">You</div>
          </div>
        </div>

        <div className="content">
          {view === 'dashboard' && (<>
            <div className="intro"><b>Welcome to your simulated enterprise.</b>
              <p>You are the GRC analyst. Work the inbox, assess risks, complete control reviews and govern the company’s AI — every action updates the live dashboard and your readiness score.</p></div>
            <div className="grid cols-3">
              <div className="card kpi"><span className="n">{open}</span><span className="l">Open tasks</span><span className="t">in your work inbox</span></div>
              <div className="card kpi"><span className="n" style={{ color: 'var(--med)' }}>{S.tasks.filter(t => !t.resolved && t.due === 'Today').length}</span><span className="l">Due today</span><span className="t">needs action</span></div>
              <div className="card kpi"><span className="n" style={{ color: 'var(--good)' }}>{S.tasks.filter(t => t.resolved).length}</span><span className="l">Completed</span><span className="t">this session</span></div>
            </div>
            <div className="grid cols-2" style={{ marginTop: 18 }}>
              <div className="card"><h3>Risk overview</h3>
                <div className="donut-wrap">
                  <div className="donut" style={{ background: `conic-gradient(var(--high) 0 ${hp}%, var(--med) ${hp}% ${hp + mp}%, var(--low) ${hp + mp}% 100%)` }}><div className="mid"><b>{S.risks.length}</b><span>Risks</span></div></div>
                  <div className="legend" style={{ flex: 1 }}>
                    <div><span className="dot" style={{ background: 'var(--high)' }} /> High <span className="c">{counts.high}</span></div>
                    <div><span className="dot" style={{ background: 'var(--med)' }} /> Medium <span className="c">{counts.med}</span></div>
                    <div><span className="dot" style={{ background: 'var(--low)' }} /> Low <span className="c">{counts.low}</span></div>
                  </div>
                </div>
              </div>
              <div className="card"><h3>Compliance status</h3>
                <div className="comp-n" style={{ color: compColor }}>{comp}%</div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>controls passing</div>
                <div className="prog"><span style={{ width: `${comp}%` }} /></div>
              </div>
            </div>
            <div className="grid cols-2" style={{ marginTop: 18 }}>
              <div className="card"><h3>Recent activity</h3><div className="feed">
                {S.activity.map((a, i) => <div className="it" key={i}><div className="ic">{feedIcon}</div><div>{a.t}</div><div className="tm">{a.tm}</div></div>)}
              </div></div>
              <div className="card chat"><h3>Team chat</h3>
                <div className="msg"><div className="av" style={{ background: '#7C3AED' }}>AM</div><div className="bubble"><div className="nm">Alex Morgan · Compliance Lead</div>Can you clear the auditor’s evidence request today? They’re waiting on the access review.</div></div>
                <div className="msg"><div className="av" style={{ background: '#0E9384' }}>RT</div><div className="bubble"><div className="nm">Riya T. · IT Security</div>Heads up — I logged that unpatched server as a new risk for you to assess.</div></div>
              </div>
            </div>
          </>)}

          {view === 'inbox' && (
            <><p style={{ color: 'var(--muted)', marginBottom: 16, fontSize: 14 }}>Action each item the way a real GRC team would. Resolving tasks updates the dashboard and your readiness.</p>
              <div className="grid" style={{ gap: 12 }}>
                {S.tasks.map((t) => {
                  const [d, col] = ICONS[t.icon];
                  const bg = { high: '#FBE6E6', med: '#FBF0DC', low: '#E1F3EC' }[col as 'high' | 'med' | 'low'];
                  const stroke = { high: 'var(--high)', med: 'var(--med)', low: 'var(--low)' }[col as 'high' | 'med' | 'low'];
                  return (
                    <div className={`task ${t.resolved ? 'resolved' : ''}`} key={t.id}>
                      <div className="tic" style={{ background: bg }}><svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2}>{d.split(' M').map((seg, i) => <path key={i} d={(i ? 'M' : '') + seg} />)}</svg></div>
                      <div className="body">
                        <div className="h"><b>{t.title}</b><span className={`pill ${col}`}>{t.type}</span>{!t.resolved && <span className="pill open">Due: {t.due}</span>}</div>
                        <p>{t.desc}</p>
                        <div className="actions">
                          {t.resolved ? <span className="pill done">✓ Resolved</span>
                            : t.action === 'decision' ? (t.options ?? []).map((o, i) => <button key={o} className={`btn btn-sm ${i === 0 ? 'btn-primary' : ''}`} onClick={() => decide(t.id, o)}>{o}</button>)
                              : t.action?.startsWith('goto:') ? <button className="btn btn-sm btn-primary" onClick={() => setView(t.action.split(':')[1] as View)}>Open {t.action.split(':')[1] === 'risks' ? 'Risk Register' : 'Assessments'} →</button>
                                : <button className="btn btn-sm btn-primary" onClick={() => resolveTask(t.id)}>Mark complete</button>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div></>
          )}

          {view === 'risks' && (
            <><p style={{ color: 'var(--muted)', marginBottom: 16, fontSize: 14 }}>Score each risk by Likelihood × Impact, then choose a treatment. Treating risks raises your readiness.</p>
              <div className="card" style={{ padding: 6 }}><table>
                <thead><tr><th>Risk</th><th>Category</th><th>Likelihood</th><th>Impact</th><th>Score</th><th>Severity</th><th>Treatment</th></tr></thead>
                <tbody>{S.risks.map((rk) => { const sc = riskScore(rk); return (
                  <tr key={rk.id}>
                    <td><b>{rk.title}</b></td><td style={{ color: 'var(--muted)' }}>{rk.cat}</td>
                    <td><select value={rk.l} onChange={(e) => setScore(rk.id, 'l', +e.target.value)}>{[1, 2, 3, 4, 5].map(x => <option key={x}>{x}</option>)}</select></td>
                    <td><select value={rk.i} onChange={(e) => setScore(rk.id, 'i', +e.target.value)}>{[1, 2, 3, 4, 5].map(x => <option key={x}>{x}</option>)}</select></td>
                    <td><span className="score-chip" style={{ color: `var(--${sev(sc)})` }}>{sc}</span></td>
                    <td><span className={`pill ${sev(sc)}`}>{sevLabel(sc)}</span></td>
                    <td><select value={rk.treat} onChange={(e) => setTreat(rk.id, e.target.value)}>{['Untreated', 'Mitigate', 'Accept', 'Transfer', 'Avoid'].map(o => <option key={o}>{o}</option>)}</select></td>
                  </tr>); })}</tbody>
              </table></div></>
          )}

          {view === 'assess' && (
            <><p style={{ color: 'var(--muted)', marginBottom: 16, fontSize: 14 }}>Review each control and mark it Pass, Fail, or N/A. Your compliance score updates live.</p>
              <div className="card" style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 20 }}>
                <div><div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Compliance score</div><div className="comp-n" style={{ color: compColor }}>{comp}%</div></div>
                <div style={{ flex: 1 }}><div className="prog"><span style={{ width: `${comp}%` }} /></div></div>
              </div>
              <div className="card">{S.controls.map((c) => (
                <div className="checkline" key={c.id}>
                  <div className="cn"><b>{c.name}</b><p>{c.desc}</p></div>
                  <div className="seg">
                    <button className={c.state === 'pass' ? 'on-pass' : ''} onClick={() => setCtrl(c.id, 'pass')}>Pass</button>
                    <button className={c.state === 'fail' ? 'on-fail' : ''} onClick={() => setCtrl(c.id, 'fail')}>Fail</button>
                    <button className={c.state === 'na' ? 'on-na' : ''} onClick={() => setCtrl(c.id, 'na')}>N/A</button>
                  </div>
                </div>))}</div></>
          )}

          {view === 'ai' && (() => {
            const done = S.ai.filter(a => a.ok).length, tot = S.ai.length;
            const rating = done <= 1 ? ['High risk', 'var(--high)'] : done <= 3 ? ['Medium risk', 'var(--med)'] : done === tot ? ['Low risk', 'var(--good)'] : ['Elevated risk', 'var(--med)'];
            return (<>
              <p style={{ color: 'var(--muted)', marginBottom: 16, fontSize: 14 }}>Govern the company’s new customer-support AI assistant. Confirm each control to lower its risk rating.</p>
              <div className="card" style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 56, height: 56, borderRadius: 12, background: 'linear-gradient(135deg,#1C3A57,#0E9384)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800 }}>AI</div>
                <div><b style={{ fontSize: 16 }}>Customer Support Assistant</b><div style={{ color: 'var(--muted)', fontSize: 13 }}>LLM + RAG over the knowledge base · in production</div></div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}><div style={{ fontSize: 12, color: 'var(--muted)' }}>Risk rating</div><b style={{ fontSize: 20, color: rating[1] }}>{rating[0]}</b></div>
              </div>
              <div className="card">{S.ai.map((a) => (
                <div className="checkline" key={a.id}><div className="cn"><b>{a.q}</b></div>
                  <button className={`btn btn-sm ${a.ok ? 'btn-primary' : ''}`} onClick={() => toggleAI(a.id)}>{a.ok ? '✓ Confirmed' : 'Confirm control'}</button></div>))}</div>
            </>);
          })()}

          {view === 'compliance' && (() => {
            const aiPct = Math.round(S.ai.filter(a => a.ok).length / (S.ai.length || 1) * 100);
            const frameworks: [string, number][] = [['NIST CSF 2.0', comp], ['ISO/IEC 42001 (AI)', aiPct], ['SOC 2', comp]];
            return (<>
              <p style={{ color: 'var(--muted)', marginBottom: 16, fontSize: 14 }}>Your control posture, mapped to the frameworks the enterprise is working toward.</p>
              <div className="grid cols-3">{frameworks.map((f) => (
                <div className="card" key={f[0]}><h3>{f[0]}</h3><div className="comp-n" style={{ color: f[1] >= 75 ? 'var(--good)' : f[1] >= 50 ? 'var(--med)' : 'var(--high)' }}>{f[1]}%</div><div className="prog"><span style={{ width: `${f[1]}%` }} /></div></div>))}</div>
              <div className="card" style={{ marginTop: 18 }}><h3>Control summary</h3>
                <table><thead><tr><th>Control</th><th>Status</th></tr></thead><tbody>
                  {S.controls.map((c) => <tr key={c.id}><td><b>{c.name}</b></td><td><span className={`pill ${c.state === 'pass' ? 'done' : c.state === 'fail' ? 'high' : 'open'}`}>{c.state === 'na' ? 'N/A' : c.state === 'pass' ? 'Passing' : 'Failing'}</span></td></tr>)}
                </tbody></table></div>
            </>);
          })()}
        </div>
      </div>

      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </div>
  );
}
