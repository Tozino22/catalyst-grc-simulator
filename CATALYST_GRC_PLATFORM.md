# Catalyst GRC — Platform Documentation

An **AI-native GRC platform** that tracks an organization's compliance **and** technically
audits its apps — mapping each finding straight to the relevant framework criteria. Multi-tenant,
consulting-first. Built on **Next.js + Supabase**.

> The differentiator: compliance platforms (Drata, Vanta) track controls; scanners find bugs — but
> nobody connects them. Catalyst does: **a technical finding auto-lowers your compliance score, mapped
> by AI to the exact criteria it breaks** — across security *and* AI-governance frameworks.

---

## Frameworks in the library
| Framework | Version | Criteria | Focus |
|---|---|---|---|
| SOC 2 (Trust Services Criteria) | 2017 TSC | 33 (CC1–CC9) | Security / trust |
| PCI DSS | 4.0 | 22 | Cardholder data |
| NIST CSF | 2.0 | 22 | Cyber risk |
| NIST AI RMF | 1.0 | 19 (GOVERN/MAP/MEASURE/MANAGE) | **AI governance** |
| ISO/IEC 42001 | 2023 | 9 (Annex A) | **AI management system** |

A single **control** can satisfy criteria across **all** frameworks (cross-mapping) — the core value.

## Roles (multi-tenant)
| Role | Scope | Can |
|---|---|---|
| **consultant** | all your client orgs | full access (only cross-org role) |
| **client_admin** | one org | manage org + members |
| **client_member** | one org | edit controls, evidence, findings |
| **client_viewer** | one org | read-only (readiness, reports) |
| **auditor** | one org | read-only (Phase-2 portal) |

Tenant isolation is enforced by **Supabase Row-Level Security** on every table (`org_id`-scoped).

## What each module delivers
| Module | Feature | SQL file |
|---|---|---|
| 0 | Multi-tenant orgs + memberships + RLS | `platform.sql` + `fn_create_org.sql` |
| 1 | Framework library + SOC 2 seed + adopt-on-create | `module1_soc2.sql` |
| 2 | Controls, cross-mapping, evidence, **readiness %** | `module2_controls.sql` |
| 4 | App-audit: audits + authorization gate + findings | `module4_audit.sql` |
| 5 | **AI findings → criteria mapping** (Gemini) | *(no SQL — uses existing tables)* |
| 6 | Remediation tasks (owner + due) | `module6_tasks.sql` |
| 7 | PCI DSS + NIST CSF seeds + enable/disable frameworks | `module7_pci_nist.sql` |
| 8 | NIST AI RMF + ISO 42001 seeds | `module8_ai_governance.sql` |
| — | Close-the-loop (open findings lower readiness), report export, CSV import | *(app-only)* |

Run the SQL files **in order** in the Supabase SQL Editor (or `setup_all.sql` for Modules 0–1).

## Data model (key tables)
```
orgs · memberships                         (tenancy + roles)
frameworks · requirements · org_frameworks (framework library + adoption)
controls · control_requirements · evidence (compliance)
audits · findings · finding_requirements   (app-audit; findings map to requirements)
tasks                                       (remediation)
```
Writes go through **SECURITY DEFINER functions** (`create_org`, `create_control`, `add_finding`,
`map_finding`, `create_task`, `enable_framework`, …) that verify permissions internally — reliable
and safe.

## Readiness score (how it's computed)
For all **enabled** frameworks: `readiness = covered ÷ total criteria`, where a criterion is
**covered** when it has a mapped **implemented** control **and** no **open** finding against it.
An open finding puts a criterion **at risk** — it stops counting as covered (the closed loop).

## The AI mapping (Module 5)
When you click **"✨ Suggest with AI"** on a finding, a server-side call to **Gemini** (free tier,
`gemini-flash-lite-latest`) receives the finding + the enabled frameworks' criteria and returns the
criteria it impacts, with a one-line rationale. The mappings are applied (human can unmap). Key lives
server-side in `.env.local` (`GEMINI_API_KEY`).

## Run locally
```
# .env.local
NEXT_PUBLIC_SUPABASE_URL=...            # catalyst-grc project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...    # legacy anon key (JWT) — the sb_publishable_ key is not
GEMINI_API_KEY=AIza...                  # free Gemini key (for AI mapping)

npm install
npm run dev        # http://localhost:3000  → sign up → /app
```
> Use the **legacy anon key** (JWT `eyJ...`), not the new `sb_publishable_` key — the SSR library
> version doesn't forward the session with the new format, which breaks RLS writes.

## Deploy (later)
Push to GitHub → import to Vercel → set the three env vars in Vercel → deploy. Same pattern as the
rental-analyzer app.

## Roadmap / not yet built
Live cloud scanning (AutoScan workers), integrations/auto-evidence, auditor portal, SOC 2 **Type 2**
timestamped evidence history, per-framework readiness breakdown, member invitations by email,
file-upload evidence (currently link/note), policies & personnel modules, billing.
