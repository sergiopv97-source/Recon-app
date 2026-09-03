# Recon — Monitoramento de carga e recuperação

Site para você (fisioterapeuta/treinador) acompanhar a carga de treino e a
recuperação dos seus atletas/pacientes. Os atletas preenchem um check-in
rápido depois de cada sessão; você acompanha tudo num painel com alertas
automáticos, gráficos e histórico.

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

Vindo direto do briefing original — ainda não estão nesta versão:

- **Login por WhatsApp/link mágico pros atletas** — evolução futura, não
  necessária pro piloto atual (hoje é só escolher o nome na lista).
- **Importação automática do Strava / apps de treino via IA** — precisa de
  integração com a API do Strava (ou upload manual de arquivo pra leitura
  por IA). Dá pra planejar como próxima etapa.
- **Lembrete automático por WhatsApp** pra preencher o RPE 1h–1h30 após a
  sessão (hoje é só um aviso fixo na tela).
- **Estresse percebido** ainda é só coletado, não entra nas fórmulas de
  alerta (assim como no protótipo original).
- **Termo de consentimento LGPD** — o texto já existe (arquivo separado no
  briefing); falta incorporar como uma tela de aceite no cadastro do
  atleta.

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
