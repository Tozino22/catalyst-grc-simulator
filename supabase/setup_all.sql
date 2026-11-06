-- ============================================================
-- Catalyst GRC — FULL SETUP (run once in the catalyst-grc project)
-- ============================================================

-- Catalyst GRC Simulator — database schema
-- Run in the Supabase SQL Editor (Project > SQL Editor > New query).

-- ---------------------------------------------------------------
-- 1. PROFILES  (one row per auth user; carries role)
-- ---------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  role        text not null default 'learner' check (role in ('learner','instructor','admin')),
  org         text default 'default',
  created_at  timestamptz not null default now()
);

-- auto-create a profile when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------
-- 2. SCENARIOS  (data-driven content — a new lab is a new row)
-- ---------------------------------------------------------------
create table if not exists public.scenarios (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  title       text not null,
  description text,
  config      jsonb not null,          -- seed tasks / risks / controls / ai checks
  published   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- 3. SIM SESSIONS  (a learner's run of a scenario; saved progress)
-- ---------------------------------------------------------------
create table if not exists public.sim_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  scenario_id  uuid not null references public.scenarios (id) on delete cascade,
  state        jsonb not null,          -- current tasks/risks/controls/ai + activity
  readiness    int not null default 0,
  compliance   int not null default 0,
  points       int not null default 0,
  status       text not null default 'in_progress' check (status in ('in_progress','completed')),
  started_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists idx_sessions_user on public.sim_sessions (user_id);
create index if not exists idx_sessions_scenario on public.sim_sessions (scenario_id);

-- keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_touch_sessions on public.sim_sessions;
create trigger trg_touch_sessions before update on public.sim_sessions
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- ---------------------------------------------------------------
alter table public.profiles     enable row level security;
alter table public.scenarios    enable row level security;
alter table public.sim_sessions enable row level security;

-- helper: is the current user an instructor/admin?
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('instructor','admin'));
$$;

-- profiles: you see your own; staff see everyone
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles for select
  using (id = auth.uid() or public.is_staff());
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update
  using (id = auth.uid());

-- scenarios: any signed-in user can read published scenarios; staff manage
drop policy if exists scenarios_read on public.scenarios;
create policy scenarios_read on public.scenarios for select
  using (published or public.is_staff());
drop policy if exists scenarios_write on public.scenarios;
create policy scenarios_write on public.scenarios for all
  using (public.is_staff()) with check (public.is_staff());

-- sim_sessions: learners own their rows; staff can read all
drop policy if exists sessions_own_select on public.sim_sessions;
create policy sessions_own_select on public.sim_sessions for select
  using (user_id = auth.uid() or public.is_staff());
drop policy if exists sessions_own_write on public.sim_sessions;
create policy sessions_own_write on public.sim_sessions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------
-- 5. SEED: the first scenario (Simulated Enterprise) — from the prototype
-- ---------------------------------------------------------------
insert into public.scenarios (slug, title, description, config)
values (
  'simulated-enterprise',
  'Simulated Enterprise',
  'Work as the GRC analyst in a simulated company: action the inbox, assess risk, review controls, and govern the AI.',
  '{
    "tasks": [
      {"id":"t1","type":"risk","icon":"triangle","color":"high","title":"New risk reported","due":"Today","desc":"IT flagged an unpatched, internet-facing server. Add it to the Risk Register and assess it.","action":"goto:risks"},
      {"id":"t2","type":"evidence","icon":"file","color":"med","title":"Evidence request from auditor","due":"Today","desc":"The auditor needs the Q3 user access-review record for SOC 2. Attach the evidence.","action":"resolve"},
      {"id":"t3","type":"vendor","icon":"building","color":"low","title":"Vendor security review","due":"2 days","desc":"A new SaaS vendor submitted a security questionnaire. Review and record a decision.","action":"decision","options":["Approve vendor","Request more info"]},
      {"id":"t4","type":"policy","icon":"shield","color":"med","title":"MFA policy exception request","due":"1 day","desc":"A team lead requests an exception to the MFA policy for a legacy app. Decide the outcome.","action":"decision","options":["Approve exception","Escalate to CISO"]},
      {"id":"t5","type":"incident","icon":"alert","color":"high","title":"Phishing email reported","due":"Today","desc":"Staff reported a suspicious email. Log the incident and mark it triaged.","action":"resolve"},
      {"id":"t6","type":"assess","icon":"check","color":"low","title":"Quarterly control review due","due":"3 days","desc":"Complete this period''s control assessment to refresh the compliance score.","action":"goto:assess"}
    ],
    "risks": [
      {"id":"r1","title":"Ransomware disrupts operations","cat":"Technology","l":4,"i":5,"treat":"Mitigate"},
      {"id":"r2","title":"Key vendor data breach","cat":"Third-Party","l":3,"i":4,"treat":"Untreated"},
      {"id":"r3","title":"Staffing gap in security team","cat":"People","l":3,"i":3,"treat":"Accept"}
    ],
    "controls": [
      {"id":"c1","name":"MFA enforced on all accounts","desc":"Multi-factor authentication required org-wide.","state":"pass"},
      {"id":"c2","name":"Backups tested & recoverable","desc":"Restores verified this quarter.","state":"fail"},
      {"id":"c3","name":"User access reviews performed","desc":"Quarterly least-privilege review.","state":"pass"},
      {"id":"c4","name":"Encryption at rest & in transit","desc":"Sensitive data encrypted end-to-end.","state":"pass"},
      {"id":"c5","name":"Incident response plan tested","desc":"IR plan exercised in the last 12 months.","state":"na"},
      {"id":"c6","name":"Vendor risk assessments","desc":"Third parties assessed before onboarding.","state":"fail"}
    ],
    "ai": [
      {"id":"a1","q":"Is training/usage data privacy-reviewed?","ok":false},
      {"id":"a2","q":"Has the model been tested for bias & fairness?","ok":false},
      {"id":"a3","q":"Are guardrails / content safety in place?","ok":false},
      {"id":"a4","q":"Is there human oversight on consequential actions?","ok":false},
      {"id":"a5","q":"Is the AI system documented & risk-registered?","ok":false}
    ]
  }'::jsonb
) on conflict (slug) do nothing;


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
