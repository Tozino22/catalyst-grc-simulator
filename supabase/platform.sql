-- ============================================================
-- Catalyst GRC — PLATFORM schema (real mode)  ·  Module 0: Tenancy & Roles
-- Run in Supabase SQL Editor AFTER schema.sql.
-- Adds multi-tenant orgs + memberships (5 roles) + RLS helpers.
-- ============================================================

-- ---------------------------------------------------------------
-- ORGS  (each client = a tenant)
-- ---------------------------------------------------------------
create table if not exists public.orgs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- MEMBERSHIPS  (a user's role within one org; user can be in many orgs)
-- ---------------------------------------------------------------
create table if not exists public.memberships (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.orgs (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        text not null default 'client_member'
                check (role in ('consultant','client_admin','client_member','client_viewer','auditor')),
  created_at  timestamptz not null default now(),
  unique (org_id, user_id)
);
create index if not exists idx_memberships_user on public.memberships (user_id);
create index if not exists idx_memberships_org  on public.memberships (org_id);

-- when an org is created, its creator becomes the consultant/owner
create or replace function public.handle_new_org()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.memberships (org_id, user_id, role)
  values (new.id, new.created_by, 'consultant')
  on conflict (org_id, user_id) do nothing;
  return new;
end; $$;
drop trigger if exists on_org_created on public.orgs;
create trigger on_org_created after insert on public.orgs
  for each row execute function public.handle_new_org();

-- ---------------------------------------------------------------
-- RLS HELPERS  (security definer so they can read membership rows)
-- ---------------------------------------------------------------
create or replace function public.is_org_member(o uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships m
    where m.org_id = o and m.user_id = auth.uid());
$$;

create or replace function public.org_role(o uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from public.memberships
    where org_id = o and user_id = auth.uid() limit 1;
$$;

-- can the current user EDIT in this org? (viewers/auditors are read-only)
create or replace function public.org_can_edit(o uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.org_role(o) in ('consultant','client_admin','client_member');
$$;

-- can the current user MANAGE the org (members, settings)?
create or replace function public.org_can_manage(o uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.org_role(o) in ('consultant','client_admin');
$$;

-- do I share any org with user u? (so co-members can see each other's names)
create or replace function public.shares_org(u uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m1
    join public.memberships m2 on m1.org_id = m2.org_id
    where m1.user_id = auth.uid() and m2.user_id = u
  );
$$;

-- ---------------------------------------------------------------
-- RLS POLICIES
-- ---------------------------------------------------------------
alter table public.orgs        enable row level security;
alter table public.memberships enable row level security;

-- orgs: members see their orgs; any signed-in user can create one (as themselves);
-- managers can rename/delete
drop policy if exists orgs_select on public.orgs;
create policy orgs_select on public.orgs for select
  using (public.is_org_member(id));
drop policy if exists orgs_insert on public.orgs;
create policy orgs_insert on public.orgs for insert
  with check (created_by = auth.uid());
drop policy if exists orgs_manage on public.orgs;
create policy orgs_manage on public.orgs for update
  using (public.org_can_manage(id)) with check (public.org_can_manage(id));
drop policy if exists orgs_delete on public.orgs;
create policy orgs_delete on public.orgs for delete
  using (public.org_role(id) = 'consultant');

-- memberships: you see rows for orgs you belong to; managers add/change/remove members
drop policy if exists memberships_select on public.memberships;
create policy memberships_select on public.memberships for select
  using (public.is_org_member(org_id));
drop policy if exists memberships_manage on public.memberships;
create policy memberships_manage on public.memberships for all
  using (public.org_can_manage(org_id)) with check (public.org_can_manage(org_id));

-- let co-members of the same org see each other's profile name (additive select policy)
drop policy if exists profiles_coorg on public.profiles;
create policy profiles_coorg on public.profiles for select
  using (public.shares_org(id));
