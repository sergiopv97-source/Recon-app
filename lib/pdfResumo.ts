// Gera o relatório do atleta em PDF, com a identidade visual do Recon
// (cor da marca, marca d'água, gráfico) em vez do antigo resumo em .txt
// puro. Roda inteiramente no navegador (biblioteca jsPDF), sem precisar de
// nenhum servidor — mesmo espírito do resto do app (hospedagem gratuita).
//
// Esse arquivo só desenha o PDF; os cálculos (carga, alertas, monotonia,
// recomendações) continuam vindo de lib/recon.ts — fonte única da verdade.
import { jsPDF } from "jspdf";
import {
  computeMonotoniaStrain,
  riscoGeral,
  recomendacoes,
  formatarDataCurta,
  rotuloPeriodo,
  MODALIDADE_INPUT,
  paceMinKm,
  type CheckinComputed,
  type Modalidade,
} from "@/lib/recon";
import type { AthleteRow, InjuryRow } from "@/lib/db-types";

const TEAL = "#297379";
const TEXT = "#14201F";
const MUTED = "#5B6664";
const BORDER = "#DCE3E1";
const TONE_COR: Record<"ok" | "warn" | "danger", string> = {
  ok: "#2F7D52",
  warn: "#B9812E",
  danger: "#B23A32",
};

export interface DadosResumoPdf {
  atleta: AthleteRow;
  serie: CheckinComputed[];
  lesoes: InjuryRow[];
  logoBase64?: string | null;
}

