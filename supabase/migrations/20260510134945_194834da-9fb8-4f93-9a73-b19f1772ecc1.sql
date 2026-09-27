
-- Profiles table
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  gender text check (gender in ('male','female','other')),
  avatar_url text,
  bio text,
  language text default 'en',
  rating numeric(3,2) default 0,
  exchanges_count int default 0,
  verified boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_all" on public.profiles for select using (true);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end; $$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Exchange requests
create table public.exchange_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  train_number text not null,
  train_name text not null,
  journey_date date not null,
  boarding_station text not null,
  destination_station text not null,
  coach_number text not null,
  seat_number text not null,
  current_berth text not null,
  desired_berth text not null,
  gender_preference text default 'any' check (gender_preference in ('any','male','female')),
  notes text,
  status text default 'open' check (status in ('open','matched','pending','completed','cancelled')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.exchange_requests enable row level security;
create policy "requests_select_all" on public.exchange_requests for select using (true);
create policy "requests_insert_own" on public.exchange_requests for insert with check (auth.uid() = user_id);
create policy "requests_update_own" on public.exchange_requests for update using (auth.uid() = user_id);
create policy "requests_delete_own" on public.exchange_requests for delete using (auth.uid() = user_id);
create index idx_requests_train_date on public.exchange_requests(train_number, journey_date);

-- Matches
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  request_a uuid not null references public.exchange_requests(id) on delete cascade,
  request_b uuid not null references public.exchange_requests(id) on delete cascade,
  user_a uuid not null,
  user_b uuid not null,
  compatibility int default 50,
  status text default 'pending' check (status in ('pending','accepted','rejected','completed')),
  created_at timestamptz default now()
);
alter table public.matches enable row level security;
create policy "matches_participants_select" on public.matches for select using (auth.uid() in (user_a, user_b));
create policy "matches_participants_insert" on public.matches for insert with check (auth.uid() in (user_a, user_b));
create policy "matches_participants_update" on public.matches for update using (auth.uid() in (user_a, user_b));

-- Messages
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text,
  image_url text,
  read_at timestamptz,
  created_at timestamptz default now()
);
alter table public.messages enable row level security;
create policy "messages_select_in_match" on public.messages for select using (
  exists (select 1 from public.matches m where m.id = match_id and auth.uid() in (m.user_a, m.user_b))
);
create policy "messages_insert_in_match" on public.messages for insert with check (
  auth.uid() = sender_id and
  exists (select 1 from public.matches m where m.id = match_id and auth.uid() in (m.user_a, m.user_b))
);
alter publication supabase_realtime add table public.messages;

-- Notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read boolean default false,
  created_at timestamptz default now()
);
alter table public.notifications enable row level security;
create policy "notif_select_own" on public.notifications for select using (auth.uid() = user_id);
create policy "notif_update_own" on public.notifications for update using (auth.uid() = user_id);
create policy "notif_insert_any_auth" on public.notifications for insert with check (auth.role() = 'authenticated');

-- Reports
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  details text,
  created_at timestamptz default now()
);
alter table public.reports enable row level security;
create policy "reports_insert_own" on public.reports for insert with check (auth.uid() = reporter_id);
create policy "reports_select_own" on public.reports for select using (auth.uid() = reporter_id);

-- Reviews
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  reviewed_id uuid not null references auth.users(id) on delete cascade,
  match_id uuid references public.matches(id) on delete set null,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now()
);
alter table public.reviews enable row level security;
create policy "reviews_select_all" on public.reviews for select using (true);
create policy "reviews_insert_own" on public.reviews for insert with check (auth.uid() = reviewer_id);

-- Updated-at trigger helper
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger requests_touch before update on public.exchange_requests for each row execute function public.touch_updated_at();
