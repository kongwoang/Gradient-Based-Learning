-- A private workspace per authenticated reader, with optimistic concurrency.
create table public.gradient_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  data jsonb not null check ((
    jsonb_typeof(data) = 'object'
    and data ->> 'schemaVersion' = '1'
    and jsonb_typeof(data -> 'papers') = 'array'
    and octet_length(data::text) <= 10485760
  ) is true),
  updated_at timestamptz not null default now()
);

alter table public.gradient_workspaces enable row level security;
revoke all on public.gradient_workspaces from anon, authenticated;
grant select, insert, update, delete on public.gradient_workspaces to authenticated;

create policy "Readers select their own workspace"
  on public.gradient_workspaces for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Readers create their own workspace"
  on public.gradient_workspaces for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Readers update their own workspace"
  on public.gradient_workspaces for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Readers delete their own workspace"
  on public.gradient_workspaces for delete to authenticated
  using ((select auth.uid()) = user_id);

create function public.gradient_workspace_timestamp()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.gradient_workspace_timestamp() from public, anon, authenticated;
create trigger gradient_workspace_updated
  before update on public.gradient_workspaces
  for each row execute function public.gradient_workspace_timestamp();
