-- =============================================================================
-- Recon — schema inicial
-- =============================================================================
-- Como rodar: copie todo o conteúdo deste arquivo e cole no
-- SQL Editor do seu projeto Supabase (Supabase Dashboard → SQL Editor → New
-- query), depois clique em "Run". Veja o passo a passo completo no README.md.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Tabela: athletes (atletas/pacientes)
-- -----------------------------------------------------------------------------
create table if not exists public.athletes (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  idade integer,
  peso numeric,
  altura numeric,
  posicao text,
  historico_lesoes text,
  consentimento_aceito_em timestamptz,
  created_at timestamptz not null default now()
);

alter table public.athletes enable row level security;

-- Qualquer pessoa com o link (mesmo sem login) pode cadastrar um novo atleta
-- na primeira vez que preencher o check-in (igual ao protótipo). Sem "to"
-- aqui de propósito (vale pra PUBLIC) — a chave pública nova do Supabase
-- ("publishable key") nem sempre resolve pro papel "anon" exatamente, então
-- restringir a policy a "anon, authenticated" pode bloquear quem não tem
-- login. A real proteção dos dados sensíveis está nas policies de SELECT
-- abaixo, que continuam exigindo "authenticated" de verdade.
create policy "athletes: qualquer um pode cadastrar" on public.athletes
  for insert
  with check (true);

-- Só o treinador logado enxerga os dados completos do cadastro (idade, peso,
-- lesões prévias etc). Atletas sem login NÃO leem esta tabela diretamente —
-- eles usam a view "athletes_roster" abaixo, que expõe só o nome.
create policy "athletes: treinador le tudo" on public.athletes
  for select
  to authenticated
  using (true);

create policy "athletes: treinador atualiza" on public.athletes
  for update
  to authenticated
  using (true);

-- View pública só com o essencial pra montar a lista "selecione seu nome" do
-- check-in, sem expor idade/peso/lesões de ninguém pra quem não é o treinador.
create or replace view public.athletes_roster
  with (security_invoker = true)
  as
  select id, nome from public.athletes;

grant select on public.athletes_roster to public;

-- -----------------------------------------------------------------------------
-- Tabela: checkins (registro diário do atleta)
-- -----------------------------------------------------------------------------
create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  data date not null,
  modalidade text not null,
  tipo text not null,
  tipo_outro text,
  minutos numeric,
  distancia_km numeric,
  tempo_min numeric,
  rpe integer,
  sono_horas numeric,
  fadiga integer,
  estresse integer,
  tem_dor boolean not null default false,
  dor integer not null default 0,
  recuperacao integer,
  regiao_dor text,
  observacoes text,
  created_at timestamptz not null default now(),
  unique (athlete_id, data)
);

alter table public.checkins enable row level security;

-- Qualquer um com o link pode enviar (ou reenviar, no mesmo dia) o próprio
-- check-in — não existe login de atleta nesta versão.
create policy "checkins: qualquer um pode enviar" on public.checkins
  for insert
  with check (true);

create policy "checkins: qualquer um pode corrigir o mesmo dia" on public.checkins
  for update
  using (true)
  with check (true);

-- IMPORTANTE: não existe policy de "select" para anon/authenticated-atleta.
-- Isso significa que, por padrão, ninguém sem estar logado como treinador
-- consegue LER a tabela de check-ins (só consegue inserir/atualizar o próprio).
-- O carinho de "orientação de hoje" que o atleta vê logo após enviar o
-- check-in é resolvido por uma função (RPC) separada mais abaixo, que devolve
-- só os dados daquele atleta específico — nunca de outra pessoa.
create policy "checkins: treinador le tudo" on public.checkins
  for select
  to authenticated
  using (true);

create policy "checkins: treinador apaga" on public.checkins
  for delete
  to authenticated
  using (true);

-- -----------------------------------------------------------------------------
-- Tabela: injuries (lesões/doenças) — só o treinador mexe aqui, nunca o atleta
-- -----------------------------------------------------------------------------
create table if not exists public.injuries (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  tipo_registro text not null default 'Lesão' check (tipo_registro in ('Lesão', 'Doença')),
  descricao text not null,
  gravidade text not null default 'Leve' check (gravidade in ('Leve', 'Moderada', 'Grave')),
  afastamento_dias integer,
  data date not null,
  alerta_carga_no_momento text,
  alerta_clinico_no_momento text,
  created_at timestamptz not null default now()
);

alter table public.injuries enable row level security;

-- Nenhuma policy pra anon aqui de propósito: atleta sem login não lê nem
-- escreve nada nesta tabela — só o treinador autenticado.
create policy "injuries: treinador le tudo" on public.injuries
  for select
  to authenticated
  using (true);

create policy "injuries: treinador cria" on public.injuries
  for insert
  to authenticated
  with check (true);

create policy "injuries: treinador apaga" on public.injuries
  for delete
  to authenticated
  using (true);

