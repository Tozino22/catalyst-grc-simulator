-- ============================================================
-- Module 2 — Controls, cross-mapping, evidence, readiness
-- Run in the catalyst-grc SQL Editor (after Module 1).
-- ============================================================

create table if not exists public.controls (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.orgs (id) on delete cascade,
  title         text not null,
  description   text,
  status        text not null default 'not_started'
                  check (status in ('not_started','in_progress','implemented','not_applicable')),
  owner_user_id uuid references public.profiles (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_controls_org on public.controls (org_id);

create table if not exists public.control_requirements (
  id             uuid primary key default gen_random_uuid(),
  control_id     uuid not null references public.controls (id) on delete cascade,
  requirement_id uuid not null references public.requirements (id) on delete cascade,
  unique (control_id, requirement_id)
);
create index if not exists idx_cr_control on public.control_requirements (control_id);
create index if not exists idx_cr_req on public.control_requirements (requirement_id);

create table if not exists public.evidence (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.orgs (id) on delete cascade,
  control_id   uuid not null references public.controls (id) on delete cascade,
  type         text not null default 'link' check (type in ('link','note')),
  ref          text,
  description  text,
  collected_by uuid references public.profiles (id),
  collected_at timestamptz not null default now()
);
create index if not exists idx_evidence_control on public.evidence (control_id);

-- RLS: reads scoped to org members
alter table public.controls             enable row level security;
alter table public.control_requirements enable row level security;
alter table public.evidence             enable row level security;

drop policy if exists controls_select on public.controls;
create policy controls_select on public.controls for select
  using (public.is_org_member(org_id));

drop policy if exists cr_select on public.control_requirements;
create policy cr_select on public.control_requirements for select
  using (exists (select 1 from public.controls c
                 where c.id = control_id and public.is_org_member(c.org_id)));

drop policy if exists evidence_select on public.evidence;
create policy evidence_select on public.evidence for select
  using (public.is_org_member(org_id));

-- Writes go through SECURITY DEFINER functions (reliable + permission-checked).
create or replace function public.create_control(p_org uuid, p_title text, p_description text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.org_can_edit(p_org) then raise exception 'not allowed'; end if;
  insert into public.controls (org_id, title, description, owner_user_id)
    values (p_org, coalesce(nullif(trim(p_title), ''), 'Untitled control'), p_description, auth.uid())
    returning id into v_id;
  return v_id;
end; $$;

create or replace function public.set_control_status(p_control uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select org_id into v_org from public.controls where id = p_control;
  if v_org is null or not public.org_can_edit(v_org) then raise exception 'not allowed'; end if;
  if p_status not in ('not_started','in_progress','implemented','not_applicable') then
    raise exception 'bad status'; end if;
  update public.controls set status = p_status, updated_at = now() where id = p_control;
end; $$;

create or replace function public.map_control(p_control uuid, p_requirement uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select org_id into v_org from public.controls where id = p_control;
  if v_org is null or not public.org_can_edit(v_org) then raise exception 'not allowed'; end if;
  insert into public.control_requirements (control_id, requirement_id)
    values (p_control, p_requirement) on conflict (control_id, requirement_id) do nothing;
end; $$;

create or replace function public.unmap_control(p_control uuid, p_requirement uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select org_id into v_org from public.controls where id = p_control;
  if v_org is null or not public.org_can_edit(v_org) then raise exception 'not allowed'; end if;
  delete from public.control_requirements where control_id = p_control and requirement_id = p_requirement;
end; $$;

create or replace function public.add_evidence(p_control uuid, p_type text, p_ref text, p_description text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_id uuid;
begin
  select org_id into v_org from public.controls where id = p_control;
  if v_org is null or not public.org_can_edit(v_org) then raise exception 'not allowed'; end if;
  insert into public.evidence (org_id, control_id, type, ref, description, collected_by)
    values (v_org, p_control, coalesce(nullif(p_type,''),'link'), p_ref, p_description, auth.uid())
    returning id into v_id;
  return v_id;
end; $$;

create or replace function public.delete_control(p_control uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select org_id into v_org from public.controls where id = p_control;
  if v_org is null or not public.org_can_edit(v_org) then raise exception 'not allowed'; end if;
  delete from public.controls where id = p_control;
end; $$;

grant execute on function public.create_control(uuid,text,text)     to authenticated, anon;
grant execute on function public.set_control_status(uuid,text)       to authenticated, anon;
grant execute on function public.map_control(uuid,uuid)              to authenticated, anon;
grant execute on function public.unmap_control(uuid,uuid)            to authenticated, anon;
grant execute on function public.add_evidence(uuid,text,text,text)   to authenticated, anon;
grant execute on function public.delete_control(uuid)                to authenticated, anon;
