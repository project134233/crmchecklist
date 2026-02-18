# Studio Galilei Checklist Deploy (Vercel + Supabase)

This folder is deploy-ready as a Vercel project root.

## 1) Supabase SQL setup

Run this in your Supabase SQL editor:

```sql
create table if not exists public.sg_todo_memory (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.sg_todo_memory (id, data)
values (
  'global',
  '{"version":3,"source":"ToDo.html","updatedAt":null,"checked":{}}'
)
on conflict (id) do nothing;
```

## 2) Vercel environment variables

Set these in Vercel Project Settings -> Environment Variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## 3) Deploy

- Deploy this folder (`vercel_supabase_deploy`) as project root.
- `vercel.json` handles:
  - `/` -> `ToDo.html`
  - `/memory` -> `/api/memory`

## 4) Smoke test

1. Open your project URL.
2. Open `/memory` and confirm JSON response.
3. Check/uncheck one task in the checklist.
4. Refresh page and confirm state persists.
