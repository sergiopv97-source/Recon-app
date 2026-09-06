// ---------------------------------------------------------------------------
// Recon — regras de negócio (fórmulas de carga e recuperação)
//
// Este arquivo é a ÚNICA fonte da verdade para as fórmulas do Recon. Elas
// foram validadas no protótipo original (31/31 acertos no alerta de carga,
// 93% de acerto no alerta clínico, comparando com uma planilha real usada
// em torneio). NÃO altere os números/condições abaixo sem necessidade real
// — veja o briefing do projeto para o histórico de validação.
// ---------------------------------------------------------------------------

export const MODALIDADES = [
  "Futsal",
  "Futebol",
  "Vôlei",
  "Pádel",
  "CrossFit",
  "Musculação",
  "Corrida",
  "Bike",
  "Artes Marciais",
] as const;

export type Modalidade = (typeof MODALIDADES)[number];

// "duracao": informa minutos jogados/treinados. "distancia": informa km + tempo (calcula pace).
export const MODALIDADE_INPUT: Record<Modalidade, "duracao" | "distancia"> = {
  Futsal: "duracao",
  Futebol: "duracao",
  Vôlei: "duracao",
  Pádel: "duracao",
  CrossFit: "duracao",
  Musculação: "duracao",
  Corrida: "distancia",
  Bike: "distancia",
  "Artes Marciais": "duracao",
};

export const DURACAO_LABEL: Partial<Record<Modalidade, string>> = {
  Futsal: "Minutos jogados",
  Futebol: "Minutos jogados",
  Vôlei: "Minutos jogados",
  Pádel: "Minutos jogados",
  CrossFit: "Duração da sessão (min)",
  Musculação: "Duração do treino (min)",
  "Artes Marciais": "Minutos de treino/luta",
};

export const TIPOS_POR_MODALIDADE: Record<Modalidade, string[]> = {
  Futsal: ["Jogo", "Treino", "Outro", "Descanso", "Viagem"],
  Futebol: ["Jogo", "Treino", "Outro", "Descanso", "Viagem"],
  Vôlei: ["Jogo", "Treino", "Outro", "Descanso", "Viagem"],
  Pádel: ["Jogo", "Treino", "Outro", "Descanso", "Viagem"],
  CrossFit: ["WOD", "Treino", "Outro", "Descanso", "Viagem"],
  Musculação: ["Treino", "Outro", "Descanso", "Viagem"],
  Corrida: ["Prova", "Treino", "Outro", "Descanso", "Viagem"],
  Bike: ["Prova", "Treino", "Outro", "Descanso", "Viagem"],
  // "Luta" cobre competição (torneio, sparring valendo) — equivalente ao
  // "Jogo" dos esportes de quadra/campo, pra fins de cálculo de carga.
  "Artes Marciais": ["Luta", "Treino", "Outro", "Descanso", "Viagem"],
};

export const TIPOS_COM_CARGA = ["Jogo", "Prova", "WOD", "Treino", "Outro", "Luta"];

export const MODALIDADE_CATEGORIA: Record<Modalidade, "impacto" | "funcional" | "endurance"> = {
  Futsal: "impacto",
  Futebol: "impacto",
  Vôlei: "impacto",
  Pádel: "impacto",
  CrossFit: "funcional",
  Musculação: "funcional",
  Corrida: "endurance",
  Bike: "endurance",
  // Categorizado como "impacto" (mesmo grupo dos esportes de quadra/campo):
  // sem objetivo de hipertrofia como treino de força, então crioterapia
  // pós-sessão não tem o mesmo conflito de adaptação que em Musculação/
  // CrossFit — e o padrão intermitente de esforço se parece mais com jogo
  // de quadra do que com treino de força contínuo.
  "Artes Marciais": "impacto",
};

export type Tone = "ok" | "warn" | "danger";

export interface Alerta {
  label: string;
  tone: Tone;
}

export const toneColor: Record<Tone, string> = {
  ok: "#2F7D52",
  warn: "#B9812E",
  danger: "#B23A32",
};

