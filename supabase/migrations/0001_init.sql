-- =============================================================================
-- Recon — schema inicial
-- =============================================================================
-- Como rodar: copie todo o conteúdo deste arquivo e cole no
-- SQL Editor do seu projeto Supabase (Supabase Dashboard → SQL Editor → New
-- query), depois clique em "Run". Veja o passo a passo completo no README.md.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Tabela: professionals (fisioterapeutas/educadores físicos que usam o Recon)
-- -----------------------------------------------------------------------------
-- Base pra evoluir de "um treinador só" (você) pra vários profissionais
-- independentes, cada um com seus próprios atletas/pacientes — sem que um
-- enxergue os dados do outro. Por enquanto só você existe aqui; o cadastro
-- de novos profissionais é uma etapa futura. O "id" é o mesmo id do login
-- (auth.users) — não é uma tabela de senha própria, só um perfil.
create table if not exists public.professionals (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text,
  -- Identificador curto e único usado no link de check-in próprio de cada
  -- profissional (ex: recon-app.vercel.app/checkin/sergio-vargas). Só
  -- letras minúsculas, números e hífen — validado na função
  -- definir_slug_profissional mais abaixo, nunca escrito direto na tabela.
  slug text,
  created_at timestamptz not null default now()
);

-- Caso a tabela já exista de uma instalação anterior (antes do slug
-- existir), garante a coluna.
alter table public.professionals add column if not exists slug text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'professionals_slug_key'
  ) then
    alter table public.professionals add constraint professionals_slug_key unique (slug);
  end if;
end $$;

alter table public.professionals enable row level security;

drop policy if exists "professionals: le o proprio perfil" on public.professionals;
create policy "professionals: le o proprio perfil" on public.professionals
  for select
  to authenticated
  using (id = auth.uid());

-- Garante que você (o único profissional até agora) tem uma linha aqui —
-- sem isso, get_owner_padrao() mais abaixo não tem o que devolver.
insert into public.professionals (id, nome)
select id, 'Sergio Vargas'
from auth.users
where email = 'sergiopv97@gmail.com'
on conflict (id) do nothing;

-- Slug pra você (o link de check-in vira /checkin/sergio-vargas) — só
-- preenche se ainda não tiver um definido (não sobrescreve se você já
-- tiver trocado pelo painel).
update public.professionals
set slug = 'sergio-vargas'
where slug is null
  and id = (select id from auth.users where email = 'sergiopv97@gmail.com' limit 1);

-- -----------------------------------------------------------------------------
-- Tabela: athletes (atletas/pacientes)
-- -----------------------------------------------------------------------------
create table if not exists public.athletes (
  id uuid primary key default gen_random_uuid(),
  -- Único só DENTRO do mesmo profissional (ver constraint mais abaixo) —
  -- dois profissionais diferentes podem cada um ter um atleta "João Silva"
  -- sem conflito.
  nome text not null,
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
  -- Hash do PIN de 4 dígitos (nunca o PIN em texto puro) — verificado na
  -- função verificar_pin_atleta mais abaixo, pra confirmar que quem está
  -- selecionando o nome na lista é realmente aquele atleta, não outra
  -- pessoa. Atletas cadastrados antes dessa funcionalidade existir ficam
  -- com isso nulo (sem PIN) até o treinador definir um pelo painel.
  pin_hash text,
  -- De qual profissional é esse atleta — é isso que separa os dados de um
  -- profissional dos de outro. Referencia o login (auth.users) dele.
  owner_id uuid references auth.users (id) on delete cascade,
  consentimento_aceito_em timestamptz,
  created_at timestamptz not null default now()
);

-- Caso a tabela já exista de uma instalação anterior (antes dos campos de
-- responsável/PIN/owner_id serem adicionados), garante que as colunas
-- novas existam, e preenche owner_id nos atletas que já existiam (todos
-- seus, já que até agora só existia um profissional).
alter table public.athletes add column if not exists responsavel_nome text;
alter table public.athletes add column if not exists responsavel_contato text;
alter table public.athletes add column if not exists pin_hash text;
alter table public.athletes add column if not exists owner_id uuid references auth.users (id) on delete cascade;

