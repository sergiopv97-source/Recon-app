# Recon — Monitoramento de carga e recuperação

Site para você (fisioterapeuta/treinador) acompanhar a carga de treino e a
recuperação dos seus atletas/pacientes. Os atletas preenchem um check-in
rápido depois de cada sessão; você acompanha tudo num painel com alertas
automáticos, gráficos e histórico.

### Filosofia do projeto (não perder isso de vista)

O Recon não é sobre *controlar* a carga do atleta — é sobre, a partir da
carga, descobrir qual a melhor estratégia de recuperação pra ele. Um
gráfico bonito sem nenhuma indicação prática do que fazer é só decoração.
Por isso, qualquer número ou alerta que o app mostra (pro atleta ou pro
treinador) deve vir acompanhado de uma **recomendação de ação**, não só do
dado cru — é essa combinação (dado + o que fazer com o dado, com base em
evidência) que diferencia o Recon de painéis genéricos de monitoramento
que só coletam e exibem informação. Ao adicionar qualquer funcionalidade
nova, vale perguntar: "isso dá uma ação clara pro atleta ou pro
treinador, ou é só mais um número na tela?"

Este documento é um passo a passo **completo**, pensado pra quem nunca
publicou um site antes. Vai levar uns 30–40 minutos na primeira vez. Depois
disso, qualquer atualização é automática.

---

## 1. Como o site é organizado

- **`/checkin`** — link público que você manda pros atletas. Eles escolhem
  o nome (ou se cadastram, se for a primeira vez) e preenchem o
  questionário do dia. Não precisa de senha.
- **`/painel`** — o seu painel, com todos os atletas, alertas, gráficos,
  registro de lesões/doenças e resumo exportável. **Só você acessa**, com
  e-mail e senha.
- **`/login`** — onde você faz login pra entrar no painel.

O site guarda os dados em um banco de dados de verdade (Supabase, veja
abaixo), não mais na memória do navegador — então nada se perde.

### Como a segurança foi pensada

- O atleta, sem fazer login, só consegue: (1) ver a lista de nomes pra se
  identificar, (2) enviar o próprio check-in, e (3) ver uma orientação de
  autocuidado baseada **só no próprio** histórico. Ele nunca consegue ler
  os dados de outro atleta, nem ver lesões/doenças (isso é só seu).
- Você, logado, é o único que enxerga o cadastro completo (idade, peso,
  lesões prévias), o histórico clínico de todos e o registro de
  lesões/doenças.
- Isso já é uma evolução de segurança em relação ao protótipo original
  (lá, qualquer pessoa com acesso ao app técnicamente conseguia ver os
  dados de todo mundo). Ainda assim, como combinamos, os atletas não têm
  senha própria nesta primeira versão — é adequado pro piloto de 5 pessoas
  de confiança. Se no futuro vocês crescerem ou quiserem mais proteção por
  atleta (ex: PIN individual, login por WhatsApp), é uma evolução natural
  a partir daqui.

---

## 2. Criar o banco de dados (Supabase) — grátis

O Supabase é o serviço que guarda os dados (é como um "Excel na nuvem",
mas de verdade, seguro e com controle de acesso). O plano gratuito é mais
que suficiente pra esse piloto.

1. Acesse **https://supabase.com** e crie uma conta (dá pra usar login do
   GitHub ou e-mail/senha).
2. Clique em **"New project"**.
   - **Name**: `recon` (ou o nome que preferir)
   - **Database password**: gere uma senha forte e **guarde ela em algum
     lugar seguro** (gerenciador de senhas, por exemplo). Você não vai
     precisar dela no dia a dia, mas é bom ter guardada.
   - **Region**: escolha a mais próxima (ex: São Paulo / South America).
   - Clique em **"Create new project"** e espere uns 2 minutos enquanto ele
     é criado.
3. Quando o projeto abrir, no menu da esquerda clique em **"SQL Editor"**.
4. Clique em **"New query"**.
5. Abra o arquivo **`supabase/migrations/0001_init.sql`** deste projeto,
   copie **todo** o conteúdo, cole na caixa de texto do SQL Editor e
   clique em **"Run"** (ou Ctrl+Enter). Isso cria as tabelas e as regras de
   segurança. Deve aparecer "Success. No rows returned".