// Formato "bruto" de um check-in, como preenchido no formulário / vindo do banco.
export interface CheckinInput {
  id?: string;
  atleta: string;
  data: string; // ISO yyyy-mm-dd
  modalidade: Modalidade;
  tipo: string;
  tipoOutro?: string | null;
  minutos?: number | string | null;
  distanciaKm?: number | string | null;
  tempoMin?: number | string | null;
  rpe: number;
  sonoHoras: number;
  fadiga: number;
  estresse: number;
  temDor: boolean;
  dor: number;
  recuperacao: number;
  regiaoDor?: string | null;
  observacoes?: string | null;
}

// Check-in já com os campos calculados (carga, alertas etc).
export interface CheckinComputed extends CheckinInput {
  diaSemana: string;
  carga: number;
  variacao: number | null;
  carga3dias: number;
  indice: number | null;
  alertaCarga: Alerta | null;
  alertaClinico: Alerta | null;
  alertaIndividual: Alerta | null;
}

export interface Lesao {
  id?: string;
  atleta: string;
  tipoRegistro: "Lesão" | "Doença";
  descricao: string;
  gravidade: "Leve" | "Moderada" | "Grave";
  afastamentoDias?: number | string | null;
  data: string;
  alertaCargaNoMomento?: string | null;
  alertaClinicoNoMomento?: string | null;
}

const DIAS_SEMANA_ABREV = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DIAS_SEMANA_NOMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function diaSemanaDe(dataISO: string): string {
  if (!dataISO) return "";
  return DIAS_SEMANA_NOMES[new Date(dataISO + "T12:00:00").getDay()];
}

export function ordemChave(e: { data: string }): number {
  return new Date(e.data + "T12:00:00").getTime();
}

