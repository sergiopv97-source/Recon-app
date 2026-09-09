"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  computeSeries,
  computeMonotoniaStrain,
  riscoGeral,
  recomendacoes,
  detectarDorRecorrente,
  formatarDataCurta,
  paceMinKm,
  ordemChave,
  toneColor,
  numeroBr,
  MODALIDADE_INPUT,
  type Alerta,
  type CheckinComputed,
  type Modalidade,
} from "@/lib/recon";
import { checkinRowToInput, type AthleteRow, type CheckinRow, type InjuryRow, type ProfessionalRow, type RecadoRow } from "@/lib/db-types";
import { inputStyle, cardStyle } from "@/lib/ui";
import { gerarResumoPdf, carregarLogoBase64 } from "@/lib/pdfResumo";
import { errorMessage } from "@/lib/errors";
import Badge from "@/components/Badge";
import HistoricoChart from "@/components/HistoricoChart";

const emptyLesaoForm = {
  tipoRegistro: "Lesão" as "Lesão" | "Doença",
  descricao: "",
  gravidade: "Leve" as "Leve" | "Moderada" | "Grave",
  afastamentoDias: "",
  data: new Date().toISOString().slice(0, 10),
};

export default function PainelClient() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [athletes, setAthletes] = useState<AthleteRow[]>([]);
  const [checkins, setCheckins] = useState<CheckinRow[]>([]);
  const [injuries, setInjuries] = useState<InjuryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filtroRisco, setFiltroRisco] = useState<"todos" | "danger" | "warn" | "ok">("todos");
  const [lesaoForm, setLesaoForm] = useState(emptyLesaoForm);
  const [editando, setEditando] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ idade: "", peso: "", altura: "", posicao: "", historicoLesoes: "" });
  const [recados, setRecados] = useState<RecadoRow[]>([]);
  const [novoRecado, setNovoRecado] = useState("");
  const [destinatarioRecado, setDestinatarioRecado] = useState(""); // "" = todos
  const [salvandoRecado, setSalvandoRecado] = useState(false);
  const [pinAtletaId, setPinAtletaId] = useState<string | null>(null);
  const [pinValor, setPinValor] = useState("");
  const [salvandoPin, setSalvandoPin] = useState(false);
  const [pinMsg, setPinMsg] = useState("");

  // Link de check-in próprio do profissional logado (/checkin/[slug]).
  const [profissional, setProfissional] = useState<ProfessionalRow | null>(null);
  const [editandoSlug, setEditandoSlug] = useState(false);
  const [slugInput, setSlugInput] = useState("");
  const [salvandoSlug, setSalvandoSlug] = useState(false);
  const [slugMsg, setSlugMsg] = useState("");

  async function load() {
    setLoading(true);
    // recados tem leitura liberada pra qualquer um no banco (o atleta sem
    // login precisa ler o mural), então aqui no painel a gente tem que
    // filtrar na mão pelo profissional logado — senão, com mais de um
    // profissional cadastrado, o painel mostraria o mural de todo mundo.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const [a, c, l, r, p] = await Promise.all([
      supabase.from("athletes").select("*").order("nome", { ascending: true }),
      supabase.from("checkins").select("*"),
      supabase.from("injuries").select("*"),
      user
        ? supabase.from("recados").select("*").eq("owner_id", user.id).order("criado_em", { ascending: false })
        : Promise.resolve({ data: null } as { data: RecadoRow[] | null }),
      user
        ? supabase.from("professionals").select("id, nome, slug").eq("id", user.id).single()
        : Promise.resolve({ data: null } as { data: ProfessionalRow | null }),
    ]);
    if (a.data) setAthletes(a.data as AthleteRow[]);
    if (c.data) setCheckins(c.data as CheckinRow[]);
    if (l.data) setInjuries(l.data as InjuryRow[]);
    if (r.data) setRecados(r.data as RecadoRow[]);
    if (p.data) setProfissional(p.data as ProfessionalRow);
    setLoading(false);
  }

  // Cria/troca o link de check-in próprio (ex: joao-fisio vira
  // /checkin/joao-fisio). A validação de formato e de duplicidade é feita
  // no banco (definir_slug_profissional) — aqui só repassamos a mensagem
  // de erro dele, se houver.
  async function salvarSlug() {
    const valor = slugInput.trim().toLowerCase();
    if (!valor) return;
    setSalvandoSlug(true);
    setSlugMsg("");
    const { error } = await supabase.rpc("definir_slug_profissional", { p_slug: valor });
    setSalvandoSlug(false);
    if (error) {
      setSlugMsg(errorMessage(error));
      return;
    }
    setEditandoSlug(false);
    setSlugInput("");
    load();
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial dos dados do painel
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function publicarRecado() {
    const mensagem = novoRecado.trim();
    if (!mensagem) return;
    setSalvandoRecado(true);
    const { error } = await supabase.from("recados").insert({ mensagem, athlete_id: destinatarioRecado || null });
    setSalvandoRecado(false);
    if (!error) {
      setNovoRecado("");
      setDestinatarioRecado("");
      load();
    }
  }

  async function removerRecado(id: string) {
    const { error } = await supabase.from("recados").delete().eq("id", id);
    if (!error) setRecados((prev) => prev.filter((r) => r.id !== id));
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const porAtleta = useMemo(() => {
    const map: Record<string, ReturnType<typeof checkinRowToInput>[]> = {};
    athletes.forEach((a) => (map[a.id] = []));
    checkins.forEach((row) => {
      const nome = athletes.find((a) => a.id === row.athlete_id)?.nome ?? "";
      if (!map[row.athlete_id]) map[row.athlete_id] = [];
      map[row.athlete_id].push(checkinRowToInput(row, nome));
    });
    const result: Record<string, CheckinComputed[]> = {};
    Object.keys(map).forEach((id) => {
      const sorted = [...map[id]].sort((x, y) => ordemChave(x) - ordemChave(y));
      result[id] = computeSeries(sorted);
    });
    return result;
  }, [athletes, checkins]);

  const resumo = useMemo(() => {
    let cargaTotal = 0;
    let alertasVermelhos = 0;
    let alertasAmarelos = 0;
    let clinicosVermelhos = 0;
    Object.values(porAtleta).forEach((serie) => {
      serie.forEach((e) => {
        cargaTotal += e.carga;
        if (e.alertaCarga?.tone === "danger") alertasVermelhos++;
        if (e.alertaCarga?.tone === "warn") alertasAmarelos++;
        if (e.alertaClinico?.tone === "danger") clinicosVermelhos++;
      });
    });
    return { cargaTotal, alertasVermelhos, alertasAmarelos, clinicosVermelhos, registros: checkins.length };
  }, [porAtleta, checkins]);

  const resumoAtual = useMemo(() => {
    let vermelho = 0,
      amarelo = 0,
      verde = 0,
      semDados = 0;
    Object.values(porAtleta).forEach((serie) => {
      const r = riscoGeral(serie);
      if (!r) semDados++;
      else if (r.tone === "danger") vermelho++;
      else if (r.tone === "warn") amarelo++;
      else verde++;
    });
    return { vermelho, amarelo, verde, semDados };
  }, [porAtleta]);

  function piorTom(serie: CheckinComputed[]): Alerta["tone"] | "semdados" {
    const r = riscoGeral(serie);
    return r ? r.tone : "semdados";
  }

  const idsFiltrados = useMemo(() => {
    return Object.keys(porAtleta)
      .filter((id) => filtroRisco === "todos" || piorTom(porAtleta[id]) === filtroRisco)
      .sort((x, y) => {
        const nx = athletes.find((a) => a.id === x)?.nome ?? "";
        const ny = athletes.find((a) => a.id === y)?.nome ?? "";
        return nx.localeCompare(ny, "pt-BR");
      });
  }, [porAtleta, filtroRisco, athletes]);

  const semCheckinHoje = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    return athletes.filter((a) => !checkins.some((c) => c.athlete_id === a.id && c.data === hoje)).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [athletes, checkins]);

  async function registrarLesao(athleteId: string, ultimoStatus: CheckinComputed | undefined) {
    if (!lesaoForm.descricao.trim()) return;
    const { error } = await supabase.from("injuries").insert({
      athlete_id: athleteId,
      tipo_registro: lesaoForm.tipoRegistro,
      descricao: lesaoForm.descricao.trim(),
      gravidade: lesaoForm.gravidade,
      afastamento_dias: lesaoForm.afastamentoDias ? Number(lesaoForm.afastamentoDias) : null,
      data: lesaoForm.data,
      alerta_carga_no_momento: ultimoStatus?.alertaCarga?.label ?? "—",
      alerta_clinico_no_momento: ultimoStatus?.alertaClinico?.label ?? "—",
    });
    if (!error) {
      setLesaoForm(emptyLesaoForm);
      load();
    }
  }

  function iniciarEdicao(infoAtleta: AthleteRow) {
    setEditando(infoAtleta.id);
    setEditForm({
      idade: infoAtleta.idade?.toString() ?? "",
      peso: infoAtleta.peso?.toString() ?? "",
      altura: infoAtleta.altura?.toString() ?? "",
      posicao: infoAtleta.posicao ?? "",
      historicoLesoes: infoAtleta.historico_lesoes ?? "",
    });
  }

  async function salvarEdicao(athleteId: string) {
    const { error } = await supabase
      .from("athletes")
      .update({
        idade: editForm.idade ? Number(editForm.idade) : null,
        peso: editForm.peso ? numeroBr(editForm.peso) : null,
        altura: editForm.altura ? Number(editForm.altura) : null,
        posicao: editForm.posicao.trim() || null,
        historico_lesoes: editForm.historicoLesoes.trim() || null,
      })
      .eq("id", athleteId);
    if (!error) {
      setEditando(null);
      load();
    }
  }

  async function apagarAtleta(athleteId: string, nome: string) {
    const confirmado = window.confirm(`Apagar ${nome}? Isso remove também todos os check-ins e lesões registrados dele. Não dá pra desfazer.`);
    if (!confirmado) return;
    const { error } = await supabase.from("athletes").delete().eq("id", athleteId);
    if (!error) {
      setExpanded(null);
      load();
    }
  }

  // Definir/redefinir o PIN de um atleta — usado pros que foram cadastrados
  // antes dessa funcionalidade existir (ainda sem PIN), ou se alguém
  // esquecer o próprio PIN.
  async function definirPin(athleteId: string, pin: string) {
    if (!/^\d{4}$/.test(pin)) {
      setPinMsg("O PIN precisa ter exatamente 4 dígitos.");
      return;
    }
    setSalvandoPin(true);
    const { error } = await supabase.rpc("definir_pin_atleta", { p_athlete_id: athleteId, p_pin: pin });
    setSalvandoPin(false);
    if (error) {
      setPinMsg("Não consegui salvar o PIN: " + errorMessage(error));
      return;
    }
    setPinMsg("PIN salvo.");
    setPinAtletaId(null);
    setPinValor("");
    load();
  }

  // A logo só precisa ser carregada uma vez (fica em cache aqui) — cada PDF
  // gerado reaproveita o mesmo base64, sem refazer o fetch toda hora.
  const logoBase64Ref = useRef<string | null | undefined>(undefined);
  const [gerandoPdf, setGerandoPdf] = useState<string | null>(null);

  async function baixarResumo(athleteId: string) {
    const infoAtleta = athletes.find((r) => r.id === athleteId);
    if (!infoAtleta) return;
    setGerandoPdf(athleteId);
    try {
      if (logoBase64Ref.current === undefined) {
        logoBase64Ref.current = await carregarLogoBase64();
      }
      const serie = porAtleta[athleteId] || [];
      const lesoesAtleta = injuries.filter((l) => l.athlete_id === athleteId);
      gerarResumoPdf({ atleta: infoAtleta, serie, lesoes: lesoesAtleta, logoBase64: logoBase64Ref.current });
    } finally {
      setGerandoPdf(null);
    }
  }

  if (loading) {
    return <div style={{ color: "#5B6664", padding: 40, textAlign: "center" }}>Carregando…</div>;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button
          onClick={logout}
          style={{ background: "none", border: "none", color: "#5B6664", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}
        >
          Sair
        </button>
      </div>

      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#14201F", marginBottom: 8 }}>Seu link de check-in</div>
        {profissional?.slug && !editandoSlug ? (
          <>
            <div style={{ fontSize: 11.5, color: "#5B6664", marginBottom: 10 }}>
              Esse é o link que você manda pros seus atletas — cada um seleciona o próprio nome nele.
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div
                style={{
                  ...inputStyle,
                  marginTop: 0,
                  flex: 1,
                  minWidth: 200,
                  background: "#F4F1EA",
                  color: "#14201F",
                  overflow: "auto",
                  whiteSpace: "nowrap",
                }}
              >
                {typeof window !== "undefined" ? window.location.origin : ""}/checkin/{profissional.slug}
              </div>
              <button
                type="button"
                onClick={async () => {
                  const link = `${window.location.origin}/checkin/${profissional.slug}`;
                  try {
                    await navigator.clipboard.writeText(link);
                    setSlugMsg("Link copiado.");
                  } catch {
                    setSlugMsg("Não consegui copiar automático — copia o link acima na mão.");
                  }
                }}
                style={{ padding: "0 14px", height: 38, background: "#297379", border: "none", borderRadius: 6, color: "#FFFFFF", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Copiar
              </button>
              <button
                type="button"
                onClick={() => {
                  setSlugInput(profissional.slug ?? "");
                  setEditandoSlug(true);
                  setSlugMsg("");
                }}
                style={{ background: "none", border: "none", color: "#5B6664", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}
              >
                Trocar
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 11.5, color: "#5B6664", marginBottom: 10 }}>
              {profissional?.slug
                ? "Escolha o novo final do link (só letras minúsculas, números e hífen, ex: joao-fisio)."
                : "Escolha o final do seu link de check-in (só letras minúsculas, números e hífen, ex: joao-fisio) — é o que você vai mandar pros atletas."}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: "#5B6664" }}>/checkin/</span>
              <input
                style={{ ...inputStyle, marginTop: 0, flex: 1, minWidth: 160 }}
                placeholder="joao-fisio"
                value={slugInput}
                onChange={(e) => setSlugInput(e.target.value)}
              />
              <button
                type="button"
                onClick={salvarSlug}
                disabled={salvandoSlug || !slugInput.trim()}
                style={{ padding: "0 14px", height: 38, background: "#297379", border: "none", borderRadius: 6, color: "#FFFFFF", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                {salvandoSlug ? "Salvando…" : "Salvar"}
              </button>
              {profissional?.slug && (
                <button
                  type="button"
                  onClick={() => {
                    setEditandoSlug(false);
                    setSlugMsg("");
                  }}
                  style={{ background: "none", border: "none", color: "#5B6664", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}
                >
                  Cancelar
                </button>
              )}
            </div>
          </>
        )}
        {slugMsg && <div style={{ fontSize: 12, color: slugMsg === "Link copiado." ? "#297379" : "#B23A32", marginTop: 8 }}>{slugMsg}</div>}
      </div>

      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#14201F", marginBottom: 8 }}>Recado pros atletas</div>
        <div style={{ fontSize: 11.5, color: "#5B6664", marginBottom: 10 }}>
          Aparece pra quem você escolher quando abrir o check-in (não é um chat, é só um mural).
        </div>

        {recados.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            {recados.map((r) => (
              <div
                key={r.id}
                style={{
                  background: "#FBF3E7",
                  border: "1px solid #EED9B8",
                  borderRadius: 6,
                  padding: "8px 12px",
                  marginBottom: 6,
                  fontSize: 13,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#B9812E", marginBottom: 2 }}>
                      {r.athlete_id ? (athletes.find((a) => a.id === r.athlete_id)?.nome ?? "atleta removido") : "Todos os atletas"}
                    </div>
                    {r.mensagem}
                  </div>
                  <button
                    type="button"
                    onClick={() => removerRecado(r.id)}
                    style={{ background: "none", border: "none", color: "#B23A32", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <select style={{ ...inputStyle, marginTop: 0, marginBottom: 8 }} value={destinatarioRecado} onChange={(e) => setDestinatarioRecado(e.target.value)}>
          <option value="">Todos os atletas</option>
          {athletes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </select>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={{ ...inputStyle, marginTop: 0 }}
            placeholder="ex: Treino de amanhã mais leve, atenção ao joelho"
            value={novoRecado}
            onChange={(e) => setNovoRecado(e.target.value)}
          />
          <button
            type="button"
            onClick={publicarRecado}
            disabled={salvandoRecado || !novoRecado.trim()}
            style={{
              padding: "0 16px",
              background: "#297379",
              border: "none",
              borderRadius: 6,
              color: "#FFFFFF",
              fontSize: 13,
              fontWeight: 600,
              cursor: novoRecado.trim() ? "pointer" : "not-allowed",
              opacity: novoRecado.trim() ? 1 : 0.6,
            }}
          >
            Publicar
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {(
          [
            ["Todos", Object.keys(porAtleta).length, "todos", "#297379"],
            ["🔴", resumoAtual.vermelho, "danger", "#B23A32"],
            ["🟡", resumoAtual.amarelo, "warn", "#B9812E"],
            ["🟢", resumoAtual.verde, "ok", "#2F7D52"],
          ] as const
        ).map(([emoji, count, chave, cor]) => (
          <button
            key={chave}
            onClick={() => setFiltroRisco(chave)}
            style={{
              flex: 1,
              minWidth: 80,
              border: `1px solid ${cor}`,
              background: filtroRisco === chave ? cor : "#FFFFFF",
              borderRadius: 8,
              padding: "10px 12px",
              textAlign: "center",
              cursor: "pointer",
            }}
          >
            <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 22, fontWeight: 700, color: filtroRisco === chave ? "#FFFFFF" : cor }}>{count}</div>
            <div style={{ fontSize: 11, color: filtroRisco === chave ? "#FFFFFF" : "#5B6664" }}>{emoji}</div>
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 24 }}>
        {[
          ["Registros", resumo.registros],
          ["Carga total (UA)", resumo.cargaTotal],
          ["Alertas de carga", resumo.alertasVermelhos],
          ["Alertas clínicos", resumo.clinicosVermelhos],
        ].map(([label, val]) => (
          <div key={label as string} style={cardStyle}>
            <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 30, fontWeight: 700, color: "#297379" }}>{val}</div>
            <div style={{ fontSize: 12, color: "#5B6664", marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {athletes.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#14201F", marginBottom: 8 }}>
            Check-in de hoje ({new Date().toLocaleDateString("pt-BR")})
          </div>
          {semCheckinHoje.length === 0 ? (
            <div style={{ fontSize: 13, color: "#2F7D52" }}>✓ Todos os atletas já preencheram hoje.</div>
          ) : (
            <>
              <div style={{ fontSize: 12.5, color: "#5B6664", marginBottom: 6 }}>Ainda não preencheram:</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {semCheckinHoje.map((a) => (
                  <span
                    key={a.id}
                    style={{ fontSize: 12.5, color: "#B9812E", background: "#FBF3E7", border: "1px solid #EED9B8", borderRadius: 20, padding: "4px 10px" }}
                  >
                    {a.nome}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {Object.keys(porAtleta).length === 0 && (
        <div style={{ color: "#5B6664", textAlign: "center", padding: 40 }}>
          Ainda não há check-ins. Assim que um atleta enviar o questionário, ele aparece aqui automaticamente.
        </div>
      )}

      {Object.keys(porAtleta).length > 0 && idsFiltrados.length === 0 && (
        <div style={{ color: "#5B6664", textAlign: "center", padding: 24 }}>Nenhum atleta nesse filtro.</div>
      )}

      {idsFiltrados.map((athleteId) => {
        const infoAtleta = athletes.find((a) => a.id === athleteId)!;
        const serie = porAtleta[athleteId];
        const ultimo = serie[serie.length - 1];
        const isOpen = expanded === athleteId;
        const lesoesAtleta = injuries.filter((l) => l.athlete_id === athleteId);
        const dorRecorrente = detectarDorRecorrente(serie);

        return (
          <div key={athleteId} style={{ border: "1px solid #DCE3E1", borderRadius: 8, marginBottom: 12, overflow: "hidden" }}>
            <button
              onClick={() => setExpanded(isOpen ? null : athleteId)}
              style={{ width: "100%", textAlign: "left", padding: "14px 16px", background: "#FFFFFF", border: "none", cursor: "pointer", color: "#14201F" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{infoAtleta.nome}</div>
                  {(() => {
                    const risco = riscoGeral(serie);
                    if (!risco) return null;
                    return (
                      <span
                        style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF", background: toneColor[risco.tone], borderRadius: 20, padding: "3px 10px" }}
                      >
                        {risco.label}
                      </span>
                    );
                  })()}
                </div>
                <div style={{ fontSize: 12, color: "#5B6664" }}>{isOpen ? "ocultar" : "ver histórico"}</div>
              </div>
              {ultimo ? (
                <div style={{ display: "flex", gap: 18, marginTop: 8, flexWrap: "wrap" }}>
                  <Badge alerta={ultimo.alertaCarga} />
                  <Badge alerta={ultimo.alertaClinico} />
                  {ultimo.alertaIndividual ? (
                    <Badge alerta={ultimo.alertaIndividual} />
                  ) : (
                    <span style={{ color: "#93A19E", fontSize: 12 }}>padrão individual: ainda sem histórico suficiente</span>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "#93A19E", marginTop: 6 }}>Sem check-ins ainda</div>
              )}
            </button>

            {isOpen && (
              <div style={{ padding: "4px 16px 16px" }}>
                <div style={{ marginBottom: 16, background: "#F7F8F7", border: "1px solid #DCE3E1", borderRadius: 8, padding: "12px 14px" }}>
                  {editando === athleteId ? (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                        <input
                          style={{ ...inputStyle, marginTop: 0 }}
                          type="number"
                          min="0"
                          placeholder="Idade"
                          value={editForm.idade}
                          onChange={(e) => setEditForm({ ...editForm, idade: e.target.value })}
                        />
                        <input
                          style={{ ...inputStyle, marginTop: 0 }}
                          type="text"
                          inputMode="decimal"
                          placeholder="Peso (kg)"
                          value={editForm.peso}
                          onChange={(e) => setEditForm({ ...editForm, peso: e.target.value })}
                        />
                        <input
                          style={{ ...inputStyle, marginTop: 0 }}
                          type="number"
                          min="0"
                          placeholder="Altura (cm)"
                          value={editForm.altura}
                          onChange={(e) => setEditForm({ ...editForm, altura: e.target.value })}
                        />
                      </div>
                      <input
                        style={{ ...inputStyle, marginTop: 0, marginBottom: 8 }}
                        placeholder="Posição / prova principal"
                        value={editForm.posicao}
                        onChange={(e) => setEditForm({ ...editForm, posicao: e.target.value })}
                      />
                      <input
                        style={{ ...inputStyle, marginTop: 0, marginBottom: 8 }}
                        placeholder="Lesões prévias"
                        value={editForm.historicoLesoes}
                        onChange={(e) => setEditForm({ ...editForm, historicoLesoes: e.target.value })}
                      />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => salvarEdicao(athleteId)}
                          style={{ padding: "8px 14px", background: "#297379", border: "none", borderRadius: 6, color: "#FFFFFF", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                        >
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditando(null)}
                          style={{ padding: "8px 14px", background: "#FFFFFF", border: "1px solid #DCE3E1", borderRadius: 6, color: "#5B6664", fontSize: 13, cursor: "pointer" }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {(infoAtleta.idade || infoAtleta.peso || infoAtleta.altura || infoAtleta.posicao) && (
                        <div style={{ fontSize: 12, color: "#5B6664", marginBottom: 6 }}>
                          {[infoAtleta.idade && `${infoAtleta.idade} anos`, infoAtleta.peso && `${infoAtleta.peso} kg`, infoAtleta.altura && `${infoAtleta.altura} cm`, infoAtleta.posicao]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: "#5B6664", marginBottom: 6 }}>
                        Lesões prévias (cadastro): {infoAtleta.historico_lesoes || "nenhuma informada"}
                      </div>
                      {(infoAtleta.responsavel_nome || infoAtleta.responsavel_contato) && (
                        <div style={{ fontSize: 12, color: "#5B6664", marginBottom: 6 }}>
                          Responsável (menor de idade): {infoAtleta.responsavel_nome || "—"}
                          {infoAtleta.responsavel_contato ? ` · ${infoAtleta.responsavel_contato}` : ""}
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: "#5B6664", marginBottom: 10 }}>
                        Termo de consentimento (LGPD):{" "}
                        {infoAtleta.consentimento_aceito_em ? (
                          <span style={{ color: "#2F7D52" }}>aceito em {formatarDataCurta(infoAtleta.consentimento_aceito_em.slice(0, 10))}</span>
                        ) : (
                          <span style={{ color: "#B23A32" }}>ainda não aceito</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: "#5B6664", marginBottom: 10 }}>
                        PIN de identificação:{" "}
                        {infoAtleta.pin_hash ? (
                          <span style={{ color: "#2F7D52" }}>definido</span>
                        ) : (
                          <span style={{ color: "#B9812E" }}>ainda não definido — qualquer um pode selecionar esse nome</span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => iniciarEdicao(infoAtleta)}
                          style={{ background: "none", border: "none", color: "#297379", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}
                        >
                          Editar cadastro
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPinAtletaId(athleteId);
                            setPinValor("");
                            setPinMsg("");
                          }}
                          style={{ background: "none", border: "none", color: "#297379", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}
                        >
                          {infoAtleta.pin_hash ? "Redefinir PIN" : "Definir PIN"}
                        </button>
                        <button
                          type="button"
                          onClick={() => apagarAtleta(athleteId, infoAtleta.nome)}
                          style={{ background: "none", border: "none", color: "#B23A32", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}
                        >
                          Apagar atleta
                        </button>
                      </div>

                      {pinAtletaId === athleteId && (
                        <div style={{ marginTop: 10, padding: "10px 12px", background: "#F7F8F7", border: "1px solid #DCE3E1", borderRadius: 6 }}>
                          <div style={{ fontSize: 12, color: "#5B6664", marginBottom: 8 }}>
                            Combine esse PIN com {infoAtleta.nome} antes de salvar — é ele quem vai usar pra se identificar.
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <input
                              style={{ ...inputStyle, marginTop: 0, width: 100, textAlign: "center", letterSpacing: 4 }}
                              type="text"
                              inputMode="numeric"
                              maxLength={4}
                              placeholder="1234"
                              value={pinValor}
                              onChange={(e) => setPinValor(e.target.value.replace(/\D/g, "").slice(0, 4))}
                            />
                            <button
                              type="button"
                              disabled={salvandoPin || pinValor.length !== 4}
                              onClick={() => definirPin(athleteId, pinValor)}
                              style={{
                                padding: "0 14px",
                                background: "#297379",
                                border: "none",
                                borderRadius: 6,
                                color: "#FFFFFF",
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: pinValor.length === 4 && !salvandoPin ? "pointer" : "not-allowed",
                                opacity: pinValor.length === 4 && !salvandoPin ? 1 : 0.6,
                              }}
                            >
                              {salvandoPin ? "Salvando…" : "Salvar"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPinAtletaId(null);
                                setPinMsg("");
                              }}
                              style={{ padding: "0 14px", background: "#FFFFFF", border: "1px solid #DCE3E1", borderRadius: 6, color: "#5B6664", fontSize: 13, cursor: "pointer" }}
                            >
                              Cancelar
                            </button>
                          </div>
                          {pinMsg && <div style={{ marginTop: 8, fontSize: 12, color: pinMsg.startsWith("PIN salvo") ? "#2F7D52" : "#B23A32" }}>{pinMsg}</div>}
                        </div>
                      )}
                    </>
                  )}

                  {dorRecorrente.length > 0 && (
                    <div style={{ marginBottom: 12, background: "#FBF3E7", border: "1px solid #EED9B8", borderRadius: 8, padding: "10px 12px" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#B9812E", letterSpacing: 0.4, marginBottom: 4 }}>
                        ⚠ POSSÍVEL PADRÃO DE DOR RECORRENTE
                      </div>
                      {dorRecorrente.map((d) => (
                        <div key={d.termo} style={{ fontSize: 12.5, color: "#14201F", marginBottom: 6 }}>
                          &quot;{d.termo}&quot; apareceu em {d.ocorrencias.length} check-ins nos últimos 21 dias:
                          <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                            {d.ocorrencias.map((o) => (
                              <li key={o.data} style={{ color: "#5B6664" }}>
                                {formatarDataCurta(o.data)} — &quot;{o.regiaoDor}&quot;
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                      <div style={{ fontSize: 11, color: "#93A19E", marginTop: 4 }}>
                        Isso é uma checagem de texto simples (busca palavra repetida na região informada), não um diagnóstico — dor recorrente na
                        mesma região é um sinal clássico de lesão em formação, vale conferir e considerar avaliação específica.
                      </div>
                    </div>
                  )}

                  {lesoesAtleta.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      {lesoesAtleta.map((l) => (
                        <div key={l.id} style={{ fontSize: 12.5, color: "#3F4A48", marginBottom: 4, borderTop: "1px solid #E7ECEA", paddingTop: 4 }}>
                          <strong>
                            {l.tipo_registro || "Lesão"} · {l.gravidade}
                          </strong>{" "}
                          — {l.descricao}
                          {l.afastamento_dias ? ` (${l.afastamento_dias} dias de afastamento)` : ""}
                          <br />
                          <span style={{ color: "#93A19E" }}>
                            {formatarDataCurta(l.data)} · alerta de carga &quot;{l.alerta_carga_no_momento}&quot; e clínico &quot;{l.alerta_clinico_no_momento}&quot; no
                            momento
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ fontSize: 12, color: "#5B6664", marginBottom: 6 }}>Registrar lesão ou doença:</div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <select
                      style={{ ...inputStyle, marginTop: 0 }}
                      value={lesaoForm.tipoRegistro}
                      onChange={(e) => setLesaoForm({ ...lesaoForm, tipoRegistro: e.target.value as "Lesão" | "Doença" })}
                    >
                      <option value="Lesão">Lesão</option>
                      <option value="Doença">Doença</option>
                    </select>
                    <input
                      style={{ ...inputStyle, marginTop: 0 }}
                      type="date"
                      value={lesaoForm.data}
                      onChange={(e) => setLesaoForm({ ...lesaoForm, data: e.target.value })}
                    />
                  </div>
                  <input
                    style={{ ...inputStyle, marginTop: 0, marginBottom: 8 }}
                    placeholder="Descrição (ex: entorse de tornozelo direito, ou gripe/resfriado)"
                    value={lesaoForm.descricao}
                    onChange={(e) => setLesaoForm({ ...lesaoForm, descricao: e.target.value })}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <select
                      style={{ ...inputStyle, marginTop: 0 }}
                      value={lesaoForm.gravidade}
                      onChange={(e) => setLesaoForm({ ...lesaoForm, gravidade: e.target.value as "Leve" | "Moderada" | "Grave" })}
                    >
                      <option value="Leve">Leve</option>
                      <option value="Moderada">Moderada</option>
                      <option value="Grave">Grave</option>
                    </select>
                    <input
                      style={{ ...inputStyle, marginTop: 0, width: 120 }}
                      type="number"
                      min="0"
                      placeholder="Dias afast."
                      value={lesaoForm.afastamentoDias}
                      onChange={(e) => setLesaoForm({ ...lesaoForm, afastamentoDias: e.target.value })}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => registrarLesao(athleteId, ultimo)}
                    style={{ marginTop: 8, padding: "8px 14px", background: "#297379", border: "none", borderRadius: 6, color: "#FFFFFF", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                  >
                    Salvar registro
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => baixarResumo(athleteId)}
                  disabled={gerandoPdf === athleteId}
                  style={{
                    marginBottom: 16,
                    padding: "8px 14px",
                    background: "#FFFFFF",
                    border: "1px solid #297379",
                    borderRadius: 6,
                    color: "#297379",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: gerandoPdf === athleteId ? "wait" : "pointer",
                    opacity: gerandoPdf === athleteId ? 0.6 : 1,
                  }}
                >
                  {gerandoPdf === athleteId ? "Gerando PDF…" : "⬇ Baixar relatório em PDF"}
                </button>

                {(() => {
                  const semanasMS = computeMonotoniaStrain(serie);
                  if (semanasMS.length === 0) return null;
                  const ultimaSemana = semanasMS[semanasMS.length - 1];
                  return (
                    <div style={{ marginBottom: 16, background: "#F7F8F7", border: "1px solid #DCE3E1", borderRadius: 8, padding: "12px 14px" }}>
                      <div style={{ fontSize: 12, color: "#5B6664", marginBottom: 6 }}>Monotonia e strain — semana de {formatarDataCurta(ultimaSemana.inicio)}</div>
                      <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
                        <div>
                          <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 20, fontWeight: 700, color: "#14201F" }}>
                            {ultimaSemana.monotonia !== null ? ultimaSemana.monotonia.toFixed(2) : "—"}
                          </span>
                          <span style={{ fontSize: 11, color: "#5B6664", marginLeft: 4 }}>monotonia</span>
                        </div>
                        <div>
                          <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 20, fontWeight: 700, color: "#14201F" }}>
                            {ultimaSemana.strain !== null ? Math.round(ultimaSemana.strain) : "—"}
                          </span>
                          <span style={{ fontSize: 11, color: "#5B6664", marginLeft: 4 }}>strain</span>
                        </div>
                        {ultimaSemana.alerta && <Badge alerta={ultimaSemana.alerta} />}
                      </div>
                      <div style={{ fontSize: 11, color: "#93A19E", marginTop: 6 }}>
                        Monotonia &gt; 2 combinada com carga alta é associada a mais doenças banais e sinais de overtraining na literatura.
                      </div>
                    </div>
                  );
                })()}

                {ultimo &&
                  recomendacoes(ultimo.modalidade as Modalidade, ultimo.alertaCarga, ultimo.alertaClinico).length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      {recomendacoes(ultimo.modalidade as Modalidade, ultimo.alertaCarga, ultimo.alertaClinico).map((r) => (
                        <div key={r.titulo} style={{ background: "#FFFFFF", border: "1px solid #DCE3E1", borderRadius: 6, padding: "10px 12px", marginBottom: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{r.titulo}</div>
                          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "#3F4A48" }}>
                            {r.itens.map((it) => (
                              <li key={it.texto} style={{ marginBottom: 2 }}>
                                {it.texto}
                                {it.publico === "terapeutico" && <span style={{ color: "#2C7FB0", fontSize: 11, marginLeft: 6 }}>· terapêutico (só treinador)</span>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}

                <HistoricoChart
                  serie={serie}
                  marcadores={lesoesAtleta.map((l) => ({ id: l.id, data: l.data, label: l.tipo_registro === "Doença" ? "doença" : "lesão" }))}
                />

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ color: "#5B6664", textAlign: "left" }}>
                        <th style={{ padding: "6px 8px" }}>Data</th>
                        <th style={{ padding: "6px 8px" }}>Dia</th>
                        <th style={{ padding: "6px 8px" }}>Modalidade</th>
                        <th style={{ padding: "6px 8px" }}>Tipo</th>
                        <th style={{ padding: "6px 8px" }}>Pace</th>
                        <th style={{ padding: "6px 8px" }}>Carga</th>
                        <th style={{ padding: "6px 8px" }}>Var.</th>
                        <th style={{ padding: "6px 8px" }}>Sono (h)</th>
                        <th style={{ padding: "6px 8px" }}>Estresse</th>
                        <th style={{ padding: "6px 8px" }}>Índice recup.</th>
                        <th style={{ padding: "6px 8px" }}>Dor</th>
                        <th style={{ padding: "6px 8px" }}>Alerta carga</th>
                        <th style={{ padding: "6px 8px" }}>Alerta clínico</th>
                        <th style={{ padding: "6px 8px" }}>Padrão individual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {serie.map((e) => (
                        <tr key={e.id} style={{ borderTop: "1px solid #E7ECEA" }}>
                          <td style={{ padding: "6px 8px" }}>{formatarDataCurta(e.data)}</td>
                          <td style={{ padding: "6px 8px" }}>{e.diaSemana}</td>
                          <td style={{ padding: "6px 8px" }}>{e.modalidade}</td>
                          <td style={{ padding: "6px 8px" }}>{e.tipo === "Outro" ? e.tipoOutro || "Outro" : e.tipo}</td>
                          <td style={{ padding: "6px 8px" }}>{MODALIDADE_INPUT[e.modalidade as Modalidade] === "distancia" ? paceMinKm(e) || "—" : "—"}</td>
                          <td style={{ padding: "6px 8px" }}>{e.carga || "—"}</td>
                          <td style={{ padding: "6px 8px" }}>{e.variacao !== null ? `${Math.round(e.variacao)}%` : "—"}</td>
                          <td style={{ padding: "6px 8px" }}>{e.sonoHoras ?? "—"}</td>
                          <td style={{ padding: "6px 8px" }}>{e.estresse ?? "—"}</td>
                          <td style={{ padding: "6px 8px" }}>{e.indice !== null ? e.indice.toFixed(2) : "—"}</td>
                          <td style={{ padding: "6px 8px" }}>{e.temDor ? `${e.dor} — ${e.regiaoDor || "s/ local"}` : "0"}</td>
                          <td style={{ padding: "6px 8px" }}>
                            <Badge alerta={e.alertaCarga} />
                          </td>
                          <td style={{ padding: "6px 8px" }}>
                            <Badge alerta={e.alertaClinico} />
                          </td>
                          <td style={{ padding: "6px 8px" }}>{e.alertaIndividual ? <Badge alerta={e.alertaIndividual} /> : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
