-- Cosmic Sprint: players without login, name + surname only.
-- Apply AFTER supabase/schema.sql from the previous authenticated edition.
-- Authentication for dashboard administrators remains unchanged.
create schema if not exists private;
create table if not exists private.cosmic_guest_players (
 id uuid primary key default gen_random_uuid(),
 first_name text not null check (char_length(first_name) between 2 and 32),
 last_name text not null check (char_length(last_name) between 2 and 32),
 token_hash text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
revoke all on private.cosmic_guest_players from public, anon, authenticated;
alter table public.leaderboard drop constraint if exists leaderboard_user_id_fkey;
alter table public.game_sessions drop constraint if exists game_sessions_user_id_fkey;
alter table public.leaderboard drop constraint if exists leaderboard_nickname_check;
alter table public.game_sessions drop constraint if exists game_sessions_nickname_check;
alter table public.leaderboard add constraint leaderboard_nickname_check check(char_length(nickname) between 2 and 70);
alter table public.game_sessions add constraint game_sessions_nickname_check check(char_length(nickname) between 2 and 70);
grant select on public.leaderboard to anon, authenticated;
drop policy if exists "Guests and authenticated users read public ranking" on public.leaderboard;
create policy "Guests and authenticated users read public ranking"
on public.leaderboard for select to anon, authenticated using(true);

CREATE OR REPLACE FUNCTION public.cosmic_guest_register(p_first_name text, p_last_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 f text := regexp_replace(btrim(coalesce(p_first_name,'')), '[[:space:]]+', ' ', 'g');
 l text := regexp_replace(btrim(coalesce(p_last_name,'')), '[[:space:]]+', ' ', 'g');
 pid uuid;
 token text;
begin
 if char_length(f) not between 2 and 32 or char_length(l) not between 2 and 32
    or f ~ '[[:cntrl:][:digit:]]' or l ~ '[[:cntrl:][:digit:]]'
    or f !~ '[[:alpha:]]' or l !~ '[[:alpha:]]' then
   raise exception 'Informe nome e sobrenome válidos (2 a 32 caracteres cada)';
 end if;
 token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
 insert into private.cosmic_guest_players(first_name,last_name,token_hash)
 values (f,l,encode(sha256(convert_to(token,'UTF8')),'hex'))
 returning id into pid;
 return jsonb_build_object('id',pid,'token',token,'first_name',f,'last_name',l,'best_score',0);
end;
$function$
;
revoke all on function public.cosmic_guest_register(text,text) from public,anon,authenticated;
grant execute on function public.cosmic_guest_register(text,text) to anon,authenticated;

CREATE OR REPLACE FUNCTION public.cosmic_guest_profile(p_player_id uuid, p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare g record; score_best integer;
begin
 select first_name,last_name into g from private.cosmic_guest_players
 where id=p_player_id and token_hash=encode(sha256(convert_to(coalesce(p_token,''),'UTF8')),'hex');
 if not found then raise exception 'Identificação do jogador inválida'; end if;
 select best_score into score_best from public.leaderboard where user_id=p_player_id;
 return jsonb_build_object('id',p_player_id,'first_name',g.first_name,'last_name',g.last_name,'best_score',coalesce(score_best,0));
end;
$function$
;
revoke all on function public.cosmic_guest_profile(uuid,text) from public,anon,authenticated;
grant execute on function public.cosmic_guest_profile(uuid,text) to anon,authenticated;

CREATE OR REPLACE FUNCTION public.cosmic_guest_update_name(p_player_id uuid, p_token text, p_first_name text, p_last_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 f text := regexp_replace(btrim(coalesce(p_first_name,'')), '[[:space:]]+', ' ', 'g');
 l text := regexp_replace(btrim(coalesce(p_last_name,'')), '[[:space:]]+', ' ', 'g');
 updated_count integer;
begin
 if char_length(f) not between 2 and 32 or char_length(l) not between 2 and 32
    or f ~ '[[:cntrl:][:digit:]]' or l ~ '[[:cntrl:][:digit:]]'
    or f !~ '[[:alpha:]]' or l !~ '[[:alpha:]]' then
   raise exception 'Informe nome e sobrenome válidos (2 a 32 caracteres cada)';
 end if;
 update private.cosmic_guest_players set first_name=f,last_name=l,updated_at=clock_timestamp()
 where id=p_player_id and token_hash=encode(sha256(convert_to(coalesce(p_token,''),'UTF8')),'hex');
 get diagnostics updated_count=row_count;
 if updated_count=0 then raise exception 'Identificação do jogador inválida'; end if;
 update public.leaderboard set nickname=f||' '||l where user_id=p_player_id;
 return jsonb_build_object('first_name',f,'last_name',l);
end;
$function$
;
revoke all on function public.cosmic_guest_update_name(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.cosmic_guest_update_name(uuid,text,text,text) to anon,authenticated;

CREATE OR REPLACE FUNCTION public.cosmic_guest_start_run(p_player_id uuid, p_token text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare g record; v_run uuid;
begin
 select first_name,last_name into g from private.cosmic_guest_players
 where id=p_player_id and token_hash=encode(sha256(convert_to(coalesce(p_token,''),'UTF8')),'hex');
 if not found then raise exception 'Identificação do jogador inválida'; end if;
 if (select count(*) from public.game_sessions
     where user_id=p_player_id and started_at>clock_timestamp()-interval '1 minute')>=8 then
   raise exception 'Muitas partidas iniciadas. Tente novamente em um minuto';
 end if;
 insert into public.game_sessions(user_id,nickname) values (p_player_id,g.first_name||' '||g.last_name)
 returning id into v_run;
 return v_run;
end;
$function$
;
revoke all on function public.cosmic_guest_start_run(uuid,text) from public,anon,authenticated;
grant execute on function public.cosmic_guest_start_run(uuid,text) to anon,authenticated;

CREATE OR REPLACE FUNCTION public.cosmic_guest_finish_run(p_player_id uuid, p_token text, p_session_id uuid, p_score integer, p_duration numeric, p_items integer, p_level integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_nick text; v_started timestamptz; v_elapsed numeric; v_updated integer;
begin
 select first_name||' '||last_name into v_nick from private.cosmic_guest_players
 where id=p_player_id and token_hash=encode(sha256(convert_to(coalesce(p_token,''),'UTF8')),'hex');
 if not found then raise exception 'Identificação do jogador inválida'; end if;
 if p_score is null or p_duration is null or p_items is null or p_level is null
    or p_score<0 or p_score>50000000
    or p_duration<0 or p_duration>14400
    or p_items<0 or p_items>1000000 or p_level<1 or p_level>9999 then
   raise exception 'Resultado inválido';
 end if;
 select started_at into v_started from public.game_sessions
 where id=p_session_id and user_id=p_player_id and finished_at is null
   and started_at>=clock_timestamp()-interval '4 hours'
 for update;
 if not found then raise exception 'Sessão inexistente, expirada ou já concluída'; end if;
 v_elapsed:=extract(epoch from clock_timestamp()-v_started);
 if p_duration>v_elapsed+3 or p_score>(p_duration*500+500)
    or p_score<greatest(0,floor(p_duration*5)-3)
    or p_items>(p_duration*8+20)
    or p_level<(floor(greatest(0,p_duration-0.1)/5)::integer+1)
    or p_level>(floor((p_duration+0.1)/5)::integer+1) then
   raise exception 'Resultado fora dos limites permitidos';
 end if;
 update public.game_sessions set finished_at=clock_timestamp(),score=p_score,
   duration=p_duration,items=p_items,level=p_level where id=p_session_id;
 insert into public.leaderboard(user_id,nickname,best_score,best_time,items,level,updated_at)
 values (p_player_id,v_nick,p_score,p_duration,p_items,p_level,clock_timestamp())
 on conflict(user_id) do update set
   nickname=excluded.nickname,best_score=excluded.best_score,
   best_time=excluded.best_time,items=excluded.items,level=excluded.level,
   updated_at=excluded.updated_at
 where excluded.best_score>public.leaderboard.best_score
    or (excluded.best_score=public.leaderboard.best_score
        and excluded.best_time>public.leaderboard.best_time);
 get diagnostics v_updated=row_count;
 return v_updated>0;
end;
$function$
;
revoke all on function public.cosmic_guest_finish_run(uuid,text,uuid,integer,numeric,integer,integer) from public,anon,authenticated;
grant execute on function public.cosmic_guest_finish_run(uuid,text,uuid,integer,numeric,integer,integer) to anon,authenticated;

-- Dashboard statistics show registered name-only guests instead of auth.users.
CREATE OR REPLACE FUNCTION public.cosmic_admin_metrics()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
  if not private.is_cosmic_admin() then
    raise exception 'Acesso administrativo não autorizado' using errcode='42501';
  end if;
  select jsonb_build_object(
    'players', (select count(*) from public.leaderboard),
    'registered_users', (select count(*) from private.cosmic_guest_players),
    'completed_runs', (select count(*) from public.game_sessions where finished_at is not null),
    'runs_24h', (select count(*) from public.game_sessions where finished_at >= now() - interval '24 hours'),
    'runs_7d', (select count(*) from public.game_sessions where finished_at >= now() - interval '7 days'),
    'active_runs', (select count(*) from public.game_sessions where finished_at is null and started_at >= now() - interval '20 minutes'),
    'top_score', (select coalesce(max(best_score), 0) from public.leaderboard),
    'average_score', (select coalesce(round(avg(score), 0), 0) from public.game_sessions where finished_at is not null),
    'average_duration', (select coalesce(round(avg(duration), 1), 0) from public.game_sessions where finished_at is not null),
    'last_activity', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb)
      from (select action, affected_count, created_at from private.cosmic_admin_actions order by created_at desc limit 12) x),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('date', d.day::text, 'runs', coalesce(s.total, 0)) order by d.day), '[]'::jsonb)
      from generate_series((now() at time zone 'America/Sao_Paulo')::date - 13,
                           (now() at time zone 'America/Sao_Paulo')::date,
                           interval '1 day') as d(day)
      left join (
        select (finished_at at time zone 'America/Sao_Paulo')::date as day, count(*) as total
        from public.game_sessions
        where finished_at >= now() - interval '15 days'
        group by 1
      ) s on s.day = d.day)
  ) into result;
  return result;
end;
$function$
;
revoke all on function public.cosmic_admin_metrics() from public,anon,authenticated;
grant execute on function public.cosmic_admin_metrics() to authenticated;