update public.athletes
set owner_id = (select id from auth.users where email = 'sergiopv97@gmail.com' limit 1)
where owner_id is null;

-- Troca o "nome único em toda a tabela" (de uma instalação anterior, só
-- com um profissional) por "nome único por profissional" — sem isso, dois
-- profissionais nunca poderiam ter cada um um atleta com o mesmo nome.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'athletes_owner_id_nome_key'
  ) then
    alter table public.athletes drop constraint if exists athletes_nome_key;
    alter table public.athletes add constraint athletes_owner_id_nome_key unique (owner_id, nome);
  end if;
end $$;

alter table public.athletes enable row level security;

-- Cadastro de atleta sem login passa SÓ pela função register_athlete (mais
-- abaixo), nunca por um INSERT direto na tabela — assim a exigência do
-- termo de consentimento (LGPD) não tem como ser pulada por quem chamar a
-- API diretamente (sem passar pelo site). Por isso NÃO existe policy de
-- INSERT pra anon/public aqui: sem policy = ninguém sem login insere direto,
-- só a função (que roda com privilégio elevado e ignora RLS).

-- Só o treinador logado enxerga os dados completos do cadastro (idade, peso,
-- lesões prévias etc), e só os PRÓPRIOS atletas dele (owner_id = quem está
-- logado) — nunca os de outro profissional. Atletas sem login NÃO leem esta
-- tabela diretamente — eles usam a view "athletes_roster" abaixo, que expõe
-- só o nome.
drop policy if exists "athletes: treinador le os proprios" on public.athletes;
create policy "athletes: treinador le os proprios" on public.athletes
  for select
  to authenticated
  using (owner_id = auth.uid());

drop policy if exists "athletes: treinador atualiza os proprios" on public.athletes;
create policy "athletes: treinador atualiza os proprios" on public.athletes
  for update
  to authenticated
  using (owner_id = auth.uid());

drop policy if exists "athletes: treinador apaga os proprios" on public.athletes;
create policy "athletes: treinador apaga os proprios" on public.athletes
  for delete
  to authenticated
  using (owner_id = auth.uid());

-- View pública só com o essencial pra montar a lista "selecione seu nome" do
-- check-in, sem expor idade/peso/lesões de ninguém pra quem não é o treinador.
-- "tem_pin" é só um booleano (nunca o hash em si) — o app usa isso pra saber
-- se precisa pedir o PIN antes de deixar continuar com aquele nome.
-- "owner_id" é exposto porque o check-in precisa filtrar a lista pelo
-- profissional certo (não é dado sensível, é só um id de referência).
create or replace view public.athletes_roster
  with (security_invoker = true)
  as
  select id, nome, owner_id, (pin_hash is not null) as tem_pin from public.athletes;

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
  -- Mesmo dono do atleta (duplicado aqui, não só em athletes) — deixa a
  -- regra de segurança abaixo simples e rápida, sem precisar cruzar com a
  -- tabela athletes toda vez que alguém lê um check-in.
  owner_id uuid references auth.users (id) on delete cascade,
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

-- Caso a tabela já exista de uma instalação anterior (antes do owner_id
-- existir), garante a coluna e preenche a partir do dono do atleta.
alter table public.checkins add column if not exists owner_id uuid references auth.users (id) on delete cascade;
update public.checkins c
set owner_id = a.owner_id
from public.athletes a
where c.athlete_id = a.id and c.owner_id is null;

alter table public.checkins enable row level security;

-- Assim como em athletes, o envio de check-in sem login passa SÓ pela
-- função submit_checkin (mais abaixo) — não existe policy de INSERT/UPDATE
-- pra anon/public aqui de propósito.

