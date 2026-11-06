# Catalyst GRC

An **AI-native GRC platform** that tracks an organization's compliance *and* technically
audits its applications — mapping each technical finding straight to the framework
criteria it breaks.

Multi-tenant, consulting-first. **Next.js 15 (App Router) + Supabase + TypeScript.**

Built by **Tosin Aina** — CISSP, CISA, CRISC, ISO/IEC 27001 Lead Auditor, ISACA AAISM.

---

## The problem it solves

Compliance platforms (Drata, Vanta) **track controls**. Scanners **find bugs**.
Nothing connects them — so the translation from a technical finding to a moved
compliance position is done by hand, by a consultant, every time.

Catalyst closes that gap: **a technical finding automatically lowers the compliance
score, mapped to the exact criteria it breaks** — across security *and* AI-governance
frameworks.

## Framework library

| Framework | Version | Criteria | Focus |
|---|---|---|---|
| SOC 2 Trust Services Criteria | 2017 TSC | 33 (CC1–CC9) | Security / trust |
| PCI DSS | 4.0 | 22 | Cardholder data |
| NIST CSF | 2.0 | 22 | Cyber risk |
| **NIST AI RMF** | 1.0 | 19 (GOVERN / MAP / MEASURE / MANAGE) | **AI governance** |
| **ISO/IEC 42001** | 2023 | 9 (Annex A) | **AI management system** |

A single control can satisfy criteria across **all five** frameworks. That cross-mapping
is the core of the data model.

## Multi-tenancy

| Role | Scope | Capability |
|---|---|---|
| `consultant` | all client orgs | full access — the only cross-org role |
| `client_admin` | one org | manage org and members |
| `client_member` | one org | edit controls, evidence, findings |
| `client_viewer` | one org | read-only: readiness and reports |

Enforced at the database layer with Supabase row-level security, not in application code.

## What's built

Next.js App Router routes under `app/[orgId]/` covering frameworks, controls, control
detail, audits, audit detail, tasks and reporting, plus a learner track (`/learn`) and an
instructor view. Schema and seed data ship as eight SQL modules in `supabase/`:

```
supabase/
  platform.sql           multi-tenant core + RLS
  module1_soc2.sql       SOC 2 TSC
  module2_controls.sql   controls and cross-mapping
  module4_audit.sql      audit engine
  module6_tasks.sql      remediation tasks
  module7_pci_nist.sql   PCI DSS 4.0 + NIST CSF 2.0
  module8_ai_governance.sql   NIST AI RMF + ISO/IEC 42001
```

**Status: active development.** The compliance core, framework library and multi-tenant
model are in place. See `V1_SPEC.md` for scope and `CATALYST_GRC_PLATFORM.md` for the
full data model.

## Running locally

```bash
npm install
cp .env.local.example .env.local     # add your Supabase project URL and keys
# apply supabase/setup_all.sql to your Supabase project
npm run dev
```

Open http://localhost:3000.

No credentials are committed to this repository — `.env*` is gitignored.

## Licence

MIT.