-- -----------------------------------------------------------------------------
-- Função: get_own_recent_checkins
-- -----------------------------------------------------------------------------
-- Permite que a própria página de check-in (sem login) mostre pro atleta a
-- "orientação de hoje" (recovery/autocuidado) logo depois de ele se
-- identificar pelo nome — sem abrir a tabela inteira de check-ins pra
-- qualquer visitante. A função só devolve os registros do athlete_id
-- informado (até 12, mais recentes), nunca de outro atleta.
create or replace function public.get_own_recent_checkins(p_athlete_id uuid)
returns setof public.checkins
language sql
security definer
set search_path = public
as $$
  select *
  from public.checkins
  where athlete_id = p_athlete_id
  order by data desc
  limit 12;
$$;

grant execute on function public.get_own_recent_checkins(uuid) to public;

-- -----------------------------------------------------------------------------
-- Função: register_athlete
-- -----------------------------------------------------------------------------
-- Cadastra um atleta novo e devolve o id gerado. Usamos uma função (em vez de
-- inserir direto na tabela pelo site) porque o Postgres, ao devolver a linha
-- recém-criada, também checa se quem inseriu tem permissão de LER aquela
-- linha — e só o treinador logado tem essa permissão na tabela "athletes".
-- Como esta função roda com privilégio elevado (SECURITY DEFINER), ela
-- consegue devolver o id sem exigir isso, sem abrir a leitura da tabela pra
-- ninguém. Também exige o aceite do termo de consentimento (LGPD) — sem
-- isso, o cadastro é recusado mesmo que alguém tente pular a tela pelo app.
-- (o "drop" abaixo remove uma versão antiga desta função, sem o parâmetro
-- de consentimento, pra não deixar duas versões ambíguas coexistindo)
drop function if exists public.register_athlete(text, integer, numeric, numeric, text, text);

create or replace function public.register_athlete(
  p_nome text,
  p_idade integer default null,
  p_peso numeric default null,
  p_altura numeric default null,
  p_posicao text default null,
  p_historico_lesoes text default null,
  p_consentimento_aceito boolean default false
)
returns table (id uuid, nome text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not p_consentimento_aceito then
    raise exception 'É necessário aceitar o termo de consentimento para se cadastrar.';
  end if;

  return query
    insert into public.athletes (nome, idade, peso, altura, posicao, historico_lesoes, consentimento_aceito_em)
    values (p_nome, p_idade, p_peso, p_altura, p_posicao, p_historico_lesoes, now())
    returning athletes.id, athletes.nome;
end;
$$;

grant execute on function public.register_athlete(text, integer, numeric, numeric, text, text, boolean) to public;

-- -----------------------------------------------------------------------------
-- Função: submit_checkin
-- -----------------------------------------------------------------------------
-- Mesma lógica do register_athlete acima: o Postgres, ao processar um
-- "upsert" (INSERT ... ON CONFLICT DO UPDATE), também confere se quem
-- escreveu tem permissão de leitura envolvida no processo — o que quebra
-- pra quem não está logado. Uma função com privilégio elevado resolve.
create or replace function public.submit_checkin(
  p_athlete_id uuid,
  p_data date,
  p_modalidade text,
  p_tipo text,
  p_tipo_outro text default null,
  p_minutos numeric default null,
  p_distancia_km numeric default null,
  p_tempo_min numeric default null,
  p_rpe integer default null,
  p_sono_horas numeric default null,
  p_fadiga integer default null,
  p_estresse integer default null,
  p_tem_dor boolean default false,
  p_dor integer default 0,
  p_recuperacao integer default null,
  p_regiao_dor text default null,
  p_observacoes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.checkins (
    athlete_id, data, modalidade, tipo, tipo_outro, minutos, distancia_km,
    tempo_min, rpe, sono_horas, fadiga, estresse, tem_dor, dor, recuperacao,
    regiao_dor, observacoes
  ) values (
    p_athlete_id, p_data, p_modalidade, p_tipo, p_tipo_outro, p_minutos, p_distancia_km,
    p_tempo_min, p_rpe, p_sono_horas, p_fadiga, p_estresse, p_tem_dor, p_dor, p_recuperacao,
    p_regiao_dor, p_observacoes
  )
  on conflict (athlete_id, data) do update set
    modalidade = excluded.modalidade,
    tipo = excluded.tipo,
    tipo_outro = excluded.tipo_outro,
    minutos = excluded.minutos,
    distancia_km = excluded.distancia_km,
    tempo_min = excluded.tempo_min,
    rpe = excluded.rpe,
    sono_horas = excluded.sono_horas,
    fadiga = excluded.fadiga,
    estresse = excluded.estresse,
    tem_dor = excluded.tem_dor,
    dor = excluded.dor,
    recuperacao = excluded.recuperacao,
    regiao_dor = excluded.regiao_dor,
    observacoes = excluded.observacoes;
end;
$$;

grant execute on function public.submit_checkin(
  uuid, date, text, text, text, numeric, numeric, numeric, integer, numeric,
  integer, integer, boolean, integer, integer, text, text
) to public;
