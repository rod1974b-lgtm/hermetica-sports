-- Enable necessary extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_net";
create extension if not exists "pg_cron";

-- =========================================================================
-- 1. TEAMS TABLE
-- =========================================================================
create table if not exists public.teams (
    id text primary key, -- e.g. 'vik', 'wolves', 'rbfc', 'wild', 'ars'
    espn_id text unique,
    name text not null,
    th text not null,
    seal text not null,
    league text not null,
    sport text not null,
    record text default '0-0',
    color text default '#4F2683',
    accent text default '#FFC62F',
    logo text,
    pulse_score numeric(5,2) default 50.00 check (pulse_score >= 0 and pulse_score <= 100),
    pulse_trend text default 'steady' check (pulse_trend in ('surging', 'steady', 'cooling', 'critical')),
    pulse_paragraph jsonb default '{"en": "Awaiting initial season live tracking.", "th": "รอการประมวลผลข้อมูลการแข่งขันสด"}'::jsonb,
    last_game_id text,
    updated_at timestamptz default now()
);

-- =========================================================================
-- 2. GAMES TABLE
-- =========================================================================
create table if not exists public.games (
    id text primary key,
    espn_id text unique,
    league text not null,
    sport text not null,
    home_team_id text references public.teams(id) on delete cascade,
    away_team_id text references public.teams(id) on delete cascade,
    home_team_name text not null,
    away_team_name text not null,
    home_score integer default 0,
    away_score integer default 0,
    status text not null default 'UPCOMING' check (status in ('LIVE', 'FINAL', 'UPCOMING')),
    clock text default '—',
    period text default '—',
    kickoff timestamptz not null,
    venue text,
    odds text default '—',
    momentum integer default 50 check (momentum >= 0 and momentum <= 100),
    raw_espn_data jsonb,
    updated_at timestamptz default now()
);

-- Index for live radar queries
create index if not exists idx_games_status on public.games(status);
create index if not exists idx_games_kickoff on public.games(kickoff);
create index if not exists idx_games_league on public.games(league);

-- =========================================================================
-- 3. RATINGS_HISTORY TABLE (AUDIT TRAIL & PULSE BREAKDOWN)
-- =========================================================================
create table if not exists public.ratings_history (
    id uuid primary key default uuid_generate_v4(),
    team_id text not null references public.teams(id) on delete cascade,
    game_id text references public.games(id) on delete set null,
    sharp_rating numeric(5,2) not null,        -- 25%
    bpi_fpi_rating numeric(5,2) not null,      -- 15%
    pff_rating numeric(5,2) not null,          -- 10%
    five_thirty_eight numeric(5,2) not null,   -- 10%
    opta_fangraphs numeric(5,2) not null,      -- 10%
    market_rating numeric(5,2) not null,       -- 15%
    form_rating numeric(5,2) not null,         -- 10%
    context_rating numeric(5,2) not null,      -- 5%
    calculated_pulse numeric(5,2) not null check (calculated_pulse >= 0 and calculated_pulse <= 100),
    pulse_paragraph jsonb,
    created_at timestamptz default now()
);

create index if not exists idx_ratings_team_id on public.ratings_history(team_id);
create index if not exists idx_ratings_created_at on public.ratings_history(created_at desc);

-- =========================================================================
-- ROW LEVEL SECURITY (RLS)
-- =========================================================================
alter table public.teams enable row level security;
alter table public.games enable row level security;
alter table public.ratings_history enable row level security;

-- Public read access
create policy "Public can read teams" on public.teams for select using (true);
create policy "Public can read games" on public.games for select using (true);
create policy "Public can read ratings history" on public.ratings_history for select using (true);

-- Service role full access
create policy "Service role writes teams" on public.teams for all using (auth.role() = 'service_role');
create policy "Service role writes games" on public.games for all using (auth.role() = 'service_role');
create policy "Service role writes ratings history" on public.ratings_history for all using (auth.role() = 'service_role');

-- =========================================================================
-- 4. 60-SECOND CRON SCHEDULER (Via pg_cron & pg_net)
-- =========================================================================
-- Automatically polls the Edge Function every 60 seconds
select cron.unschedule('poll-fetch-live-scores');

select cron.schedule(
  'poll-fetch-live-scores',
  '* * * * *', -- Every minute
  $$
  select net.http_post(
    url := (select coalesce(current_setting('app.settings.supabase_url', true), 'https://YOUR_PROJECT_REF.supabase.co')) || '/functions/v1/fetch-live-scores',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select coalesce(current_setting('app.settings.service_role_key', true), 'YOUR_SERVICE_ROLE_KEY'))
    ),
    body := '{"source": "pg_cron"}'::jsonb
  );
  $$
);
