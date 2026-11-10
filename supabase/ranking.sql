-- ケミカル・キッチン 全国ランキング（Supabase）
-- 表は Data API に出ていないスキーマ kk に置き、ブラウザからは public の2つの関数
-- （kk_submit：点数を送る／kk_top：上位を見る）だけを呼べるようにする。
-- 端末ID（dev）は外に返さない。1つの端末から送れるのは20秒に1回まで。

create schema if not exists kk;

create table if not exists kk.scores (
  id bigint generated always as identity primary key,
  g text not null check (g in ('rx','atom','org','ion','quiz','eroot','esyn','eword','kphy','kchem','kmath')),
  st text not null check (st ~ '^[a-z0-9]{1,8}@[1-5](\+c)?$'),
  name text not null check (char_length(name) between 1 and 12),
  dev text not null check (dev ~ '^[0-9a-f]{16}$'),
  score integer not null check (score between 0 and 100000),
  created_at timestamptz not null default now()
);
create index if not exists scores_board on kk.scores (g, st, created_at, score desc);
create index if not exists scores_dev on kk.scores (dev, created_at desc);
alter table kk.scores enable row level security;   -- 方針は作らない＝関数以外からは読めも書けもしない
revoke all on kk.scores from anon, authenticated;

-- 上位（days=0 で全期間）。1端末1行（自己ベスト）。自分の行は圏外でも付ける
create or replace function kk.top_impl(p_g text, p_st text, p_days integer, p_dev text, p_limit integer)
returns table(rank integer, name text, score integer, me boolean, at timestamptz)
language sql stable security definer set search_path = ''
as $$
  with best as (
    select distinct on (s.dev) s.dev, s.name, s.score, s.created_at
    from kk.scores s
    where s.g = p_g and s.st = p_st
      and (coalesce(p_days,0) <= 0 or s.created_at > now() - make_interval(days => least(p_days, 3650)))
    order by s.dev, s.score desc, s.created_at asc
  ), ranked as (
    select (rank() over (order by b.score desc))::integer as r, b.*
    from best b
  )
  select r, x.name, x.score, x.dev = p_dev, x.created_at
  from ranked x
  where r <= least(greatest(coalesce(p_limit,50),1),100) or x.dev = p_dev
  order by r, x.created_at
  limit least(greatest(coalesce(p_limit,50),1),100) + 1;
$$;

-- 点数を送る → 今週の順位・人数・自己ベスト
create or replace function kk.submit_impl(p_g text, p_st text, p_name text, p_dev text, p_score integer)
returns json
language plpgsql volatile security definer set search_path = ''
as $$
declare v_best integer; v_rank integer; v_total integer;
begin
  if exists (select 1 from kk.scores where dev = p_dev and created_at > now() - interval '20 seconds') then
    raise exception 'too many submissions' using errcode = 'P0001', hint = '少し待ってから送る';
  end if;
  insert into kk.scores (g, st, name, dev, score)
  values (p_g, p_st, left(btrim(regexp_replace(coalesce(p_name,''), '[[:cntrl:]<>]', '', 'g')), 12), p_dev, p_score);
  with best as (
    select dev, max(score) as score from kk.scores
    where g = p_g and st = p_st and created_at > now() - interval '7 days'
    group by dev
  )
  select (select score from best where dev = p_dev),
         (select count(*) from best where score > (select score from best where dev = p_dev)) + 1,
         (select count(*) from best)
    into v_best, v_rank, v_total;
  return json_build_object('rank', v_rank, 'total', v_total, 'best', v_best);
end;
$$;

revoke all on function kk.top_impl(text,text,integer,text,integer) from public;
revoke all on function kk.submit_impl(text,text,text,text,integer) from public;
grant usage on schema kk to anon, authenticated;
grant execute on function kk.top_impl(text,text,integer,text,integer) to anon, authenticated;
grant execute on function kk.submit_impl(text,text,text,text,integer) to anon, authenticated;

-- 公開する窓口（security invoker のうすい包み）
create or replace function public.kk_top(p_g text, p_st text, p_days integer default 7, p_dev text default '', p_limit integer default 50)
returns table(rank integer, name text, score integer, me boolean, at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from kk.top_impl(p_g, p_st, p_days, p_dev, p_limit); $$;

create or replace function public.kk_submit(p_g text, p_st text, p_name text, p_dev text, p_score integer)
returns json
language sql volatile security invoker set search_path = ''
as $$ select kk.submit_impl(p_g, p_st, p_name, p_dev, p_score); $$;

revoke all on function public.kk_top(text,text,integer,text,integer) from public;
revoke all on function public.kk_submit(text,text,text,text,integer) from public;
grant execute on function public.kk_top(text,text,integer,text,integer) to anon, authenticated;
grant execute on function public.kk_submit(text,text,text,text,integer) to anon, authenticated;

-- 2026-11: 京大数学 早押し（kmath）を追加（作成済みの表は制約を付け直す）
alter table kk.scores drop constraint if exists scores_g_check;
alter table kk.scores add constraint scores_g_check check (g in ('rx','atom','org','ion','quiz','eroot','esyn','eword','kphy','kchem','kmath'));

-- 2026-11: 理論化学 計算（kcalc）を追加
alter table kk.scores drop constraint if exists scores_g_check;
alter table kk.scores add constraint scores_g_check check (g in ('rx','atom','org','ion','quiz','eroot','esyn','eword','kphy','kchem','kmath','kcalc'));

-- 2026-11: 酸化還元・電池（kredox）を追加
alter table kk.scores drop constraint if exists scores_g_check;
alter table kk.scores add constraint scores_g_check check (g in ('rx','atom','org','ion','quiz','eroot','esyn','eword','kphy','kchem','kmath','kcalc','kredox'));