// Carrega a logo (public/logo.png) e converte pra base64, formato que o
// jsPDF precisa pra desenhar imagem. Se falhar por qualquer motivo (ex:
// bloqueio de rede), o PDF ainda é gerado, só sem a marca d'água.
export async function carregarLogoBase64(): Promise<string | null> {
  try {
    const resp = await fetch("/logo.png");
    const blob = await resp.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function gerarResumoPdf({ atleta, serie, lesoes, logoBase64 }: DadosResumoPdf): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 16;
  const rodapeY = pageHeight - 12;

  function novaPaginaSeNecessario(yAtual: number, espacoNecessario: number): number {
    if (yAtual + espacoNecessario <= rodapeY) return yAtual;
    desenharRodape();
    doc.addPage();
    desenharMarcaDagua();
    return 20;
  }

  function desenharMarcaDagua() {
    if (!logoBase64) return;
    try {
      doc.saveGraphicsState();
      // @ts-expect-error -- GState não está nos tipos do jsPDF, mas existe em runtime
      doc.setGState(new doc.GState({ opacity: 0.055 }));
      const wm = 110;
      doc.addImage(logoBase64, "PNG", (pageWidth - wm) / 2, (pageHeight - wm) / 2, wm, wm * (148 / 120));
      doc.restoreGraphicsState();
    } catch {
      // se a imagem não carregar por qualquer motivo, segue sem marca d'água
    }
  }

  function desenharRodape() {
    doc.setDrawColor(BORDER);
    doc.line(marginX, rodapeY, pageWidth - marginX, rodapeY);
    doc.setFontSize(8);
    doc.setTextColor(MUTED);
    doc.setFont("helvetica", "normal");
    doc.text("Recon — Sergio Vargas, Fisioterapeuta · (55) 99620-6746 · sergiopv97@gmail.com", marginX, rodapeY + 5);
    doc.text("Documento de uso clínico — contém dados de saúde protegidos pela LGPD.", marginX, rodapeY + 9);
  }

  desenharMarcaDagua();

  // ---------- cabeçalho ----------
  doc.setFillColor(TEAL);
  doc.rect(0, 0, pageWidth, 26, "F");
  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("RECON", marginX, 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text("Sergio Vargas — Fisioterapeuta · Santa Maria/RS", marginX, 20);
  doc.setFontSize(8.5);
  doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, pageWidth - marginX, 20, { align: "right" });

  let y = 38;

  // ---------- dados do atleta ----------
  doc.setTextColor(TEXT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(atleta.nome, marginX, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED);
  const dadosCadastro = [atleta.idade && `${atleta.idade} anos`, atleta.peso && `${atleta.peso}kg`, atleta.altura && `${atleta.altura}cm`, atleta.posicao]
    .filter(Boolean)
    .join("  ·  ");
  if (dadosCadastro) {
    doc.text(dadosCadastro, marginX, y);
    y += 6;
  }
  doc.text(`Lesões prévias (cadastro): ${atleta.historico_lesoes || "nenhuma informada"}`, marginX, y);
  y += 7;

  const risco = riscoGeral(serie);
  const ultimo = serie[serie.length - 1];
  if (risco) {
    const cor = TONE_COR[risco.tone];
    doc.setFillColor(cor);
    doc.roundedRect(marginX, y - 5, 62, 8, 2, 2, "F");
    doc.setTextColor("#FFFFFF");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`RISCO GERAL: ${risco.label.toUpperCase()}`, marginX + 31, y, { align: "center" });
    y += 12;
  }

  // ---------- comparativo com a média recente ----------
  if (ultimo && ultimo.carga > 0) {
    const anteriores = serie.slice(0, -1).filter((e) => e.carga > 0);
    if (anteriores.length >= 3) {
      const media = anteriores.reduce((s, e) => s + e.carga, 0) / anteriores.length;
      if (media > 0) {
        const diffPct = Math.round(((ultimo.carga - media) / media) * 100);
        doc.setTextColor(TEXT);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(
          `Última sessão: carga ${ultimo.carga} (${diffPct > 0 ? "+" : ""}${diffPct}% em relação à média recente de ${Math.round(media)})`,
          marginX,
          y
        );
        y += 7;
      }
    }
  }

  // ---------- monotonia / strain ----------
  const semanasMS = computeMonotoniaStrain(serie);
  const ultimaSemana = semanasMS[semanasMS.length - 1];
  if (ultimaSemana && ultimaSemana.monotonia !== null) {
    doc.text(
      `Monotonia (semana de ${formatarDataCurta(ultimaSemana.inicio)}): ${ultimaSemana.monotonia.toFixed(2)} · Strain: ${Math.round(ultimaSemana.strain ?? 0)}${
        ultimaSemana.alerta ? ` · ${ultimaSemana.alerta.label}` : ""
      }`,
      marginX,
      y
    );
    y += 9;
  } else {
    y += 3;
  }

  // ---------- recomendações (mesma fonte que aparece no painel) ----------
  if (ultimo) {
    const recs = recomendacoes(ultimo.modalidade as Modalidade, ultimo.alertaCarga, ultimo.alertaClinico);
    if (recs.length > 0) {
      y = novaPaginaSeNecessario(y, 14);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(TEAL);
      doc.text("Orientação com base no último check-in", marginX, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      recs.forEach((r) => {
        y = novaPaginaSeNecessario(y, 10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(TEXT);
        doc.text(r.titulo, marginX, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(MUTED);
        r.itens.forEach((it) => {
          y = novaPaginaSeNecessario(y, 6);
          const linhas = doc.splitTextToSize(`• ${it.texto}`, pageWidth - marginX * 2 - 4);
          doc.text(linhas, marginX + 3, y);
          y += 4.5 * linhas.length;
        });
        y += 2;
      });
      y += 3;
    }
  }

  // ---------- gráfico simples (carga sRPE + índice de recuperação) ----------
  const serieGrafico = serie.slice(-12).filter((e) => e.carga > 0 || e.indice !== null);
  if (serieGrafico.length >= 2) {
    y = novaPaginaSeNecessario(y, 55);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(TEAL);
    doc.text("Carga sRPE e índice de recuperação (últimos registros)", marginX, y);
    y += 6;

    const chartX = marginX;
    const chartY = y;
    const chartW = pageWidth - marginX * 2;
    const chartH = 40;

    doc.setDrawColor(BORDER);
    doc.rect(chartX, chartY, chartW, chartH);

    const cargas = serieGrafico.map((e) => e.carga);
    const indices = serieGrafico.map((e) => e.indice ?? 0);
    const cargaMax = Math.max(...cargas, 1);
    const cargaMin = 0;
    const indiceMax = Math.max(...indices, 0.1);
    const indiceMin = Math.min(...indices, 0);

    const passoX = chartW / Math.max(1, serieGrafico.length - 1);

    function pontoY(valor: number, min: number, max: number): number {
      const frac = max > min ? (valor - min) / (max - min) : 0.5;
      return chartY + chartH - frac * chartH;
    }

    // linha de carga (teal)
    doc.setDrawColor(TEAL);
    doc.setLineWidth(0.6);
    serieGrafico.forEach((e, i) => {
      const x = chartX + i * passoX;
      const py = pontoY(e.carga, cargaMin, cargaMax);
      if (i > 0) {
        const xPrev = chartX + (i - 1) * passoX;
        const pyPrev = pontoY(serieGrafico[i - 1].carga, cargaMin, cargaMax);
        doc.line(xPrev, pyPrev, x, py);
      }
    });

    // linha de índice de recuperação (azul)
    doc.setDrawColor("#2C7FB0");
    serieGrafico.forEach((e, i) => {
      if (e.indice === null) return;
      const x = chartX + i * passoX;
      const py = pontoY(e.indice, indiceMin, indiceMax);
      if (i > 0 && serieGrafico[i - 1].indice !== null) {
        const xPrev = chartX + (i - 1) * passoX;
        const pyPrev = pontoY(serieGrafico[i - 1].indice as number, indiceMin, indiceMax);
        doc.line(xPrev, pyPrev, x, py);
      }
    });

    // datas no eixo X — mostra só algumas, pra não sobrepor texto
    doc.setFontSize(7);
    doc.setTextColor(MUTED);
    doc.setFont("helvetica", "normal");
    const passoLabel = Math.max(1, Math.ceil(serieGrafico.length / 6));
    serieGrafico.forEach((e, i) => {
      if (i % passoLabel !== 0 && i !== serieGrafico.length - 1) return;
      const x = chartX + i * passoX;
      doc.text(rotuloPeriodo(e).split(" ")[0], x, chartY + chartH + 5, { align: "center" });
    });

    // legenda
    doc.setFillColor(TEAL);
    doc.rect(chartX, chartY + chartH + 9, 3, 3, "F");
    doc.setTextColor(TEXT);
    doc.text("Carga sRPE", chartX + 5, chartY + chartH + 11.5);
    doc.setFillColor("#2C7FB0");
    doc.rect(chartX + 32, chartY + chartH + 9, 3, 3, "F");
    doc.text("Índice de recuperação", chartX + 37, chartY + chartH + 11.5);

    y = chartY + chartH + 18;
  }

  // ---------- lesões/doenças registradas ----------
  if (lesoes.length > 0) {
    y = novaPaginaSeNecessario(y, 14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(TEAL);
    doc.text("Lesões e doenças registradas", marginX, y);
    y += 6;
    doc.setFontSize(9);
    lesoes
      .slice()
      .sort((a, b) => b.data.localeCompare(a.data))
      .forEach((l) => {
        y = novaPaginaSeNecessario(y, 8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(TEXT);
        doc.text(`${l.tipo_registro || "Lesão"} · ${l.gravidade} · ${formatarDataCurta(l.data)}`, marginX, y);
        y += 4.5;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(MUTED);
        const linhas = doc.splitTextToSize(
          l.descricao + (l.afastamento_dias ? ` (${l.afastamento_dias} dias de afastamento)` : ""),
          pageWidth - marginX * 2
        );
        doc.text(linhas, marginX, y);
        y += 4.5 * linhas.length + 2;
      });
    y += 2;
  }

  // ---------- tabela de histórico recente ----------
  const historico = serie.slice(-10).reverse();
  if (historico.length > 0) {
    y = novaPaginaSeNecessario(y, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(TEAL);
    doc.text(`Histórico recente (últimos ${historico.length} registros)`, marginX, y);
    y += 6;

    const colunas = [
      { titulo: "Data", w: 20 },
      { titulo: "Modalidade/Tipo", w: 38 },
      { titulo: "Carga", w: 16 },
      { titulo: "Sono", w: 14 },
      { titulo: "Dor", w: 14 },
      { titulo: "Alerta carga", w: 34 },
      { titulo: "Alerta clínico", w: 34 },
    ];

    function cabecalhoTabela() {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(MUTED);
      let x = marginX;
      colunas.forEach((c) => {
        doc.text(c.titulo, x, y);
        x += c.w;
      });
      y += 4;
      doc.setDrawColor(BORDER);
      doc.line(marginX, y - 2.5, marginX + colunas.reduce((s, c) => s + c.w, 0), y - 2.5);
    }

    cabecalhoTabela();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    historico.forEach((e) => {
      y = novaPaginaSeNecessario(y, 6);
      if (y === 20) cabecalhoTabela();
      let x = marginX;
      doc.setTextColor(TEXT);
      const tipoLabel = e.tipo === "Outro" ? e.tipoOutro || "Outro" : e.tipo;
      const pace = MODALIDADE_INPUT[e.modalidade as Modalidade] === "distancia" ? paceMinKm(e) : "";
      const linhaVals = [
        formatarDataCurta(e.data),
        `${e.modalidade}/${tipoLabel}${pace ? ` (${pace})` : ""}`,
        e.carga ? String(e.carga) : "—",
        e.sonoHoras ? `${e.sonoHoras}h` : "—",
        e.temDor ? String(e.dor) : "0",
        e.alertaCarga?.label ?? "—",
        e.alertaClinico?.label ?? "—",
      ];
      linhaVals.forEach((val, i) => {
        const linhas = doc.splitTextToSize(val, colunas[i].w - 2);
        doc.text(linhas[0] ?? "", x, y);
        x += colunas[i].w;
      });
      y += 5;
    });
  }

  desenharRodape();

  const nomeArquivo = `recon-${atleta.nome.replace(/\s+/g, "_").toLowerCase()}.pdf`;
  doc.save(nomeArquivo);
}
