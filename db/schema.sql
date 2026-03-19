-- ============================================================
-- Subbo MVP Schema
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- Users
-- ============================================================
create table if not exists public.users (
  id         uuid primary key default gen_random_uuid(),
  auth_id    uuid unique not null references auth.users(id) on delete cascade,
  role       text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "Users can read own record"
  on public.users for select
  using (auth.uid() = auth_id);

-- ============================================================
-- Profiles
-- ============================================================
create table if not exists public.profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique not null references public.users(id) on delete cascade,
  full_name   text,
  avatar_url  text,
  bio         text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by owner"
  on public.profiles for select
  using (
    user_id in (select id from public.users where auth_id = auth.uid())
  );

create policy "Profiles are updatable by owner"
  on public.profiles for update
  using (
    user_id in (select id from public.users where auth_id = auth.uid())
  );

-- ============================================================
-- Verifications
-- ============================================================
create table if not exists public.verifications (
  id                 uuid primary key default gen_random_uuid(),
  owner_user_id      uuid not null references public.users(id) on delete cascade,
  verification_type  text not null default 'standard',
  use_case           text not null check (use_case in ('room', 'property', 'car', 'item', 'generic')),
  status             text not null default 'draft'
                       check (status in ('draft', 'pending', 'processing', 'complete', 'failed')),
  title              text,
  description        text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.verifications enable row level security;

create policy "Verifications viewable by owner"
  on public.verifications for select
  using (
    owner_user_id in (select id from public.users where auth_id = auth.uid())
  );

create policy "Verifications insertable by owner"
  on public.verifications for insert
  with check (
    owner_user_id in (select id from public.users where auth_id = auth.uid())
  );

create policy "Verifications updatable by owner"
  on public.verifications for update
  using (
    owner_user_id in (select id from public.users where auth_id = auth.uid())
  );

-- ============================================================
-- Verification Media
-- ============================================================
create table if not exists public.verification_media (
  id               uuid primary key default gen_random_uuid(),
  verification_id  uuid not null references public.verifications(id) on delete cascade,
  media_type       text not null
                     check (media_type in ('reference_image', 'captured_video', 'derived_thumbnail')),
  storage_path     text not null,
  uploaded_by      uuid not null references public.users(id),
  created_at       timestamptz not null default now()
);

alter table public.verification_media enable row level security;

create policy "Media viewable by verification owner"
  on public.verification_media for select
  using (
    verification_id in (
      select id from public.verifications
      where owner_user_id in (select id from public.users where auth_id = auth.uid())
    )
  );

create policy "Media insertable by verification owner"
  on public.verification_media for insert
  with check (
    verification_id in (
      select id from public.verifications
      where owner_user_id in (select id from public.users where auth_id = auth.uid())
    )
  );

-- ============================================================
-- Verification Results
-- ============================================================
create table if not exists public.verification_results (
  id               uuid primary key default gen_random_uuid(),
  verification_id  uuid unique not null references public.verifications(id) on delete cascade,
  similarity_score numeric(5, 2),
  summary          text,
  metadata         jsonb,
  created_at       timestamptz not null default now()
);

alter table public.verification_results enable row level security;

create policy "Results viewable by verification owner"
  on public.verification_results for select
  using (
    verification_id in (
      select id from public.verifications
      where owner_user_id in (select id from public.users where auth_id = auth.uid())
    )
  );

-- ============================================================
-- Public Verification Shares
-- ============================================================
create table if not exists public.public_verification_shares (
  id               uuid primary key default gen_random_uuid(),
  verification_id  uuid unique not null references public.verifications(id) on delete cascade,
  public_slug      text unique not null,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

alter table public.public_verification_shares enable row level security;

-- Public read — no auth required (policy uses true)
create policy "Shares are publicly readable when active"
  on public.public_verification_shares for select
  using (is_active = true);

create policy "Shares insertable by verification owner"
  on public.public_verification_shares for insert
  with check (
    verification_id in (
      select id from public.verifications
      where owner_user_id in (select id from public.users where auth_id = auth.uid())
    )
  );

create policy "Shares updatable by verification owner"
  on public.public_verification_shares for update
  using (
    verification_id in (
      select id from public.verifications
      where owner_user_id in (select id from public.users where auth_id = auth.uid())
    )
  );

-- ============================================================
-- Storage buckets (run in Supabase dashboard or via CLI)
-- ============================================================
-- insert into storage.buckets (id, name, public) values ('verification-media', 'verification-media', true);

-- ============================================================
-- Auto-create user record on auth signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (auth_id)
  values (new.id);

  insert into public.profiles (user_id)
  select id from public.users where auth_id = new.id;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- updated_at triggers
-- ============================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger verifications_updated_at
  before update on public.verifications
  for each row execute procedure public.set_updated_at();

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();