6. Ainda no menu da esquerda, clique em **"Authentication" → "Users"** e
   depois em **"Add user" → "Create new user"**. Cadastre o e-mail e a
   senha que **você** vai usar pra entrar no painel do treinador. Marque a
   opção de já confirmar o e-mail automaticamente (**"Auto Confirm
   User"**), já que você mesmo está criando essa conta.
   - Não existe cadastro público de treinador — só você (ou quem você
     autorizar) tem uma conta, criada manualmente aqui.
7. Por fim, clique em **"Project Settings" (ícone de engrenagem) → "Data
   API"**. Anote dois valores que você vai usar no próximo passo:
   - **Project URL** (algo como `https://xxxxx.supabase.co`)
   - **anon public key** (uma chave longa, começando com `eyJ...`)

Pronto, o banco de dados está criado.

---

## 3. Publicar o site (Vercel) — grátis

A Vercel é quem hospeda o site e te dá o link público.

1. Suba este projeto pro GitHub, se ainda não estiver lá (ele já está no
   repositório `sergiopv97-source/recon-app`).
2. Acesse **https://vercel.com**, crie uma conta (recomendado: entrar com
   o mesmo login do GitHub, fica mais fácil de conectar o repositório).
3. Clique em **"Add New" → "Project"** e selecione o repositório
   `recon-app`.
4. Na tela de configuração, abra **"Environment Variables"** e adicione as
   duas variáveis que você anotou no passo anterior:
   - `NEXT_PUBLIC_SUPABASE_URL` → cole o **Project URL**
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` → cole a **anon public key**
5. Clique em **"Deploy"** e espere 1–2 minutos.
6. Quando terminar, a Vercel te dá um link tipo
   `https://recon-app.vercel.app`. Esse é o endereço do seu site:
   - Mande **`https://recon-app.vercel.app/checkin`** pros atletas.
   - Use **`https://recon-app.vercel.app/login`** pra você entrar no
     painel.

### Domínio próprio (opcional)

Se você já tem ou comprar um domínio (ex: `recon.suaclinica.com.br`), em
**Project Settings → Domains** na Vercel dá pra conectar ele — é só
apontar o DNS conforme a Vercel indicar. Esse é o único custo esperado
nesta fase (o domínio em si; hospedagem e banco continuam grátis nesse
volume de uso).

### Atualizações futuras

Sempre que houver uma mudança no código (nova funcionalidade, ajuste),
basta enviar (`git push`) pro GitHub — a Vercel publica a nova versão
automaticamente, sem nenhum passo manual.

---

## 4. Rodar no seu computador (opcional, pra testar antes de publicar)

Só necessário se você quiser ver o site rodando localmente antes de
publicar, ou se for mexer no código.

```bash
npm install
cp .env.example .env.local
# edite .env.local e cole a URL e a anon key do Supabase (passo 2.7)
npm run dev
```

Depois abra `http://localhost:3000/checkin` no navegador.

---

## 5. Fórmulas e regras (não mexer sem necessidade)

Todas as fórmulas (carga sRPE, alerta de carga, índice de recuperação,
alerta clínico, monotonia/strain) estão centralizadas em **`lib/recon.ts`**
e foram trazidas exatamente como validadas no protótipo original (31/31
acertos no alerta de carga comparando com uma planilha real de torneio,
93% de acerto no alerta clínico). Se algum dia quiser reajustar algum
número, é o único arquivo que precisa mudar — todo o resto (formulário,
painel) usa essas mesmas funções.

---

## 6. O que ainda falta / próximos passos

✅ **Implementado nesta rodada** (os 3 itens combinados):

