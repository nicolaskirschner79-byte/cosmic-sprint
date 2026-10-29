-- Cosmic Sprint | banco independente para o jogo.
-- Execute em um NOVO projeto Supabase ou aplique como migração.
-- Nenhuma credencial privada é necessária no frontend.

create table if not exists public.leaderboard (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 12),
  best_score integer not null check (best_score >= 0),
  best_time numeric(10,1) not null check (best_time >= 0),
  items integer not null check (items >= 0),
  level integer not null check (level >= 1),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 12),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  score integer,
  duration numeric(10,1),
  items integer,
  level integer
);

create index if not exists leaderboard_global_order
  on public.leaderboard(best_score desc, best_time desc);
create index if not exists game_sessions_rate_limit
  on public.game_sessions(user_id, started_at desc);

alter table public.leaderboard enable row level security;
alter table public.game_sessions enable row level security;

revoke all on public.leaderboard from public, anon, authenticated;
revoke all on public.game_sessions from public, anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.leaderboard to authenticated;

drop policy if exists "Authenticated users can read global ranking" on public.leaderboard;
create policy "Authenticated users can read global ranking"
  on public.leaderboard for select to authenticated
  using ((select auth.uid()) is not null);

-- Só estas funções podem abrir e concluir sessões.
-- Assim o navegador não pode editar diretamente os pontos da tabela.
create or replace function public.start_run(p_nickname text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_nickname, ''));
  v_id uuid;
begin
  if v_user is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Faça login para participar';
  end if;

  if v_name !~ '^[[:alnum:] _-]{2,12}$' then
    raise exception 'Apelido inválido: utilize entre 2 e 12 caracteres';
  end if;

  if (select count(*) from public.game_sessions
      where user_id = v_user and started_at > clock_timestamp() - interval '1 minute') >= 8 then
    raise exception 'Muitas partidas iniciadas: tente novamente em um minuto';
  end if;

  insert into public.game_sessions(user_id, nickname)
  values (v_user, v_name)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.finish_run(
  p_session_id uuid,
  p_score integer,
  p_duration numeric,
  p_items integer,
  p_level integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_started timestamptz;
  v_nick text;
  v_elapsed numeric;
  v_changed integer;
begin
  if v_user is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Faça login antes de salvar';
  end if;

  if p_score is null or p_duration is null or p_items is null or p_level is null
     or p_score < 0 or p_score > 50000000
     or p_duration < 0 or p_duration > 14400
     or p_items < 0 or p_items > 1000000
     or p_level < 1 or p_level > 9999 then
    raise exception 'Resultado inválido';
  end if;

  select s.started_at, s.nickname into v_started, v_nick
  from public.game_sessions s
  where s.id = p_session_id and s.user_id = v_user
    and s.finished_at is null
    and s.started_at >= clock_timestamp() - interval '4 hours'
  for update;

  if not found then
    raise exception 'Sessão inexistente, expirada ou já concluída';
  end if;

  v_elapsed := extract(epoch from (clock_timestamp() - v_started));
  -- Bloqueia alterações triviais de pontuação e de tempo. Não substitui
  -- uma simulação completa do jogo em servidor contra trapaças sofisticadas.
  if p_duration > v_elapsed + 3
     or p_score > (p_duration * 500 + 500)
     or p_score < greatest(0, floor(p_duration * 5) - 3)
     or p_items > (p_duration * 8 + 20)
     or p_level <> (floor(p_duration / 5)::integer + 1) then
    raise exception 'Resultado fora dos limites permitidos';
  end if;

  update public.game_sessions
  set finished_at = clock_timestamp(),
      score = p_score, duration = p_duration, items = p_items, level = p_level
  where id = p_session_id;

  insert into public.leaderboard(user_id, nickname, best_score, best_time, items, level, updated_at)
  values (v_user, v_nick, p_score, p_duration, p_items, p_level, clock_timestamp())
  on conflict (user_id) do update set
    nickname = excluded.nickname,
    best_score = excluded.best_score,
    best_time = excluded.best_time,
    items = excluded.items,
    level = excluded.level,
    updated_at = excluded.updated_at
  where excluded.best_score > public.leaderboard.best_score
     or (excluded.best_score = public.leaderboard.best_score
         and excluded.best_time > public.leaderboard.best_time);

  get diagnostics v_changed = row_count;
  return v_changed > 0;
end;
$$;

revoke all on function public.start_run(text) from public, anon;
revoke all on function public.finish_run(uuid, integer, numeric, integer, integer) from public, anon;
grant execute on function public.start_run(text) to authenticated;
grant execute on function public.finish_run(uuid, integer, numeric, integer, integer) to authenticated;

-- Habilitar eventos da tabela na replicação do Realtime.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'leaderboard'
  ) then
    alter publication supabase_realtime add table public.leaderboard;
  end if;
end;
$$;