-- IMPORTANTE: não existe policy de "select" para anon/authenticated-atleta.
-- Isso significa que, por padrão, ninguém sem estar logado como treinador
-- consegue LER a tabela de check-ins (só consegue inserir/atualizar o próprio).
-- O carinho de "orientação de hoje" que o atleta vê logo após enviar o
-- check-in é resolvido por uma função (RPC) separada mais abaixo, que devolve
-- só os dados daquele atleta específico — nunca de outra pessoa. O treinador
-- só vê os check-ins dos PRÓPRIOS atletas (owner_id = quem está logado).
drop policy if exists "checkins: treinador le os proprios" on public.checkins;
create policy "checkins: treinador le os proprios" on public.checkins
  for select
  to authenticated
  using (owner_id = auth.uid());

drop policy if exists "checkins: treinador apaga os proprios" on public.checkins;
create policy "checkins: treinador apaga os proprios" on public.checkins
  for delete
  to authenticated
  using (owner_id = auth.uid());

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
  -- De qual profissional é esse recado — preenchido sozinho (default) com
  -- quem estiver logado publicando, então o painel não precisa mandar isso
  -- explicitamente. Precisa ser exposto na leitura (fica aberta pra
  -- qualquer um) porque o check-in filtra por profissional no app.
  owner_id uuid references auth.users (id) on delete cascade default auth.uid(),
  criado_em timestamptz not null default now()
);

alter table public.recados add column if not exists owner_id uuid references auth.users (id) on delete cascade default auth.uid();
alter table public.recados alter column owner_id set default auth.uid();
update public.recados r
set owner_id = coalesce(
  (select a.owner_id from public.athletes a where a.id = r.athlete_id),
  (select id from auth.users where email = 'sergiopv97@gmail.com' limit 1)
)
where owner_id is null;

alter table public.recados enable row level security;

-- Leitura aberta pra qualquer um (nada sensível aqui) — sem "to" de
-- propósito, mesmo motivo das outras tabelas (compatibilidade com a
-- publishable key nova do Supabase). O app filtra por owner_id na consulta
-- (via get_owner_padrao), porque o banco não tem como saber "de qual
-- profissional" é um visitante sem login.
drop policy if exists "recados: qualquer um le" on public.recados;
create policy "recados: qualquer um le" on public.recados
  for select
  using (true);

drop policy if exists "recados: treinador publica os proprios" on public.recados;
create policy "recados: treinador publica os proprios" on public.recados
  for insert
  to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "recados: treinador apaga os proprios" on public.recados;
create policy "recados: treinador apaga os proprios" on public.recados
  for delete
  to authenticated
  using (owner_id = auth.uid());

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
  -- Preenchido sozinho (default) com quem estiver logado registrando —
  -- o painel não precisa mandar isso explicitamente.
  owner_id uuid references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.injuries add column if not exists owner_id uuid references auth.users (id) on delete cascade default auth.uid();
alter table public.injuries alter column owner_id set default auth.uid();
update public.injuries i
set owner_id = a.owner_id
from public.athletes a
where i.athlete_id = a.id and i.owner_id is null;

alter table public.injuries enable row level security;

-- Nenhuma policy pra anon aqui de propósito: atleta sem login não lê nem
-- escreve nada nesta tabela — só o treinador autenticado, e só os
-- PRÓPRIOS registros dele (owner_id = quem está logado).
drop policy if exists "injuries: treinador le os proprios" on public.injuries;
create policy "injuries: treinador le os proprios" on public.injuries
  for select
  to authenticated
  using (owner_id = auth.uid());

drop policy if exists "injuries: treinador cria os proprios" on public.injuries;
create policy "injuries: treinador cria os proprios" on public.injuries
  for insert
  to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "injuries: treinador apaga os proprios" on public.injuries;
