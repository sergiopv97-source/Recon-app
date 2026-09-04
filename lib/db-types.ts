// Tipos e conversores entre as linhas do banco (snake_case) e os objetos
// usados pelas fórmulas em lib/recon.ts (que usam os mesmos nomes de campo
// do protótipo original, validado).
import type { CheckinInput, Modalidade } from "@/lib/recon";

export interface AthleteRosterRow {
  id: string;
  nome: string;
}

export interface AthleteRow extends AthleteRosterRow {
  idade: number | null;
  peso: number | null;
  altura: number | null;
  posicao: string | null;
  historico_lesoes: string | null;
  consentimento_aceito_em: string | null;
  created_at: string;
}

export interface CheckinRow {
  id: string;
  athlete_id: string;
  data: string;
  modalidade: string;
  tipo: string;
  tipo_outro: string | null;
  minutos: number | null;
  distancia_km: number | null;
  tempo_min: number | null;
  rpe: number | null;
  sono_horas: number | null;
  fadiga: number | null;
  estresse: number | null;
  tem_dor: boolean;
  dor: number;
  recuperacao: number | null;
  regiao_dor: string | null;
  observacoes: string | null;
  created_at: string;
}

export interface RecadoRow {
  id: string;
  mensagem: string;
  criado_em: string;
}

export interface InjuryRow {
  id: string;
  athlete_id: string;
  tipo_registro: "Lesão" | "Doença";
  descricao: string;
  gravidade: "Leve" | "Moderada" | "Grave";
  afastamento_dias: number | null;
  data: string;
  alerta_carga_no_momento: string | null;
  alerta_clinico_no_momento: string | null;
  created_at: string;
}

export function checkinRowToInput(row: CheckinRow, atletaNome: string): CheckinInput & { id: string } {
  return {
    id: row.id,
    atleta: atletaNome,
    data: row.data,
    modalidade: row.modalidade as Modalidade,
    tipo: row.tipo,
    tipoOutro: row.tipo_outro,
    minutos: row.minutos,
    distanciaKm: row.distancia_km,
    tempoMin: row.tempo_min,
    rpe: row.rpe ?? 0,
    sonoHoras: row.sono_horas ?? 8,
    fadiga: row.fadiga ?? 3,
    estresse: row.estresse ?? 3,
    temDor: row.tem_dor,
    dor: row.dor,
    recuperacao: row.recuperacao ?? 3,
    regiaoDor: row.regiao_dor,
    observacoes: row.observacoes,
  };
}
