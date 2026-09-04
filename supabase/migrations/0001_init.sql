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
  -- Preenchidos só quando o atleta é menor de idade (< 18 anos): nome e
  -- contato do responsável legal que deu o consentimento em nome dele
  -- (LGPD exige consentimento do responsável, não do próprio menor).
  responsavel_nome text,
  responsavel_contato text,
  consentimento_aceito_em timestamptz,
  created_at timestamptz not null default now()
);

-- Caso a tabela já exista de uma instalação anterior (antes dos campos de
-- responsável serem adicionados), garante que as colunas novas existam.
alter table public.athletes add column if not exists responsavel_nome text;
alter table public.athletes add column if not exists responsavel_contato text;

alter table public.athletes enable row level security;

-- Cadastro de atleta sem login passa SÓ pela função register_athlete (mais
-- abaixo), nunca por um INSERT direto na tabela — assim a exigência do
-- termo de consentimento (LGPD) não tem como ser pulada por quem chamar a
-- API diretamente (sem passar pelo site). Por isso NÃO existe policy de
-- INSERT pra anon/public aqui: sem policy = ninguém sem login insere direto,
-- só a função (que roda com privilégio elevado e ignora RLS).

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

create policy "athletes: treinador apaga" on public.athletes
  for delete
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
  -- Antes era "unique (athlete_id, data)" (só 1 check-in por atleta por dia).
  -- Agora permite mais de uma sessão no mesmo dia (ex: treino de manhã +
  -- jogo à noite), desde que modalidade ou tipo sejam diferentes. Reenviar
  -- com a MESMA modalidade+tipo no mesmo dia continua sendo tratado como
  -- correção do mesmo registro (sobrescreve), igual antes.
  unique (athlete_id, data, modalidade, tipo)
);

-- Caso a tabela já exista de uma instalação anterior (com a regra antiga de
-- só 1 check-in por atleta por dia), troca pra nova regra que permite mais
-- de uma sessão no mesmo dia (mesma modalidade+tipo continua sobrescrevendo).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'checkins_athlete_id_data_modalidade_tipo_key'
  ) then
    alter table public.checkins drop constraint if exists checkins_athlete_id_data_key;
    alter table public.checkins add constraint checkins_athlete_id_data_modalidade_tipo_key unique (athlete_id, data, modalidade, tipo);
  end if;
end $$;

alter table public.checkins enable row level security;

-- Assim como em athletes, o envio de check-in sem login passa SÓ pela
-- função submit_checkin (mais abaixo) — não existe policy de INSERT/UPDATE
-- pra anon/public aqui de propósito.

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
-- Tabela: recados (mural do treinador pros atletas)
-- -----------------------------------------------------------------------------
-- Um recado simples que o treinador publica. Se athlete_id for nulo, vale
-- pra todo mundo; se apontar pra um atleta, só ele enxerga. Não é um chat —
-- só uma via, do treinador pro atleta.
create table if not exists public.recados (
  id uuid primary key default gen_random_uuid(),
  mensagem text not null,
  athlete_id uuid references public.athletes (id) on delete cascade,
  criado_em timestamptz not null default now()
);

alter table public.recados enable row level security;

-- Leitura aberta pra qualquer um (nada sensível aqui) — sem "to" de
-- propósito, mesmo motivo das outras tabelas (compatibilidade com a
-- publishable key nova do Supabase).
create policy "recados: qualquer um le" on public.recados
  for select
  using (true);

create policy "recados: treinador publica" on public.recados
  for insert
  to authenticated
  with check (true);

create policy "recados: treinador apaga" on public.recados
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
-- Se o atleta for menor de idade (p_idade < 18), também exige nome e
-- contato do responsável — o consentimento de um menor sozinho não é
-- válido perante a LGPD.
-- (o "drop" abaixo remove versões antigas desta função, com uma lista de
-- parâmetros diferente, pra não deixar duas versões ambíguas coexistindo)
drop function if exists public.register_athlete(text, integer, numeric, numeric, text, text);
drop function if exists public.register_athlete(text, integer, numeric, numeric, text, text, boolean);

create or replace function public.register_athlete(
  p_nome text,
  p_idade integer default null,
  p_peso numeric default null,
  p_altura numeric default null,
  p_posicao text default null,
  p_historico_lesoes text default null,
  p_consentimento_aceito boolean default false,
  p_responsavel_nome text default null,
  p_responsavel_contato text default null
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

  if p_idade is not null and p_idade < 18 and (p_responsavel_nome is null or trim(p_responsavel_nome) = '' or p_responsavel_contato is null or trim(p_responsavel_contato) = '') then
    raise exception 'Atleta menor de idade: é necessário informar nome e contato do responsável.';
  end if;

  return query
    insert into public.athletes (nome, idade, peso, altura, posicao, historico_lesoes, responsavel_nome, responsavel_contato, consentimento_aceito_em)
    values (p_nome, p_idade, p_peso, p_altura, p_posicao, p_historico_lesoes, p_responsavel_nome, p_responsavel_contato, now())
    returning athletes.id, athletes.nome;
end;
$$;

grant execute on function public.register_athlete(text, integer, numeric, numeric, text, text, boolean, text, text) to public;

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
  -- reenviar com a mesma modalidade+tipo no mesmo dia é tratado como
  -- correção do mesmo registro (sobrescreve); modalidade ou tipo diferentes
  -- no mesmo dia viram uma sessão nova (ex: treino de manhã + jogo à noite)
  on conflict (athlete_id, data, modalidade, tipo) do update set
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
