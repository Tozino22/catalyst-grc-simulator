-- ============================================================
-- Module 4 — App-Audit engine (audits, findings, finding→criteria mapping)
-- Run in the catalyst-grc SQL Editor (after Module 2).
-- ============================================================

create table if not exists public.audits (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.orgs (id) on delete cascade,
  name          text not null,
  target        text,
  authorized    boolean not null default false,
  authorized_by uuid references public.profiles (id),
  authorized_at timestamptz,
  status        text not null default 'draft' check (status in ('draft','active','closed')),
  created_at    timestamptz not null default now()
);
create index if not exists idx_audits_org on public.audits (org_id);

create table if not exists public.findings (
  id          uuid primary key default gen_random_uuid(),
  audit_id    uuid not null references public.audits (id) on delete cascade,
  org_id      uuid not null references public.orgs (id) on delete cascade,
  title       text not null,
  description text,
  severity    text not null default 'medium' check (severity in ('critical','high','medium','low','info')),
  cwe         text,
  source      text not null default 'manual',
  status      text not null default 'open' check (status in ('open','remediated','accepted','false_positive')),
  created_at  timestamptz not null default now()
);
create index if not exists idx_findings_audit on public.findings (audit_id);

create table if not exists public.finding_requirements (
  id             uuid primary key default gen_random_uuid(),
  finding_id     uuid not null references public.findings (id) on delete cascade,
  requirement_id uuid not null references public.requirements (id) on delete cascade,
  rationale      text,
  unique (finding_id, requirement_id)
);
create index if not exists idx_fr_finding on public.finding_requirements (finding_id);
create index if not exists idx_fr_req on public.finding_requirements (requirement_id);

-- RLS (reads scoped to org members)
alter table public.audits               enable row level security;
alter table public.findings             enable row level security;
alter table public.finding_requirements enable row level security;

drop policy if exists audits_select on public.audits;
create policy audits_select on public.audits for select using (public.is_org_member(org_id));
drop policy if exists findings_select on public.findings;
create policy findings_select on public.findings for select using (public.is_org_member(org_id));
drop policy if exists fr_select on public.finding_requirements;
create policy fr_select on public.finding_requirements for select
  using (exists (select 1 from public.findings f where f.id = finding_id and public.is_org_member(f.org_id)));

-- Writes via SECURITY DEFINER functions
create or replace function public.create_audit(p_org uuid, p_name text, p_target text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.org_can_edit(p_org) then raise exception 'not allowed'; end if;
  insert into public.audits (org_id, name, target)
    values (p_org, coalesce(nullif(trim(p_name),''),'Untitled audit'), p_target)
    returning id into v_id;
  return v_id;
end; $$;

create or replace function public.authorize_audit(p_audit uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select org_id into v_org from public.audits where id = p_audit;
  if v_org is null or not public.org_can_edit(v_org) then raise exception 'not allowed'; end if;
  update public.audits
    set authorized = true, authorized_by = auth.uid(), authorized_at = now(), status = 'active'
    where id = p_audit;
end; $$;

create or replace function public.add_finding(p_audit uuid, p_title text, p_description text, p_severity text, p_cwe text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_auth boolean; v_id uuid;
begin
  select org_id, authorized into v_org, v_auth from public.audits where id = p_audit;
  if v_org is null or not public.org_can_edit(v_org) then raise exception 'not allowed'; end if;
  if not v_auth then raise exception 'authorize the audit before adding findings'; end if;
  insert into public.findings (audit_id, org_id, title, description, severity, cwe)
    values (p_audit, v_org, coalesce(nullif(trim(p_title),''),'Untitled finding'),
            p_description, coalesce(nullif(p_severity,''),'medium'), p_cwe)
    returning id into v_id;
  return v_id;
end; $$;

create or replace function public.map_finding(p_finding uuid, p_requirement uuid, p_rationale text)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select org_id into v_org from public.findings where id = p_finding;
  if v_org is null or not public.org_can_edit(v_org) then raise exception 'not allowed'; end if;
  insert into public.finding_requirements (finding_id, requirement_id, rationale)
    values (p_finding, p_requirement, p_rationale)
    on conflict (finding_id, requirement_id) do update set rationale = excluded.rationale;
end; $$;

create or replace function public.unmap_finding(p_finding uuid, p_requirement uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select org_id into v_org from public.findings where id = p_finding;
  if v_org is null or not public.org_can_edit(v_org) then raise exception 'not allowed'; end if;
  delete from public.finding_requirements where finding_id = p_finding and requirement_id = p_requirement;
end; $$;

create or replace function public.set_finding_status(p_finding uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select org_id into v_org from public.findings where id = p_finding;
  if v_org is null or not public.org_can_edit(v_org) then raise exception 'not allowed'; end if;
  if p_status not in ('open','remediated','accepted','false_positive') then raise exception 'bad status'; end if;
  update public.findings set status = p_status where id = p_finding;
end; $$;

grant execute on function public.create_audit(uuid,text,text)                to authenticated, anon;
grant execute on function public.authorize_audit(uuid)                        to authenticated, anon;
grant execute on function public.add_finding(uuid,text,text,text,text)        to authenticated, anon;
grant execute on function public.map_finding(uuid,uuid,text)                  to authenticated, anon;
grant execute on function public.unmap_finding(uuid,uuid)                     to authenticated, anon;
grant execute on function public.set_finding_status(uuid,text)                to authenticated, anon;