- **Aviso por e-mail em alerta vermelho** — sempre que um check-in gera um
  alerta vermelho (de carga ou clínico), o site tenta mandar um e-mail pra
  você avisando. É opcional: só liga se você configurar duas variáveis de
  ambiente na Vercel (`RESEND_API_KEY` e `TRAINER_EMAIL`) usando a
  [Resend](https://resend.com) (tem plano grátis). Passo a passo:
  1. Crie uma conta em resend.com (dá pra usar login do GitHub ou Google).
  2. No painel da Resend, vá em **"API Keys" → "Create API Key"** e copie a
     chave gerada.
  3. Na Vercel, em **Project Settings → Environment Variables**, adicione:
     - `RESEND_API_KEY` → a chave que você copiou
     - `TRAINER_EMAIL` → o e-mail que você quer receber os avisos (o mesmo
       da sua conta Resend, pra funcionar sem precisar verificar um domínio
       próprio)
  4. Redeploy o site (Vercel faz isso sozinho ao detectar a mudança, ou use
     "Redeploy" manualmente).
  Sem essas duas variáveis configuradas, o site continua funcionando
  normalmente — só não manda o e-mail.
- **Consentimento do responsável para menores de idade** — ao cadastrar um
  atleta com menos de 18 anos, o formulário agora pede nome e contato do
  responsável, e o termo de consentimento passa a ser dirigido a ele (não
  ao próprio menor), como exige a LGPD. Isso fica salvo no cadastro e
  aparece pra você no painel.
- **Mais de uma sessão por dia** — antes, um atleta só conseguia ter 1
  check-in por dia (enviar de novo sobrescrevia o anterior). Agora dá pra
  registrar mais de uma sessão no mesmo dia, desde que a modalidade ou o
  tipo sejam diferentes (ex: treino de manhã + jogo à noite). Reenviar com
  a mesma modalidade e tipo no mesmo dia continua sendo tratado como
  correção do mesmo registro. Não precisou mudar nada na tela do atleta —
  é só preencher de novo no mesmo dia com modalidade/tipo diferente.
  **Um detalhe técnico pra você saber**: a fórmula de alerta de carga
  (`lib/recon.ts`) olha pra "carga somada das últimas 3 sessões" — antes
  isso praticamente sempre eram 3 dias diferentes; com múltiplas sessões
  por dia, pode passar a somar sessões de menos dias (ex: 2 sessões de hoje
  + 1 de ontem). Isso não foi alterado agora pra não mexer numa fórmula já
  validada sem necessidade — mas se no futuro os atletas usarem
  frequentemente 2+ sessões/dia, pode valer a pena revisitar esse cálculo
  com você.

Depois de atualizar o código (`git pull` ou aguardar o deploy automático da
Vercel), rode este SQL no **Supabase SQL Editor** pra atualizar o banco que
já está em produção (é seguro rodar mesmo com dados existentes — só
adiciona o que falta, não apaga nada):

```sql
alter table public.athletes add column if not exists responsavel_nome text;
alter table public.athletes add column if not exists responsavel_contato text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'checkins_athlete_id_data_modalidade_tipo_key'
  ) then
    alter table public.checkins drop constraint if exists checkins_athlete_id_data_key;
    alter table public.checkins add constraint checkins_athlete_id_data_modalidade_tipo_key unique (athlete_id, data, modalidade, tipo);
  end if;
end $$;

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
```

**Combinado pra próxima etapa** (discutido e adiado de propósito, não
esquecido):

- **Lembrete automático de check-in** — dá pra fazer sem custo nenhum
  usando notificação push do navegador (funciona até no iPhone, desde que
  o atleta "instale" o site na tela inicial). Não dá pra cronometrar
  exatamente "1h-1h30 pós-sessão" (o site só sabe que houve sessão quando o
  atleta preenche o check-in), mas dá pra mandar um aviso em horário(s)
  fixo(s) do dia pra quem ainda não preencheu — usando a mesma lista que já
  aparece no painel ("Check-in de hoje"). Envolve configurar um app
  instalável (PWA) + um aviso agendado (cron) — é mais trabalhoso que o
  resto, por isso ficou pra depois.
- **PIN pessoal por atleta** — hoje qualquer um pode preencher em nome de
  outro atleta (não tem verificação de identidade real, só o nome). Um
  código de 4 dígitos por atleta resolveria isso.
- **Leitura automática de print de treino via IA** (Strava, Garmin Connect,
  Apple Health/Fitness etc.) — o atleta anexa um print, a IA lê os números
  (duração, distância...) e pré-preenche o formulário pra ele conferir e
  confirmar. Mais viável que integrar a API oficial do Strava (funciona com
  qualquer app, não só Strava), mas tem custo pequeno por imagem processada
  (menos de 1 centavo de dólar por print) — precisa de uma conta na
  Anthropic com cobrança ativada.
- **Estresse percebido** ainda é só coletado, não entra nas fórmulas de
  alerta (assim como no protótipo original) — pendência antiga do briefing,
  nunca chegou a ser decidido como incorporar.

✅ **Já implementado além do briefing original** (pedidos durante o uso):
- Termo de consentimento LGPD (tela de aceite + registro da data, aplicado
  também no banco de dados) — texto em `lib/consentimento.ts`
- Check-in em etapas (nome → cadastro/termo → questionário), com busca de
  nome já cadastrado
- Atleta lembrado no aparelho dele (não precisa digitar o nome de novo)
- Atleta vê o próprio histórico em gráfico ("Ver meu histórico")
- Comparativo "sua carga nessa sessão está X% acima/abaixo da sua média"
- "Recado do treinador" — mural direcionável (um atleta específico ou
  todos), visível na tela de check-in
- Painel: "quem ainda não fez check-in hoje", editar/apagar atleta
- RLS reforçado: cadastro/check-in sem login só passam pelas funções
  `register_athlete`/`submit_checkin` (não dá pra pular o aceite do termo
  indo direto na API)

---

## 7. Estrutura do projeto (referência técnica)

```
lib/recon.ts              → todas as fórmulas (fonte única da verdade)
lib/db-types.ts           → conversão entre banco de dados e as fórmulas
lib/supabase/             → conexão com o Supabase (navegador e servidor)
lib/ui.tsx                → estilos visuais compartilhados
components/CheckinForm.tsx→ formulário de check-in do atleta
components/PainelClient.tsx → painel do treinador
app/checkin, app/login, app/painel → páginas do site
supabase/migrations/0001_init.sql → schema do banco + regras de segurança
proxy.ts                  → protege o /painel, exige login
```
