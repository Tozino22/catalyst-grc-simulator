-- ============================================================
-- Module 8 — AI Governance frameworks: NIST AI RMF 1.0 + ISO/IEC 42001:2023
-- Run in the catalyst-grc SQL Editor (after Module 1).
-- ============================================================

insert into public.frameworks (key, name, version) values
  ('nistairmf', 'NIST AI RMF',    '1.0'),
  ('iso42001',  'ISO/IEC 42001',  '2023')
on conflict (key) do nothing;

-- ---------------- NIST AI Risk Management Framework 1.0 ----------------
insert into public.requirements (framework_id, ref, title, description, category, sort)
select f.id, x.ref, x.title, x.descr, x.category, x.sort
from public.frameworks f,
(values
  ('GOVERN-1','Policies & processes','Policies, processes and practices for AI risk management are in place, transparent and implemented.','GOVERN',301),
  ('GOVERN-2','Accountability','Accountability structures are in place so teams are empowered and responsible for AI outcomes.','GOVERN',302),
  ('GOVERN-3','Workforce & diversity','Workforce diversity, equity, inclusion and accessibility are prioritized in AI risk management.','GOVERN',303),
  ('GOVERN-4','Culture','Organizational culture fosters critical thinking and a safety-first mindset for AI.','GOVERN',304),
  ('GOVERN-5','Stakeholder engagement','Processes for robust engagement with relevant AI actors are in place.','GOVERN',305),
  ('GOVERN-6','Third-party AI risk','Policies address AI risks from third-party software, data and the supply chain.','GOVERN',306),
  ('MAP-1','Context','The context of the AI system is established and understood.','MAP',307),
  ('MAP-2','Categorization','AI system categorization and capabilities are understood and documented.','MAP',308),
  ('MAP-3','Benefits & costs','AI capabilities, benefits, costs and risks are examined.','MAP',309),
  ('MAP-4','Third-party mapping','Risks and benefits are mapped for third-party components.','MAP',310),
  ('MAP-5','Impacts','Impacts to individuals, groups, communities and society are characterized.','MAP',311),
  ('MEASURE-1','Methods & metrics','Appropriate methods and metrics for AI risk are identified and applied.','MEASURE',312),
  ('MEASURE-2','Trustworthiness','AI systems are evaluated for trustworthy characteristics (valid, safe, secure, fair, private, explainable).','MEASURE',313),
  ('MEASURE-3','Risk tracking','Mechanisms to track AI risks over time are in place.','MEASURE',314),
  ('MEASURE-4','Feedback','Feedback about the efficacy of measurement is gathered and assessed.','MEASURE',315),
  ('MANAGE-1','Prioritization','AI risks are prioritized and acted on based on assessment.','MANAGE',316),
  ('MANAGE-2','Strategies','Strategies to maximize benefits and minimize negative impacts are planned.','MANAGE',317),
  ('MANAGE-3','Third-party management','AI risks and benefits from third parties are managed.','MANAGE',318),
  ('MANAGE-4','Monitoring & response','Risk treatments, including response and recovery, are documented and monitored.','MANAGE',319)
) as x(ref,title,descr,category,sort)
where f.key = 'nistairmf'
on conflict (framework_id, ref) do nothing;

-- ---------------- ISO/IEC 42001:2023 (AI Management System — Annex A) ----------------
insert into public.requirements (framework_id, ref, title, description, category, sort)
select f.id, x.ref, x.title, x.descr, x.category, x.sort
from public.frameworks f,
(values
  ('A.2','AI policy','Management direction and support for AI through a documented AI policy.','Annex A — AI Management Controls',401),
  ('A.3','Internal organization','Roles, responsibilities and reporting lines for AI are defined.','Annex A — AI Management Controls',402),
  ('A.4','Resources for AI','Data, tooling, compute and human resources for AI systems are identified and documented.','Annex A — AI Management Controls',403),
  ('A.5','AI impact assessment','Impact assessments on individuals and society are conducted for AI systems.','Annex A — AI Management Controls',404),
  ('A.6','AI system life cycle','Responsible design, development, verification and deployment across the AI life cycle.','Annex A — AI Management Controls',405),
  ('A.7','Data for AI','Data quality, provenance and preparation for AI systems are governed.','Annex A — AI Management Controls',406),
  ('A.8','Information to stakeholders','Transparency and information provided to users and interested parties.','Annex A — AI Management Controls',407),
  ('A.9','Responsible use','Responsible use of AI, including intended use and human oversight.','Annex A — AI Management Controls',408),
  ('A.10','Third-party relationships','AI responsibilities across third parties and customers are managed.','Annex A — AI Management Controls',409)
) as x(ref,title,descr,category,sort)
where f.key = 'iso42001'
on conflict (framework_id, ref) do nothing;