export function proximaData(dataISO: string): string {
  const d = new Date(dataISO + "T12:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function diaAnterior(dataISO: string): string {
  const d = new Date(dataISO + "T12:00:00");
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Sequência de dias corridos com pelo menos um check-in, contando pra trás
// a partir de hoje. Se hoje ainda não foi preenchido, começa a contar de
// ontem — não zera a sequência só porque o dia ainda não acabou.
export function sequenciaCheckins(datas: string[], hojeISO: string): number {
  const unicas = new Set(datas);
  let cursor = unicas.has(hojeISO) ? hojeISO : diaAnterior(hojeISO);
  let streak = 0;
  while (unicas.has(cursor)) {
    streak++;
    cursor = diaAnterior(cursor);
  }
  return streak;
}

// início (segunda-feira) da semana calendário que contém essa data — usado
// pra agrupar corretamente em monotonia/strain
export function inicioSemana(dataISO: string): string {
  const d = new Date(dataISO + "T12:00:00");
  const dow = d.getDay();
  const diff = dow === 0 ? 6 : dow - 1;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

export function rotuloPeriodo(e: { data: string }): string {
  const d = new Date(e.data + "T12:00:00");
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  return `${dia}/${mes} ${DIAS_SEMANA_ABREV[d.getDay()]}`;
}

export function formatarDataCurta(dataISO: string): string {
  const d = new Date(dataISO + "T12:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

// Converte texto digitado num número aceitando vírgula OU ponto como
// separador decimal. Necessário porque teclado em português usa vírgula
// (ex: "30,07"), mas Number()/parseFloat() nativos só entendem ponto —
// sem isso, "30,07" virava 30 (parseFloat) ou NaN (Number), silenciosamente.
export function numeroBr(v: string | number | null | undefined): number {
  if (v === null || v === undefined || v === "") return NaN;
  if (typeof v === "number") return v;
  return parseFloat(v.trim().replace(",", "."));
}

export function horasParaEscalaSono(horas: number | string): number {
  const h = numeroBr(horas);
  if (!h) return 3;
  if (h < 6) return 1;
  if (h < 7) return 2;
  if (h < 8) return 3;
  if (h < 9) return 4;
  return 5;
}

export function minutosEfetivos(e: CheckinInput): number {
  if (MODALIDADE_INPUT[e.modalidade] === "distancia") return numeroBr(e.tempoMin) || 0;
  return numeroBr(e.minutos) || 0;
}

export function paceMinKm(e: { distanciaKm?: number | string | null; tempoMin?: number | string | null }): string | null {
  const dist = numeroBr(e.distanciaKm);
  const tempo = numeroBr(e.tempoMin);
  if (!dist || !tempo) return null;
  const pace = tempo / dist;
  const min = Math.floor(pace);
  const seg = Math.round((pace - min) * 60);
  return `${min}:${String(seg).padStart(2, "0")}/km`;
}

export function cargaSRPE(entry: CheckinInput): number {
  if (entry.tipo === "Descanso" || entry.tipo === "Viagem") return 0;
  const m = minutosEfetivos(entry);
  const rpe = entry.rpe;
  if (!m || !rpe) return 0;
  return Math.round(m * rpe);
}

export function indiceRecuperacao(sono: number, fadiga: number, dor: number, recuperacao: number): number {
  return (sono - fadiga + (recuperacao - dor / 2)) / 2;
}

// entries: ordenados por data asc, de UM atleta só
export function computeSeries(entries: CheckinInput[]): CheckinComputed[] {
  return entries.map((e, i) => {
    const carga = cargaSRPE(e);
    const prevCarga = i > 0 ? cargaSRPE(entries[i - 1]) : null;
    const variacao = prevCarga ? ((carga - prevCarga) / prevCarga) * 100 : null;
    const janela = entries.slice(Math.max(0, i - 2), i + 1);
    const carga3dias = janela.reduce((s, x) => s + cargaSRPE(x), 0);
    const indice = TIPOS_COM_CARGA.includes(e.tipo)
      ? indiceRecuperacao(Number(horasParaEscalaSono(e.sonoHoras)), Number(e.fadiga), Number(e.dor), Number(e.recuperacao))
      : null;

    let alertaCarga: Alerta | null = null;
    if (carga > 0) {
      // fórmula exata da planilha: =SE(G="";"";SE(E(N>=600;O>=0,2);vermelho;SE(OU(N>=500;O>=0,1);amarelo;verde)))
      // quando não há dia anterior (O vazio), a comparação de texto do Sheets torna a condição OU verdadeira
      const varFrac = variacao === null ? null : variacao / 100;
      if (carga3dias >= 600 && varFrac !== null && varFrac >= 0.2) {
        alertaCarga = { label: "Aumento importante", tone: "danger" };
      } else if (carga3dias >= 500 || varFrac === null || varFrac >= 0.1) {
        alertaCarga = { label: "Atenção", tone: "warn" };
      } else {
        alertaCarga = { label: "Carga controlada", tone: "ok" };
      }
    }

    let alertaClinico: Alerta | null = null;
    if (TIPOS_COM_CARGA.includes(e.tipo) && indice !== null) {
      // fórmula calibrada com os dados reais do torneio (93% de acerto):
      // score = índice de recuperação penalizado pela dor relatada (peso 0.3)
      const score = indice - 0.3 * Number(e.dor);
      if (score < -0.25) {
        alertaClinico = { label: "Baixa recuperação / sintoma", tone: "danger" };
      } else if (score < 1.9) {
        alertaClinico = { label: "Monitorar", tone: "warn" };
      } else {
        alertaClinico = { label: "Sem alerta clínico", tone: "ok" };
      }
    }

    // linha de base individual (complementar, não substitui os alertas acima):
    // compara o índice de hoje com a média/desvio-padrão dos últimos check-ins do
    // PRÓPRIO atleta (janela de até 12 registros anteriores), via z-score.
    // só ativa com pelo menos 5 registros anteriores.
    let alertaIndividual: Alerta | null = null;
    if (TIPOS_COM_CARGA.includes(e.tipo) && indice !== null) {
      const historico = entries
        .slice(0, i)
        .filter((x) => TIPOS_COM_CARGA.includes(x.tipo))
        .map((x) => indiceRecuperacao(Number(horasParaEscalaSono(x.sonoHoras)), Number(x.fadiga), Number(x.dor), Number(x.recuperacao)));
      const janelaBase = historico.slice(-12);
      if (janelaBase.length >= 5) {
        const media = janelaBase.reduce((s, v) => s + v, 0) / janelaBase.length;
        const variancia = janelaBase.reduce((s, v) => s + (v - media) ** 2, 0) / janelaBase.length;
        const dp = Math.sqrt(variancia);
        const z = dp > 0 ? (indice - media) / dp : 0;
        if (z <= -1.5) {
          alertaIndividual = { label: "Bem abaixo do seu normal", tone: "danger" };
        } else if (z <= -1.0) {
          alertaIndividual = { label: "Levemente abaixo do seu normal", tone: "warn" };
        } else {
          alertaIndividual = { label: "Dentro do seu padrão", tone: "ok" };
        }
      }
    }

    return {
      ...e,
      diaSemana: diaSemanaDe(e.data),
      carga,
      variacao,
      carga3dias,
      indice,
      alertaCarga,
      alertaClinico,
      alertaIndividual,
    };
  });
}

export interface OcorrenciaDor {
  data: string;
  regiaoDor: string;
}
export interface AlertaDorRecorrente {
  termo: string;
  ocorrencias: OcorrenciaDor[];
}

// Palavras comuns demais pra servir de "pista" de região do corpo (evita
// falso positivo tipo "de", "com", "leve" aparecendo 3x e sendo confundido
// com um padrão real).
const STOPWORDS_DOR = new Set([
  "de", "da", "do", "das", "dos", "em", "no", "na", "nos", "nas", "ao", "aos",
  "um", "uma", "uns", "umas", "com", "sem", "leve", "leves", "forte", "fortes",
  "pouco", "pouca", "muito", "muita", "dor", "dores", "doi", "dói", "doendo",
  "incomoda", "incomodo", "incômodo", "sinto", "sentindo", "sente", "quando",
  "que", "mais", "menos", "ainda", "depois", "durante", "após",
]);

function normalizarPalavraDor(w: string): string {
  return w
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z]/g, "");
}

// Detecta região de dor mencionada 3+ vezes (por padrão) numa janela recente
// (por padrão, últimos 21 dias) — sinal clássico de lesão em formação que é
// fácil de passar despercebido olhando check-in por check-in isoladamente.
// É uma checagem de TEXTO simples, não um diagnóstico: serve pra chamar sua
// atenção pra conferir os registros, não pra substituir avaliação clínica.
export function detectarDorRecorrente(
  entries: CheckinInput[],
  janelaDias = 21,
  minOcorrencias = 3
): AlertaDorRecorrente[] {
  const comDor = entries.filter((e) => e.temDor && e.regiaoDor && e.regiaoDor.trim());
  if (comDor.length === 0) return [];

  const maisRecente = comDor.reduce((max, e) => (e.data > max ? e.data : max), comDor[0].data);
  const limiteISO = diaAnteriorN(maisRecente, janelaDias);

  const porPalavra: Record<string, OcorrenciaDor[]> = {};
  comDor
    .filter((e) => e.data >= limiteISO)
    .forEach((e) => {
      const palavras = new Set(
        (e.regiaoDor || "")
          .split(/\s+/)
          .map(normalizarPalavraDor)
          .filter((w) => w.length >= 4 && !STOPWORDS_DOR.has(w))
      );
      palavras.forEach((p) => {
        if (!porPalavra[p]) porPalavra[p] = [];
        porPalavra[p].push({ data: e.data, regiaoDor: e.regiaoDor! });
      });
    });

  return Object.entries(porPalavra)
    .filter(([, ocorrencias]) => new Set(ocorrencias.map((o) => o.data)).size >= minOcorrencias)
    .map(([termo, ocorrencias]) => ({
      termo,
      ocorrencias: ocorrencias.sort((a, b) => a.data.localeCompare(b.data)),
    }))
    .sort((a, b) => b.ocorrencias.length - a.ocorrencias.length);
}

function diaAnteriorN(dataISO: string, n: number): string {
  const d = new Date(dataISO + "T12:00:00");
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export interface SemanaMS {
  inicio: string;
  cargaTotal: number;
  monotonia: number | null;
  strain: number | null;
  alerta: Alerta | null;
}

// ---------- monotonia e strain (Foster, 1998) ----------
// agrupa os registros por semana de calendário real (segunda a domingo) e calcula:
// monotonia = carga média diária / desvio-padrão diário
// strain = carga total da semana × monotonia
// monotonia alta (>2) combinada com carga alta é associada a mais doença/overtraining na literatura
export function computeMonotoniaStrain(entriesDoAtleta: CheckinInput[]): SemanaMS[] {
  const porData: Record<string, number> = {};
  entriesDoAtleta
    .filter((e) => TIPOS_COM_CARGA.includes(e.tipo))
    .forEach((e) => {
      porData[e.data] = (porData[e.data] || 0) + cargaSRPE(e);
    });

  const inicios = Array.from(new Set(Object.keys(porData).map(inicioSemana))).sort();

  return inicios.map((inicio) => {
    const cargas: number[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(inicio + "T12:00:00");
      d.setDate(d.getDate() + i);
      cargas.push(porData[d.toISOString().slice(0, 10)] || 0);
    }
    const cargaTotal = cargas.reduce((a, b) => a + b, 0);
    const media = cargaTotal / 7;
    const variancia = cargas.reduce((acc, v) => acc + (v - media) ** 2, 0) / 7;
    const dp = Math.sqrt(variancia);
    const monotonia = dp > 0 ? media / dp : null;
    const strain = monotonia !== null ? cargaTotal * monotonia : null;
    let alerta: Alerta | null = null;
    if (monotonia !== null) {
      if (monotonia > 2) alerta = { label: "Monotonia alta", tone: "warn" };
      else if (monotonia >= 1.5) alerta = { label: "Atenção à monotonia", tone: "warn" };
      else alerta = { label: "Variação saudável", tone: "ok" };
    }
    return { inicio, cargaTotal, monotonia, strain, alerta };
  });
}

export function riscoGeral(serie: CheckinComputed[]): Alerta | null {
  if (!serie.length) return null;
  const ultimo = serie[serie.length - 1];
  const ms = computeMonotoniaStrain(serie);
  const ultimaMS = ms[ms.length - 1];
  const tones = [ultimo.alertaCarga?.tone, ultimo.alertaClinico?.tone, ultimo.alertaIndividual?.tone, ultimaMS?.alerta?.tone].filter(
    Boolean,
  );
  if (tones.includes("danger")) return { label: "Risco alto", tone: "danger" };
  if (tones.includes("warn")) return { label: "Risco moderado", tone: "warn" };
  if (tones.length) return { label: "Risco baixo", tone: "ok" };
  return null;
}

export interface RecomendacaoItem {
  texto: string;
  publico: "todos" | "terapeutico";
}
export interface Recomendacao {
  titulo: string;
  itens: RecomendacaoItem[];
}

// ---------- recomendações de recovery baseadas em evidência ----------
// cada item é marcado como "todos" (autocuidado, pode aparecer pro atleta) ou
// "terapeutico" (recurso clínico/terapêutico — só aparece pro treinador)
//
// Revisado em set/2026 a partir de revisões sistemáticas e meta-análises
// atuais (não é uma curadoria pessoal nem "média de artigos" — são as
// conclusões de trabalhos publicados, citados abaixo). Principais fontes:
// - Sono: Cureus/PMC 2025-26, revisões sobre sono e risco de lesão/desempenho
//   em atletas (perda de sono associada a até 2x mais risco de lesão).
// - Crioterapia pós treino de força: Piñero et al. 2024, European Journal of
//   Sport Science — meta-análise mostrando que gelo logo após treino de
//   força atenua ganho de força/hipertrofia. Por isso NÃO é recomendada pra
//   "Musculação"/"CrossFit" (categoria "funcional") como recovery de rotina.
// - Crioterapia em esforço prolongado/jogos: Cochrane CD008262 e
//   Sports Medicine 2022 (Moore et al.) — reduz dor percebida e apoia
//   desempenho em janelas curtas entre competições, sem o mesmo conflito
//   com adaptação (o objetivo ali não é hipertrofia).
// - Massagem: Frontiers in Physiology 2017 (Guo et al.), meta-análise — uma
//   das intervenções com maior efeito medido pra dor muscular tardia.
// - Compressão (roupa elástica): Sports Medicine 2017 (Marqués-Jiménez et
//   al.) e revisões mais recentes — efeito moderado, mais consistente em
//   recuperação de força a partir de 24h.
// - Bota de compressão pneumática (IPC — equipamento com compressores de
//   ar, ex: NormaTec): é um recurso DIFERENTE da roupa de compressão acima
//   (não é a mesma coisa, tem estudos próprios). Meta-análise de 2024
//   (Frontiers in Physiology, 17 estudos/319 atletas) encontrou efeito
//   pequeno a moderado na dor muscular percebida (o mais consistente, com
//   pico ~48h depois) e efeito pequeno a trivial em força/potência no dia
//   seguinte. Não é milagroso, mas é um recurso legítimo — por isso listado
//   separado da roupa de compressão, não junto.
// - Alongamento pra dor muscular: Cochrane (Herbert 2011) — sem efeito
//   clinicamente relevante. Por isso o app não promete alívio de dor via
//   alongamento, só benefício geral de mobilidade.
// - Recovery ativo: evidência mista/dependente do contexto (alguns estudos
//   favorecem passivo pra desempenho de curto prazo, outros favorecem ativo
//   pra remoção de lactato) — mantido como sugestão de baixo risco, não como
//   benefício garantido.
// - Fotobiomodulação (luz vermelha ~660nm / infravermelho próximo ~850nm):
//   diferente de tudo acima, a evidência mais forte é pra aplicação ANTES do
//   esforço (não depois) — revisão sistemática de 2025 encontrou redução de
//   fadiga e de dor muscular 24h depois quando aplicada pré-treino; outra
//   revisão de 2025 (14 estudos) encontrou redução de dor muscular tardia
//   também no uso pós-treino; meta-análise de 2024 associou a queda de até
//   40% em marcadores inflamatórios (PCR, IL-6). Por isso essa recomendação
//   aparece como "usar antes da próxima sessão intensa", não "logo após
//   esta sessão". RESSALVA IMPORTANTE: a literatura tem heterogeneidade
//   grande de protocolo (comprimento de onda, potência, tempo de aplicação)
//   sem padrão estabelecido — o resultado depende muito do aparelho
//   específico, não é "ter luz vermelha" genérico.
export function recomendacoes(modalidade: Modalidade, alertaCarga: Alerta | null, alertaClinico: Alerta | null): Recomendacao[] {
  const categoria = MODALIDADE_CATEGORIA[modalidade] || "impacto";
  const recs: Recomendacao[] = [];
  if (alertaCarga?.tone === "danger") {
    if (categoria === "endurance") {
      recs.push({
        titulo: "Carga aguda muito acima do habitual (prova/treino longo)",
        itens: [
          { texto: "Priorizar sono nas próximas noites — é o fator isolado mais associado a queda de desempenho e maior risco de lesão", publico: "todos" },
          { texto: "Reforçar hidratação e reposição de carboidratos nas horas seguintes", publico: "todos" },
          { texto: "Evitar novo estímulo intenso nas próximas 24h — descanso ou caminhada bem leve", publico: "todos" },
          {
            texto: "Crioterapia (banho de gelo, 10–15 min) — reduz dor/fadiga percebida em esforço prolongado de corpo inteiro (Cochrane CD008262; Sports Medicine 2022)",
            publico: "terapeutico",
          },
          { texto: "Massagem tem efeito parecido ao banho de gelo na percepção de dor e fadiga (meta-análise, Frontiers in Physiology 2017)", publico: "terapeutico" },
          {
            texto:
              "Fotobiomodulação (luz vermelha/infravermelho) antes da próxima sessão intensa — evidência de 2025 aponta redução de fadiga e dor subsequente quando aplicada pré-treino; combina bem com massagem. Resultado depende do aparelho específico (sem protocolo padrão na literatura).",
            publico: "terapeutico",
          },
        ],
      });
    } else if (categoria === "funcional") {
      // CrossFit/Musculação: aqui o objetivo geralmente é ganho de força ou
      // hipertrofia, então crioterapia de rotina é contraindicada logo após
      // a sessão (ver nota de evidência no comentário acima da função).
      recs.push({
        titulo: "Carga aguda muito acima do habitual (treino de força/potência)",
        itens: [
          { texto: "Reduzir volume ou intensidade da próxima sessão de força", publico: "todos" },
          { texto: "Priorizar sono — é quando ocorre boa parte da recuperação neuromuscular", publico: "todos" },
          {
            texto:
              "Evitar gelo/crioterapia nas horas seguintes se o objetivo for ganho de força/hipertrofia — meta-análise recente (Piñero et al. 2024) mostra que gelo logo após treino de força atenua a adaptação. Reservar crioterapia pra dias de competição, não pra rotina de treino de base.",
            publico: "terapeutico",
          },
          {
            texto: "Compressão (roupa elástica) — evidência mais consistente aqui do que em outras modalidades: benefício moderado na recuperação de força a partir de 24h (Sports Medicine 2017)",
            publico: "terapeutico",
          },
          {
            texto: "Bota de compressão pneumática — efeito pequeno a moderado na dor muscular percebida, pico por volta de 48h; pouco efeito em força/potência (meta-análise 2024, Frontiers in Physiology)",
            publico: "terapeutico",
          },
          { texto: "Massagem segue com bom suporte de evidência pra reduzir dor muscular percebida (Frontiers in Physiology 2017)", publico: "terapeutico" },
          {
            texto:
              "Fotobiomodulação (luz vermelha/infravermelho) antes da próxima sessão de força — evidência de 2025 aponta redução de fadiga e dor subsequente quando aplicada pré-treino. Resultado depende do aparelho específico (sem protocolo padrão na literatura).",
            publico: "terapeutico",
          },
        ],
      });
    } else {
      recs.push({
        titulo: "Carga aguda muito acima do habitual",
        itens: [
          { texto: "Reduzir ou diminuir a intensidade da próxima sessão", publico: "todos" },
          { texto: "Priorizar sono — é onde a maior parte da recuperação física acontece", publico: "todos" },
          {
            texto: "Crioterapia (imersão em água fria) nas primeiras 24–48h — ajuda a chegar melhor pro próximo jogo quando a competição é próxima (Cochrane CD008262)",
            publico: "terapeutico",
          },
          { texto: "Compressão (roupa elástica) pode ajudar a recuperação, com efeito moderado (Sports Medicine 2017)", publico: "terapeutico" },
          {
            texto: "Bota de compressão pneumática — efeito pequeno a moderado na dor muscular percebida, pico por volta de 48h (meta-análise 2024, Frontiers in Physiology)",
            publico: "terapeutico",
          },
          {
            texto:
              "Fotobiomodulação (luz vermelha/infravermelho) antes do próximo jogo/treino intenso — evidência de 2025 aponta redução de fadiga e dor subsequente quando aplicada pré-treino; combina bem com massagem ou bota de compressão. Resultado depende do aparelho específico (sem protocolo padrão na literatura).",
            publico: "terapeutico",
          },
        ],
      });
    }
  } else if (alertaCarga?.tone === "warn") {
    recs.push({
      titulo: "Carga em elevação — monitorar",
      itens:
        categoria === "endurance"
          ? [
              { texto: "Caminhada leve e mobilidade, sem novo estímulo intenso", publico: "todos" },
              { texto: "Atenção a sono e reidratação nas próximas 24h", publico: "todos" },
            ]
          : [
              { texto: "Movimento leve (mobilidade, aeróbico bem baixo) — evidência de recovery ativo é mista, mas sem contraindicação nessa intensidade", publico: "todos" },
              { texto: "Atenção a sono e hidratação nas próximas 24h", publico: "todos" },
            ],
    });
  }
  if (alertaClinico?.tone === "danger") {
    recs.push({
      titulo: "Dor alta / baixa recuperação percebida",
      itens: [
        { texto: "Evitar novo estímulo de alta carga até a dor reduzir", publico: "todos" },
        { texto: "Avisar o fisioterapeuta antes da próxima sessão intensa", publico: "todos" },
        { texto: "Compressão (roupa elástica) pode reduzir a percepção de dor muscular, com efeito moderado a bom (Sports Medicine 2017)", publico: "terapeutico" },
        {
          texto: "Bota de compressão pneumática — efeito pequeno a moderado na dor muscular percebida, que é justamente o sintoma aqui (meta-análise 2024, Frontiers in Physiology)",
          publico: "terapeutico",
        },
        { texto: "Massagem está entre as intervenções com maior efeito medido pra dor muscular (Frontiers in Physiology 2017)", publico: "terapeutico" },
        {
          texto:
            "Fotobiomodulação (luz vermelha/infravermelho) antes da próxima sessão intensa — revisão de 2025 (14 estudos) encontrou redução de dor muscular tardia; combina bem com massagem ou bota de compressão. Resultado depende do aparelho específico (sem protocolo padrão na literatura).",
          publico: "terapeutico",
        },
      ],
    });
  } else if (alertaClinico?.tone === "warn") {
    recs.push({
      titulo: "Sinais de fadiga/dor leve — monitorar",
      itens: [
        {
          texto: "Mobilidade ativa leve — o alongamento estático isolado tem pouca evidência de reduzir dor muscular (Cochrane), mas movimento leve ajuda no conforto geral",
          publico: "todos",
        },
        { texto: "Reforçar higiene do sono", publico: "todos" },
      ],
    });
  }
  return recs;
}