create policy "injuries: treinador apaga os proprios" on public.injuries
  for delete
  to authenticated
  using (owner_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Função: get_owner_padrao
-- -----------------------------------------------------------------------------
-- Usada só pelo link de check-in antigo, sem slug ("/checkin", sem nada
-- depois) — pra não quebrar pra quem já tem esse link salvo. Devolve o
-- profissional mais antigo cadastrado (com só um, é sempre você). Todo
-- link novo usa get_owner_by_slug abaixo, que aponta pro profissional
-- certo em vez de sempre cair no mais antigo.
create or replace function public.get_owner_padrao()
returns uuid
language sql
security definer
set search_path = public
as $$
  select id from public.professionals order by created_at asc limit 1;
$$;

grant execute on function public.get_owner_padrao() to public;

-- -----------------------------------------------------------------------------
-- Função: get_owner_by_slug
-- -----------------------------------------------------------------------------
-- Resolve o link de check-in próprio de cada profissional
-- (/checkin/[slug]) pro id dele. Devolve null se o slug não existir —
-- o site mostra uma mensagem clara nesse caso, em vez de travar.
create or replace function public.get_owner_by_slug(p_slug text)
returns uuid
language sql
security definer
set search_path = public
as $$
  select id from public.professionals where slug = lower(trim(p_slug));
$$;

grant execute on function public.get_owner_by_slug(text) to public;

-- -----------------------------------------------------------------------------
-- Função: definir_slug_profissional
-- -----------------------------------------------------------------------------
-- Deixa o profissional logado escolher ou trocar o próprio link de
-- check-in (ex: "joao-fisio" vira /checkin/joao-fisio). Só letras
-- minúsculas, números e hífen, entre 3 e 40 caracteres — e não pode
-- repetir o de outro profissional (a constraint unique em "slug" garante
-- isso mesmo se dois pedidos chegarem ao mesmo tempo; a checagem abaixo
-- só existe pra dar uma mensagem de erro legível em vez do erro cru do
-- banco).
create or replace function public.definir_slug_profissional(p_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text := lower(trim(p_slug));
begin
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(v_slug) < 3 or char_length(v_slug) > 40 then
    raise exception 'O link só pode ter letras minúsculas, números e hífen (sem espaços ou acentos), com 3 a 40 caracteres. Ex: joao-fisio.';
  end if;

  if exists (select 1 from public.professionals where slug = v_slug and id <> auth.uid()) then
    raise exception 'Esse link já está em uso por outro profissional. Escolha outro.';
  end if;

  update public.professionals set slug = v_slug where id = auth.uid();
end;
$$;

grant execute on function public.definir_slug_profissional(text) to authenticated;

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
-- válido perante a LGPD. Também exige um PIN de 4 dígitos (p_pin) —
-- guardado só como hash (nunca em texto puro), usado depois pra confirmar
-- que quem seleciona esse nome na lista é realmente esse atleta. Recebe
-- também p_owner_id — de qual profissional é esse cadastro (o site
-- descobre isso chamando get_owner_padrao() antes, por enquanto).
-- (o "drop" abaixo remove versões antigas desta função, com uma lista de
-- parâmetros diferente, pra não deixar duas versões ambíguas coexistindo)
drop function if exists public.register_athlete(text, integer, numeric, numeric, text, text);
drop function if exists public.register_athlete(text, integer, numeric, numeric, text, text, boolean);
drop function if exists public.register_athlete(text, integer, numeric, numeric, text, text, boolean, text, text);
drop function if exists public.register_athlete(text, integer, numeric, numeric, text, text, boolean, text, text, text);

create or replace function public.register_athlete(
  p_nome text,
  p_idade integer default null,
  p_peso numeric default null,
  p_altura numeric default null,
  p_posicao text default null,
  p_historico_lesoes text default null,
  p_consentimento_aceito boolean default false,
  p_responsavel_nome text default null,
  p_responsavel_contato text default null,
  p_pin text default null,
  p_owner_id uuid default null
)
returns table (id uuid, nome text)
language plpgsql
security definer
-- "extensions" além de "public" porque o Supabase instala o pgcrypto
-- (crypt/gen_salt, usados pra fazer o hash do PIN) nesse schema separado,
-- não em "public" — sem isso, o Postgres não acha a função crypt().
set search_path = public, extensions
as $$
begin
  if not p_consentimento_aceito then
    raise exception 'É necessário aceitar o termo de consentimento para se cadastrar.';
  end if;

  if p_idade is not null and p_idade < 18 and (p_responsavel_nome is null or trim(p_responsavel_nome) = '' or p_responsavel_contato is null or trim(p_responsavel_contato) = '') then
    raise exception 'Atleta menor de idade: é necessário informar nome e contato do responsável.';
  end if;

  if p_pin !~ '^\d{4}$' then
    raise exception 'É necessário criar um PIN de exatamente 4 dígitos.';
  end if;

  if p_owner_id is null then
    raise exception 'Não foi possível identificar o profissional responsável.';
  end if;

  return query
    insert into public.athletes (nome, idade, peso, altura, posicao, historico_lesoes, responsavel_nome, responsavel_contato, pin_hash, owner_id, consentimento_aceito_em)
    values (p_nome, p_idade, p_peso, p_altura, p_posicao, p_historico_lesoes, p_responsavel_nome, p_responsavel_contato, crypt(p_pin, gen_salt('bf')), p_owner_id, now())
    returning athletes.id, athletes.nome;
end;
$$;

grant execute on function public.register_athlete(text, integer, numeric, numeric, text, text, boolean, text, text, text, uuid) to public;

-- -----------------------------------------------------------------------------
-- Função: verificar_pin_atleta
-- -----------------------------------------------------------------------------
-- Confirma se o PIN digitado bate com o hash guardado daquele atleta —
-- chamada pelo check-in antes de deixar continuar com um nome selecionado
-- na lista, pra dificultar que alguém preencha em nome de outra pessoa só
-- por saber o nome dela. Devolve só true/false, nunca o hash em si.
create or replace function public.verificar_pin_atleta(p_athlete_id uuid, p_pin text)
returns boolean
language sql
security definer
-- "extensions" além de "public": ver comentário em register_athlete acima.
set search_path = public, extensions
as $$
  select case when pin_hash is null then false else pin_hash = crypt(p_pin, pin_hash) end
  from public.athletes
  where id = p_athlete_id;
$$;

grant execute on function public.verificar_pin_atleta(uuid, text) to public;

-- -----------------------------------------------------------------------------
-- Função: definir_pin_atleta
-- -----------------------------------------------------------------------------
-- Deixa o treinador definir ou redefinir o PIN de um atleta (útil pros
-- atletas cadastrados antes dessa funcionalidade existir, ou se alguém
-- esquecer o PIN). Só o treinador logado pode chamar isso — nunca o atleta
-- sem login (por isso o grant é só "to authenticated", diferente das
-- outras funções deste arquivo que são "to public") — e só pra atleta que
-- seja SEU, nunca de outro profissional (owner_id = auth.uid() no where).
create or replace function public.definir_pin_atleta(p_athlete_id uuid, p_pin text)
returns void
language plpgsql
security definer
-- "extensions" além de "public": ver comentário em register_athlete acima.
set search_path = public, extensions
as $$
begin
  if p_pin !~ '^\d{4}$' then
    raise exception 'PIN precisa ter exatamente 4 dígitos.';
  end if;

  update public.athletes
  set pin_hash = crypt(p_pin, gen_salt('bf'))
  where id = p_athlete_id and owner_id = auth.uid();
end;
$$;

grant execute on function public.definir_pin_atleta(uuid, text) to authenticated;

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
  -- owner_id vem do próprio atleta (não é um parâmetro novo) — evita
  -- depender do chamador informar o dono certo; o check-in de um atleta
  -- sempre pertence a quem já é dono dele.
  insert into public.checkins (
    athlete_id, data, modalidade, tipo, tipo_outro, minutos, distancia_km,
    tempo_min, rpe, sono_horas, fadiga, estresse, tem_dor, dor, recuperacao,
    regiao_dor, observacoes, owner_id
  ) values (
    p_athlete_id, p_data, p_modalidade, p_tipo, p_tipo_outro, p_minutos, p_distancia_km,
    p_tempo_min, p_rpe, p_sono_horas, p_fadiga, p_estresse, p_tem_dor, p_dor, p_recuperacao,
    p_regiao_dor, p_observacoes, (select owner_id from public.athletes where id = p_athlete_id)
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
