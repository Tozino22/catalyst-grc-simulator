# Sample Controls — Acme Health Inc.

Add each of these in **Controls → Add a control**, then map to the listed criteria, set the status,
and attach the named evidence (details in `Sample_Evidence_Pack.docx`).

| # | Control title | Description | Map to criteria | Status | Evidence to attach |
|---|---|---|---|---|---|
| 1 | MFA enforced on all accounts | Multi-factor authentication required org-wide, including admin consoles. | SOC 2 **CC6.6**, PCI **8.4**, NIST **PR.AA** | Implemented | MFA Enforcement Policy |
| 2 | Encryption at rest & in transit | AES-256 at rest; TLS 1.2+ in transit for all PHI. | SOC 2 **CC6.7**, PCI **4.2.1** | Implemented | Encryption Standard |
| 3 | Quarterly user access reviews | Least-privilege access reviewed every quarter. | SOC 2 **CC6.3**, PCI **7** | Implemented | Q3 Access Review Record |
| 4 | Backups tested & recoverable | Backups run daily; restores tested quarterly against RTO/RPO. | SOC 2 **CC9.1**, NIST **RC.RP** | Implemented | Backup & Restore Test Log |
| 5 | Vulnerability management & patching | Vulns tracked; critical patches within 30 days. | SOC 2 **CC7.1**, PCI **6.3.3** | In progress | Penetration Test Summary |
| 6 | Vendor risk assessments | Third parties assessed (SOC 2 review) before onboarding. | SOC 2 **CC9.2**, PCI **12.8**, ISO 42001 **A.10** | Implemented | Vendor Security Review |
| 7 | AI system inventory & risk register | All AI systems inventoried, owned, and risk-registered. | NIST **GOVERN-1**, ISO 42001 **A.3** | Implemented | AI System Inventory |
| 8 | AI impact assessment | Impact assessment performed for the triage AI. | ISO 42001 **A.5**, NIST **MAP-5** | Implemented | AI Impact Assessment |
| 9 | Human oversight on AI decisions | Clinician reviews AI triage output before action on urgent cases. | ISO 42001 **A.9**, NIST **MANAGE-4** | In progress | AI Oversight Procedure |
| 10 | Bias & fairness testing | Model tested for bias/fairness before release. | NIST **MEASURE-2**, ISO 42001 **A.5** | **Not started** | *(none — deliberate gap)* |

> Tip: leave #10 "Not started" and #5/#9 "In progress" so the readiness score is realistic
> (not 100%) and there are visible gaps to discuss in the demo.
