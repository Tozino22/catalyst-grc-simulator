-- ============================================================
-- Module 7 — PCI DSS 4.0 + NIST CSF 2.0 framework seeds
-- Run in the catalyst-grc SQL Editor (after Module 1).
-- ============================================================

insert into public.frameworks (key, name, version) values
  ('pci',     'PCI DSS',   'v4.0'),
  ('nistcsf', 'NIST CSF',  '2.0')
on conflict (key) do nothing;

-- ---------------- PCI DSS 4.0 ----------------
insert into public.requirements (framework_id, ref, title, description, category, sort)
select f.id, x.ref, x.title, x.descr, x.category, x.sort
from public.frameworks f,
(values
  ('1','Network security controls','Install and maintain network security controls (firewalls).','Build & Maintain a Secure Network',101),
  ('2','Secure configurations','Apply secure configurations to all system components.','Build & Maintain a Secure Network',102),
  ('3','Protect stored account data','Protect stored cardholder/account data.','Protect Account Data',103),
  ('3.5','Secure stored PAN','Primary account number is secured wherever stored (encryption/tokenization).','Protect Account Data',104),
  ('4','Encrypt data in transit','Protect cardholder data with strong cryptography during transmission over open networks.','Protect Account Data',105),
  ('4.2.1','Strong transport crypto','Strong cryptography (TLS 1.2+) protects account data during transmission.','Protect Account Data',106),
  ('5','Anti-malware','Protect all systems and networks from malicious software.','Vulnerability Management',107),
  ('6','Secure systems & software','Develop and maintain secure systems and software.','Vulnerability Management',108),
  ('6.3.3','Security patches','Security patches and updates are installed within defined timeframes.','Vulnerability Management',109),
  ('6.4.3','Payment page scripts','Scripts on payment pages are authorized, integrity-checked and inventoried.','Vulnerability Management',110),
  ('7','Need-to-know access','Restrict access to system components and cardholder data by business need to know.','Access Control',111),
  ('8','Identify & authenticate','Identify users and authenticate access to system components.','Access Control',112),
  ('8.3','Strong authentication','Strong authentication for users and administrators is established and managed.','Access Control',113),
  ('8.4','MFA for the CDE','Multi-factor authentication is implemented for access into the cardholder data environment.','Access Control',114),
  ('9','Physical access','Restrict physical access to cardholder data.','Access Control',115),
  ('10','Log & monitor','Log and monitor all access to system components and cardholder data.','Monitor & Test',116),
  ('10.2','Audit logs','Audit logs capture the events needed to detect anomalies and support investigations.','Monitor & Test',117),
  ('11','Test security','Test the security of systems and networks regularly.','Monitor & Test',118),
  ('11.3','Vulnerability scans','Internal and external vulnerabilities are identified, prioritized and addressed.','Monitor & Test',119),
  ('11.6.1','Tamper detection','Change- and tamper-detection is deployed on payment pages.','Monitor & Test',120),
  ('12','Security policy','Support information security with organizational policies and programs.','Security Policy',121),
  ('12.8','Third-party risk','Risk from third-party service providers is managed.','Security Policy',122)
) as x(ref,title,descr,category,sort)
where f.key = 'pci'
on conflict (framework_id, ref) do nothing;

-- ---------------- NIST CSF 2.0 ----------------
insert into public.requirements (framework_id, ref, title, description, category, sort)
select f.id, x.ref, x.title, x.descr, x.category, x.sort
from public.frameworks f,
(values
  ('GV.OC','Organizational Context','Mission, stakeholders and requirements informing cybersecurity risk are understood.','GOVERN',201),
  ('GV.RM','Risk Management Strategy','Priorities, constraints and risk tolerance are established.','GOVERN',202),
  ('GV.RR','Roles & Responsibilities','Cybersecurity roles, responsibilities and authorities are established.','GOVERN',203),
  ('GV.PO','Policy','Organizational cybersecurity policy is established and communicated.','GOVERN',204),
  ('GV.OV','Oversight','Cybersecurity risk management activities are reviewed to inform strategy.','GOVERN',205),
  ('GV.SC','Supply Chain Risk','Cyber supply chain risk management processes are established and managed.','GOVERN',206),
  ('ID.AM','Asset Management','Assets (data, systems, people) are identified and managed.','IDENTIFY',207),
  ('ID.RA','Risk Assessment','Cybersecurity risk to the organization is understood.','IDENTIFY',208),
  ('ID.IM','Improvement','Improvements to processes and activities are identified.','IDENTIFY',209),
  ('PR.AA','Identity & Access','Access to assets is limited to authorized users, services and hardware.','PROTECT',210),
  ('PR.AT','Awareness & Training','Personnel are trained to perform their cybersecurity duties.','PROTECT',211),
  ('PR.DS','Data Security','Data is managed consistent with the risk strategy (CIA).','PROTECT',212),
  ('PR.PS','Platform Security','Hardware, software and services are managed to reduce risk.','PROTECT',213),
  ('PR.IR','Infrastructure Resilience','Security architectures are managed for resilience.','PROTECT',214),
  ('DE.CM','Continuous Monitoring','Assets are monitored to detect anomalies and adverse events.','DETECT',215),
  ('DE.AE','Adverse Event Analysis','Anomalies and events are analyzed to characterize and detect incidents.','DETECT',216),
  ('RS.MA','Incident Management','Responses to detected incidents are managed.','RESPOND',217),
  ('RS.AN','Incident Analysis','Investigations support response and recovery.','RESPOND',218),
  ('RS.CO','Response Communication','Response activities are coordinated with stakeholders.','RESPOND',219),
  ('RS.MI','Incident Mitigation','Activities prevent expansion and mitigate incidents.','RESPOND',220),
  ('RC.RP','Recovery Execution','Recovery processes restore assets and operations.','RECOVER',221),
  ('RC.CO','Recovery Communication','Recovery activities are coordinated with internal and external parties.','RECOVER',222)
) as x(ref,title,descr,category,sort)
where f.key = 'nistcsf'
on conflict (framework_id, ref) do nothing;

-- ---------------- Enable / disable a framework for an org ----------------
create or replace function public.enable_framework(p_org uuid, p_framework_key text)
returns void language plpgsql security definer set search_path = public as $$
declare v_fw uuid;
begin
  if not public.org_can_edit(p_org) then raise exception 'not allowed'; end if;
  select id into v_fw from public.frameworks where key = p_framework_key;
  if v_fw is null then raise exception 'unknown framework'; end if;
  insert into public.org_frameworks (org_id, framework_id) values (p_org, v_fw)
    on conflict (org_id, framework_id) do nothing;
end; $$;

create or replace function public.disable_framework(p_org uuid, p_framework uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.org_can_edit(p_org) then raise exception 'not allowed'; end if;
  delete from public.org_frameworks where org_id = p_org and framework_id = p_framework;
end; $$;

grant execute on function public.enable_framework(uuid,text)  to authenticated, anon;
grant execute on function public.disable_framework(uuid,uuid) to authenticated, anon;
