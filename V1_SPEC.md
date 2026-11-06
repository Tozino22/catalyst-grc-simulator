# Catalyst GRC — v1 Spec
### Compliance Core + Web-App-Audit, multi-tenant, consulting-first

> **Status:** for review before building. Nothing is built yet.
> **One-liner:** an AI-native GRC platform that tracks an org's compliance **and** technically
> audits its apps — mapping each finding straight to SOC 2 / PCI / NIST controls.

---

## 1. Positioning (why this is different)
Drata/Vanta **manage compliance** (track controls, pull evidence from integrations) but do **not
technically audit your app**. We fuse the two: a compliance platform **+** an application-audit
engine, where **technical findings automatically move your compliance posture**. That "scan →
control" bridge, normally done by a human, is our differentiator — and it's AI-assistable.

## 2. v1 scope

**In v1**
- Multi-tenant, **consulting-first** (you run it *for* client orgs; productize later)
- **Compliance core (manual evidence):** SOC 2 framework, controls + cross-mapping, evidence,
  readiness dashboard, tasks
- **App-Audit module:** create an audit (with authorization), **intake findings** (manual entry or
  import an AutoScan/assessment file), and **map findings → controls** (AI-assisted), which updates
  control status and creates remediation tasks

**Out of v1 (designed-for, built later)**
- Live cloud scanning workers (AutoScan runs locally for now → import results)
- Integrations / automated evidence collection
- Auditor portal + SOC 2 **Type 2** time-series evidence
- PCI DSS & NIST CSF seeds (additive once SOC 2 proves the model)
- Policies, personnel, vendor-risk modules

## 3. Users & roles (multi-tenant)
A user can belong to **many orgs** (a consultant manages several client tenants).

| Role | Who | Can do |
|---|---|---|
| **consultant** | You / your firm | Create & manage **multiple** client orgs; full access within every org you belong to |
| **client_admin** | Client's lead (e.g. their CISO/IT) | Manage **their own** org — controls, evidence, audits, invite/manage their members |
| **client_member** | Client's team | Contribute — update controls, upload evidence, work assigned tasks |
| **client_viewer** | Client stakeholder (e.g. CEO, board) | **Read-only** — see readiness %, gaps, reports for their org; no edits |
| **auditor** | External auditor | Read-only evidence review (reserved for the Phase-2 auditor portal) |

- **Consultant** is the only cross-org role — you see all your client tenants; every client role is
  scoped to a single org.
- **client_viewer** gives clients transparency (watch their own compliance progress) without letting
  them change anything — useful for execs and for showing value during an engagement.
- Tenant isolation enforced by **Supabase RLS** (every row scoped to `org_id`); a client role can
  never see another client's data.

## 4. Tech stack (reuse what exists)
- **Next.js + Supabase** (the current app) — reuse auth, roles, RLS patterns
- **AI:** start with the same **free Gemini** pattern used in the rental app (server-side route) for
  findings→controls mapping; can swap to Claude later
- The existing simulator stays as-is; v1 adds a **"real mode"** (org workspaces) alongside it

## 5. Data model (new tables)

**Tenancy**
| Table | Key columns |
|---|---|
| `orgs` | id, name, created_by, created_at |
| `memberships` | id, org_id, user_id, role |

**Compliance**
| Table | Key columns |
|---|---|
| `frameworks` | id, key (`soc2`), name, version |
| `requirements` | id, framework_id, ref (`CC6.1`), title, description, category |
| `controls` | id, org_id, key, title, description, status, owner_user_id, updated_at |
| `control_requirements` | id, control_id, requirement_id  *(many-to-many cross-map)* |
| `evidence` | id, org_id, control_id, type (file/link/note), ref, description, collected_by, collected_at |
| `tasks` | id, org_id, control_id?, title, description, owner_user_id, due_date, severity, status, source |

**App-Audit**
| Table | Key columns |
|---|---|
| `audits` | id, org_id, name, target, authorized (bool), authorized_by, authorized_at, status, created_at |
| `findings` | id, audit_id, org_id, title, description, severity, cwe?, source (manual/import), status |
| `finding_requirements` | id, finding_id, requirement_id, rationale  *(finding → control mapping)* |

