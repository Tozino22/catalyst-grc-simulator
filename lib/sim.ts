// Catalyst GRC Simulator — shared simulation engine (types + scoring).
// Framework-agnostic so both the client UI and any server logic use the same rules.

export type Severity = 'high' | 'med' | 'low';

export interface Task {
  id: string; type: string; icon: string; color: 'high' | 'med' | 'low';
  title: string; due: string; desc: string;
  action: string;               // 'resolve' | 'decision' | 'goto:risks' | 'goto:assess'
  options?: string[];
  resolved?: boolean;
}
export interface Risk { id: string; title: string; cat: string; l: number; i: number; treat: string; }
export interface Control { id: string; name: string; desc: string; state: 'pass' | 'fail' | 'na'; }
export interface AICheck { id: string; q: string; ok: boolean; }
export interface Activity { t: string; tm: string; }

export interface ScenarioConfig {
  tasks: Task[]; risks: Risk[]; controls: Control[]; ai: AICheck[];
}
export interface SimState extends ScenarioConfig {
  points: number;
  activity: Activity[];
}

export const sev = (score: number): Severity => (score >= 15 ? 'high' : score >= 8 ? 'med' : 'low');
export const sevLabel = (score: number) => (score >= 15 ? 'High' : score >= 8 ? 'Medium' : 'Low');
export const riskScore = (r: Risk) => r.l * r.i;

/** % of graded (non-N/A) controls that pass. */
export function compliancePct(controls: Control[]): number {
  const graded = controls.filter((c) => c.state !== 'na');
  return graded.length ? Math.round((graded.filter((c) => c.state === 'pass').length / graded.length) * 100) : 0;
}

/** Overall GRC readiness: weighted across tasks, controls, risk treatment and AI governance. */
export function readiness(s: SimState): number {
  const tasksDone = s.tasks.length ? s.tasks.filter((t) => t.resolved).length / s.tasks.length : 0;
  const graded = s.controls.filter((c) => c.state !== 'na');
  const ctrlPass = graded.length ? graded.filter((c) => c.state === 'pass').length / graded.length : 0;
  const treated = s.risks.length ? s.risks.filter((r) => r.treat !== 'Untreated').length / s.risks.length : 0;
  const aiOk = s.ai.length ? s.ai.filter((a) => a.ok).length / s.ai.length : 0;
  return Math.round((tasksDone * 0.3 + ctrlPass * 0.3 + treated * 0.2 + aiOk * 0.2) * 100);
}

/** Build a fresh session state from a scenario's config. */
export function initState(config: ScenarioConfig): SimState {
  return {
    tasks: config.tasks.map((t) => ({ ...t, resolved: false })),
    risks: config.risks.map((r) => ({ ...r })),
    controls: config.controls.map((c) => ({ ...c })),
    ai: config.ai.map((a) => ({ ...a })),
    points: 0,
    activity: [{ t: 'Simulation started — welcome to the enterprise.', tm: 'now' }],
  };
}
