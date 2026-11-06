# Catalyst GRC — Demo Walkthrough

A realistic, end-to-end scenario you can run to show the platform (for clients, training, or testing).
Uses the sample content in this `demo-kit/` folder.

## The scenario
**Client: Acme Health Inc.** — a health-tech SaaS providing a patient **triage platform** with an
**AI symptom-checker**. It handles **PHI**, sells to hospitals (so it needs **SOC 2**), and — because of
the AI feature — also wants **AI governance readiness** (**NIST AI RMF** + **ISO 42001**).
You are the **consultant** running the engagement in Catalyst GRC.

---

## Step 1 — Create the workspace
`/app` → **Create workspace** → `Acme Health Inc.` → you're the **Consultant**. SOC 2 is auto-enabled.

## Step 2 — Enable the frameworks
Workspace → **Criteria** → **Enable**: **NIST AI RMF 1.0** and **ISO/IEC 42001:2023**
(SOC 2 already on). Now Acme is pursuing security **and** AI governance.

## Step 3 — Add controls + evidence (use `sample_controls.md`)
Workspace → **Controls** → for each row in `sample_controls.md`:
1. **Add control** (title + description)
2. Open it → **Map** it to the listed criteria (note how one control covers **multiple frameworks**)
3. Set the **status** (Implemented / In progress / Not started)
4. **Add evidence** — a note or link using the details from **`Sample_Evidence_Pack.docx`**

➡️ Watch **readiness climb** on the workspace dashboard as controls go Implemented with evidence.

## Step 4 — Run a technical app-audit (the differentiator)
Workspace → **App audits** → **New audit**: `Acme triage web app review`, target `app.acmehealth.com`
→ open it → **confirm written authorization** (the RoE gate).

Then **Import findings from CSV** → paste the contents of **`sample_findings.csv`** → **Import**.
Seven realistic findings appear (security **and** AI-governance).

## Step 5 — AI-map the findings
On each finding, click **"✨ Suggest with AI"** → Gemini maps it to the right criteria across all
frameworks, with rationale. E.g.:
- *MFA not enforced* → SOC 2 **CC6.6**, PCI **8.4**, NIST **PR.AA**
- *No human oversight on AI triage* → ISO 42001 **A.9**, NIST **MANAGE-4**
- *Training data not privacy-reviewed* → ISO 42001 **A.7**, NIST **MAP-5**

## Step 6 — Close the loop (the powerful visual)
Keep the **MFA finding = Open** and make sure a control mapped to **CC6.6** is Implemented.
Return to the dashboard → that criterion is now **at risk** and **readiness drops** — the scan proved
the control is failing. Set the finding to **Remediated** → readiness recovers.

## Step 7 — Remediation tasks
On a finding → **+ Task** → a remediation task is created (owner + due date on the **Tasks** board).

## Step 8 — Deliver the report
Workspace → **Report** → **Print / Save as PDF** → a branded readiness & gap report (readiness %,
criteria status, controls, open findings, tasks) to hand to Acme.

---

## Demo talking points
- **"One control, many frameworks"** — show MFA covering SOC 2 + PCI + NIST at once.
- **"The scan lowers the score"** — the closed loop no other GRC tool does.
- **"AI maps the findings"** — an AI mapping AI-governance findings; your differentiator.
- **"Security *and* AI governance in one platform"** — where Drata/Vanta are weak.
- **"Consulting-first"** — you manage multiple client workspaces, each isolated.

## Files in this kit
- `sample_controls.md` — controls to add, their mappings, status, and which evidence to attach
- `Sample_Evidence_Pack.docx` — realistic evidence documents (the details to enter/upload)
- `sample_findings.csv` — findings to import into an audit
