-- ============================================================
-- create_org(): safely create a workspace + make the caller its consultant.
-- SECURITY DEFINER so it inserts reliably; still verifies the caller is signed in.
-- Run this in the catalyst-grc SQL Editor.
-- ============================================================
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
    raise exception 'not authenticated (auth.uid is null) — session did not reach the database';
  end if;

  insert into public.orgs (name, created_by)
    values (coalesce(nullif(trim(p_name), ''), 'Untitled workspace'), v_uid)
    returning id into v_org;

  insert into public.memberships (org_id, user_id, role)
    values (v_org, v_uid, 'consultant')
    on conflict (org_id, user_id) do nothing;

  return v_org;
end;
$$;

grant execute on function public.create_org(text) to authenticated, anon;
