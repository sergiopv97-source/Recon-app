// Exporta todos os atletas e seus check-ins numa única planilha (.csv),
// pra ter uma visão geral de todo mundo de uma vez em vez de PDF atleta
// por atleta. Roda inteiramente no navegador, sem precisar de servidor —
// mesmo espírito do resumo em PDF (lib/pdfResumo.ts). Os cálculos (carga,
// alertas) continuam vindo de lib/recon.ts — fonte única da verdade, aqui
// só formatamos o que já foi calculado.
import { formatarDataCurta, MODALIDADE_INPUT, paceMinKm, type CheckinComputed } from "@/lib/recon";
import type { AthleteRow } from "@/lib/db-types";

function escapeCsv(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? "" : String(v);
  // Ponto e vírgula como separador (Excel em pt-BR espera isso, já que
  // vírgula é usada como separador decimal) — precisa escapar célula que
  // contenha ; " ou quebra de linha.
  if (/[",;\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function duracaoOuDistancia(e: CheckinComputed): string {
  if (MODALIDADE_INPUT[e.modalidade] === "distancia") {
    const dist = e.distanciaKm ? `${e.distanciaKm} km` : "";
    const tempo = e.tempoMin ? `${e.tempoMin} min` : "";
    const pace = paceMinKm({ distanciaKm: e.distanciaKm, tempoMin: e.tempoMin });
    return [dist, tempo, pace ? `(${pace})` : ""].filter(Boolean).join(" ");
  }
  return e.minutos ? `${e.minutos} min` : "";
}

export function gerarPlanilhaAtletas(athletes: AthleteRow[], porAtleta: Record<string, CheckinComputed[]>): void {
  const linhas: string[][] = [
    [
      "Atleta",
      "Data",
      "Dia da semana",
      "Modalidade",
      "Tipo",
      "Duração/Distância",
      "RPE",
      "Carga (sRPE)",
      "Sono (h)",
      "Fadiga",
      "Estresse",
      "Dor",
      "Recuperação",
      "Alerta de carga",
      "Alerta clínico",
      "Observações",
    ],
  ];

  athletes
    .slice()
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    .forEach((atleta) => {
      const serie = porAtleta[atleta.id] ?? [];
      serie.forEach((e) => {
        linhas.push([
          atleta.nome,
          formatarDataCurta(e.data),
          e.diaSemana,
          e.modalidade,
          e.tipo === "Outro" ? e.tipoOutro || "Outro" : e.tipo,
          duracaoOuDistancia(e),
          e.rpe != null ? String(e.rpe) : "",
          e.carga ? String(e.carga) : "",
          e.sonoHoras != null ? String(e.sonoHoras) : "",
          e.fadiga != null ? String(e.fadiga) : "",
          e.estresse != null ? String(e.estresse) : "",
          e.temDor ? String(e.dor) : "0",
          e.recuperacao != null ? String(e.recuperacao) : "",
          e.alertaCarga?.label ?? "",
          e.alertaClinico?.label ?? "",
          e.observacoes ?? "",
        ]);
      });
    });

  const csv = linhas.map((linha) => linha.map(escapeCsv).join(";")).join("\r\n");
  // BOM no início: sem isso o Excel abre acentuação (ex: "Recuperação")
  // errada, como se fosse outra codificação.
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `recon-atletas-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
