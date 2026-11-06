-- ============================================================
-- Module 6 — Remediation tasks (owner + due date)
-- Run in the catalyst-grc SQL Editor (after Module 4).
-- (Close-the-loop, reports and CSV import need no new tables.)
-- ============================================================

create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.orgs (id) on delete cascade,
  title       text not null,
  description text,
  owner_name  text,
  due_date    date,
  severity    text default 'medium' check (severity in ('critical','high','medium','low','info')),
  status      text not null default 'open' check (status in ('open','in_progress','done')),
  finding_id  uuid references public.findings (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_tasks_org on public.tasks (org_id);

alter table public.tasks enable row level security;
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select using (public.is_org_member(org_id));

create or replace function public.create_task(
  p_org uuid, p_title text, p_description text, p_owner text, p_due date, p_severity text, p_finding uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.org_can_edit(p_org) then raise exception 'not allowed'; end if;
  insert into public.tasks (org_id, title, description, owner_name, due_date, severity, finding_id)
    values (p_org, coalesce(nullif(trim(p_title),''),'Untitled task'), p_description, p_owner, p_due,
            coalesce(nullif(p_severity,''),'medium'), p_finding)
    returning id into v_id;
  return v_id;
end; $$;

create or replace function public.set_task_status(p_task uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select org_id into v_org from public.tasks where id = p_task;
  if v_org is null or not public.org_can_edit(v_org) then raise exception 'not allowed'; end if;
  if p_status not in ('open','in_progress','done') then raise exception 'bad status'; end if;
  update public.tasks set status = p_status where id = p_task;
end; $$;

grant execute on function public.create_task(uuid,text,text,text,date,text,uuid) to authenticated, anon;
grant execute on function public.set_task_status(uuid,text) to authenticated, anon;
