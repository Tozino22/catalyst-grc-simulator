-- ============================================================
-- Module 1 — Framework library + SOC 2 (Trust Services Criteria) seed
-- Run in the catalyst-grc SQL Editor (after Module 0).
-- ============================================================

-- Framework library (global reference text, readable by any signed-in user)
create table if not exists public.frameworks (
  id       uuid primary key default gen_random_uuid(),
  key      text unique not null,
  name     text not null,
  version  text
);

create table if not exists public.requirements (
  id            uuid primary key default gen_random_uuid(),
  framework_id  uuid not null references public.frameworks (id) on delete cascade,
  ref           text not null,           -- e.g. CC6.1
  title         text not null,
  description   text,
  category      text,                    -- e.g. "CC6 — Logical & Physical Access"
  sort          int default 0,
  unique (framework_id, ref)
);
create index if not exists idx_requirements_fw on public.requirements (framework_id);

-- Which frameworks a client has adopted
create table if not exists public.org_frameworks (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.orgs (id) on delete cascade,
  framework_id  uuid not null references public.frameworks (id) on delete cascade,
  enabled_at    timestamptz not null default now(),
  unique (org_id, framework_id)
);
create index if not exists idx_org_frameworks_org on public.org_frameworks (org_id);

-- RLS
alter table public.frameworks     enable row level security;
alter table public.requirements   enable row level security;
alter table public.org_frameworks enable row level security;

drop policy if exists frameworks_read on public.frameworks;
create policy frameworks_read on public.frameworks for select
  using (auth.uid() is not null);

drop policy if exists requirements_read on public.requirements;
create policy requirements_read on public.requirements for select
  using (auth.uid() is not null);

drop policy if exists org_frameworks_select on public.org_frameworks;
create policy org_frameworks_select on public.org_frameworks for select
  using (public.is_org_member(org_id));
drop policy if exists org_frameworks_manage on public.org_frameworks;
create policy org_frameworks_manage on public.org_frameworks for all
  using (public.org_can_edit(org_id)) with check (public.org_can_edit(org_id));

-- ---------------------------------------------------------------
-- SEED: SOC 2 (2017 Trust Services Criteria — Common Criteria)
-- ---------------------------------------------------------------
insert into public.frameworks (key, name, version)
values ('soc2', 'SOC 2 (Trust Services Criteria)', '2017 TSC')
on conflict (key) do nothing;