**Statuses:** control `not_started / in_progress / implemented / not_applicable`;
task/finding `open / in_progress / remediated / accepted / false_positive`;
severity `critical / high / medium / low / info`.

**Readiness** is *computed*, not stored: for a framework, the % of its requirements covered by an
`implemented` control that has at least one piece of evidence.

## 6. SOC 2 framework seed
Seed the **Trust Services Criteria — Common Criteria** (`CC1`–`CC9`) as `requirements` rows
(e.g., CC6.1 logical access, CC6.6 MFA, CC7.1 vuln management, CC7.2 monitoring…). Availability /
Confidentiality categories can be added later. Seed ships as SQL/JSON so PCI & NIST slot in the same
shape.

## 7. Screens
1. **Org switcher** — consultant's list of client orgs (+ "new org")
2. **Org dashboard** — readiness % (SOC 2), gap count, open tasks, recent findings
3. **Framework view** — each requirement, which control(s) cover it, coverage status
4. **Controls** — list + status + owner + mapped requirements + evidence count; **control detail**
   to edit status, upload evidence, view mapped requirements
5. **Tasks** — simple board (open / in progress / done)
6. **App Audits** — list; **new audit** (target + authorization gate); **audit detail** = findings
7. **Finding detail** — severity, description, **suggested control mappings (AI)** to accept/adjust

## 8. App-Audit module flow
```
New audit → AUTHORIZATION gate (RoE acknowledgment, required)  ← legal, non-negotiable
   → add findings: (a) manual entry, or (b) import AutoScan/assessment JSON/CSV
      → each finding: AI suggests affected requirements across frameworks + rationale
         → accept → marks those requirements "at risk" + creates a remediation task
            → fix + evidence → control back to implemented → readiness recovers
```

## 9. Findings → Controls mapping (the differentiator)
When a finding is added, a **server-side AI call** proposes the requirements it affects, with a short
rationale, e.g.:

| Finding | Suggested mapping |
|---|---|
| MFA not enforced on admin | SOC 2 **CC6.6** (later: PCI 8.4, ISO A.5.17) |
| TLS 1.0 permitted | SOC 2 **CC6.7** |
| Outdated dependency (known CVE) | SOC 2 **CC7.1** |

The human **accepts/edits** the mapping (AI assists, doesn't decide). Accepted mappings flip
coverage and spawn tasks — closing the loop from *technical* to *compliance*.

## 10. Build order (module by module)
| # | Module | Delivers |
|---|---|---|
| **0** | Tenancy & roles | orgs, memberships, org switcher, RLS |
| **1** | Framework library + SOC 2 seed | frameworks/requirements tables + CC1–CC9 data |
| **2** | Controls + cross-map + evidence + **readiness dashboard** | the compliance core |
| **3** | Tasks | remediation tracking |
| **4** | App-Audit (audits, authorization, findings intake/import) | the audit shell |
| **5** | **Findings → controls mapping (AI)** | the differentiator |
| **6** | Consulting report export | a readiness/gap report per client |

Each module is shippable and testable on its own.

## 11. Deferred (Phase 2+)
Live cloud scanning (AutoScan workers + queue), integrations/auto-evidence, auditor portal,
SOC 2 **Type 2** timestamped evidence history, PCI DSS + NIST CSF seeds, policies/personnel/vendors,
self-serve product onboarding + billing.

## 12. Security notes (we must dogfood)
- **Tenant isolation via RLS** on every table (`org_id` scoped).
- **No audit without authorization** — the RoE acknowledgment gate is mandatory before any finding
  intake tied to a real target.
- Because we hold clients' compliance data, **the tool itself must be secure** (least privilege,
  audit log, encrypted at rest via Supabase) — we should be able to pass our own SOC 2.
- Server-side only for AI calls (keys never in the browser), same pattern as the rental app.

---

### Next step
Review this. When you're happy, we build **Module 0 (tenancy & roles)** first, then **Module 1
(SOC 2 seed)** — small, shippable steps. Adjust anything above before we start.