insert into public.requirements (framework_id, ref, title, description, category, sort)
select f.id, x.ref, x.title, x.descr, x.category, x.sort
from public.frameworks f,
(values
  ('CC1.1','Integrity and ethical values','The entity demonstrates a commitment to integrity and ethical values.','CC1 — Control Environment',101),
  ('CC1.2','Board oversight','The board of directors demonstrates independence and exercises oversight of internal control.','CC1 — Control Environment',102),
  ('CC1.3','Structure and authority','Management establishes structures, reporting lines, authorities and responsibilities.','CC1 — Control Environment',103),
  ('CC1.4','Commitment to competence','The entity attracts, develops and retains competent people.','CC1 — Control Environment',104),
  ('CC1.5','Accountability','The entity holds individuals accountable for their internal control responsibilities.','CC1 — Control Environment',105),
  ('CC2.1','Quality information','The entity uses relevant, quality information to support internal control.','CC2 — Communication & Information',201),
  ('CC2.2','Internal communication','The entity communicates information internally, including control responsibilities.','CC2 — Communication & Information',202),
  ('CC2.3','External communication','The entity communicates with external parties on matters affecting internal control.','CC2 — Communication & Information',203),
  ('CC3.1','Objectives for risk','The entity specifies objectives clearly enough to identify and assess risk.','CC3 — Risk Assessment',301),
  ('CC3.2','Identify and analyze risk','The entity identifies and analyzes risks to achieving its objectives.','CC3 — Risk Assessment',302),
  ('CC3.3','Fraud risk','The entity considers the potential for fraud in assessing risk.','CC3 — Risk Assessment',303),
  ('CC3.4','Assess change','The entity identifies and assesses changes that could impact internal control.','CC3 — Risk Assessment',304),
  ('CC4.1','Ongoing evaluations','The entity performs ongoing and separate evaluations of internal control.','CC4 — Monitoring',401),
  ('CC4.2','Communicate deficiencies','The entity evaluates and communicates control deficiencies for corrective action.','CC4 — Monitoring',402),
  ('CC5.1','Control activities','The entity selects and develops control activities that mitigate risk.','CC5 — Control Activities',501),
  ('CC5.2','Technology controls','The entity selects and develops general controls over technology.','CC5 — Control Activities',502),
  ('CC5.3','Policies and procedures','The entity deploys control activities through policies and procedures.','CC5 — Control Activities',503),
  ('CC6.1','Logical access security','The entity implements logical access controls to protect information assets.','CC6 — Logical & Physical Access',601),
  ('CC6.2','User provisioning','The entity registers and authorizes new users and manages credentials.','CC6 — Logical & Physical Access',602),
  ('CC6.3','Access rights','The entity manages access based on least privilege and segregation of duties.','CC6 — Logical & Physical Access',603),
  ('CC6.4','Physical access','The entity restricts physical access to facilities and assets.','CC6 — Logical & Physical Access',604),
  ('CC6.5','Secure disposal','The entity securely disposes of data and hardware when no longer needed.','CC6 — Logical & Physical Access',605),
  ('CC6.6','Boundary protection / MFA','The entity implements controls such as MFA and firewalls against external threats.','CC6 — Logical & Physical Access',606),
  ('CC6.7','Secure transmission','The entity restricts and encrypts the transmission and movement of information.','CC6 — Logical & Physical Access',607),
  ('CC6.8','Malware prevention','The entity prevents or detects unauthorized or malicious software.','CC6 — Logical & Physical Access',608),
  ('CC7.1','Vulnerability management','The entity detects configuration changes and vulnerabilities.','CC7 — System Operations',701),
  ('CC7.2','Security monitoring','The entity monitors systems for anomalies and security events.','CC7 — System Operations',702),
  ('CC7.3','Evaluate events','The entity evaluates security events to determine whether they are incidents.','CC7 — System Operations',703),
  ('CC7.4','Incident response','The entity responds to identified security incidents.','CC7 — System Operations',704),
  ('CC7.5','Recovery','The entity recovers from incidents and restores operations.','CC7 — System Operations',705),
  ('CC8.1','Change management','The entity authorizes, designs, tests, approves and implements changes.','CC8 — Change Management',801),
  ('CC9.1','Business continuity','The entity identifies and develops mitigation activities for disruptions (BCP/DR).','CC9 — Risk Mitigation',901),
  ('CC9.2','Vendor risk','The entity assesses and manages risks from vendors and business partners.','CC9 — Risk Mitigation',902)
) as x(ref,title,descr,category,sort)
where f.key = 'soc2'
on conflict (framework_id, ref) do nothing;

-- ---------------------------------------------------------------
-- Auto-enable SOC 2 for new orgs, and backfill existing orgs
-- ---------------------------------------------------------------
create or replace function public.create_org(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated (auth.uid is null)';
  end if;

  insert into public.orgs (name, created_by)
    values (coalesce(nullif(trim(p_name), ''), 'Untitled workspace'), v_uid)
    returning id into v_org;

  insert into public.memberships (org_id, user_id, role)
    values (v_org, v_uid, 'consultant')
    on conflict (org_id, user_id) do nothing;

  -- adopt SOC 2 by default
  insert into public.org_frameworks (org_id, framework_id)
    select v_org, f.id from public.frameworks f where f.key = 'soc2'
    on conflict (org_id, framework_id) do nothing;

  return v_org;
end;
$$;
grant execute on function public.create_org(text) to authenticated, anon;

-- backfill: enable SOC 2 for any org that already exists
insert into public.org_frameworks (org_id, framework_id)
select o.id, f.id from public.orgs o, public.frameworks f
where f.key = 'soc2'
on conflict (org_id, framework_id) do nothing;
