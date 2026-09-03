"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  MODALIDADES,
  MODALIDADE_INPUT,
  DURACAO_LABEL,
  TIPOS_POR_MODALIDADE,
  TIPOS_COM_CARGA,
  computeSeries,
  diaSemanaDe,
  proximaData,
  paceMinKm,
  recomendacoes,
  type Modalidade,
} from "@/lib/recon";
import { checkinRowToInput, type AthleteRosterRow, type CheckinRow } from "@/lib/db-types";
import { inputStyle, primaryButtonStyle, cardStyle } from "@/lib/ui";
import Slider from "@/components/Slider";

const emptyForm = {
  atleta: "",
  novoAtleta: "",
  novoAtletaLesoes: "",
  novoAtletaIdade: "",
  novoAtletaPeso: "",
  novoAtletaAltura: "",
  novoAtletaPosicao: "",
  data: new Date().toISOString().slice(0, 10),
  modalidade: "Futsal" as Modalidade,
  tipo: "Jogo",
  tipoOutro: "",
  minutos: "",
  distanciaKm: "",
  tempoMin: "",
  rpe: 5,
  sonoHoras: 8,
  fadiga: 3,
  estresse: 3,
  temDor: false,
  dorNivel: 0,
  recuperacao: 3,
  regiaoDor: "",
  observacoes: "",
};

export default function CheckinForm() {
  const supabase = useMemo(() => createClient(), []);
  const [roster, setRoster] = useState<AthleteRosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [recentRows, setRecentRows] = useState<CheckinRow[]>([]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("athletes_roster").select("id, nome").order("nome", { ascending: true });
      if (!error && data) setRoster(data);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Busca os últimos check-ins do próprio atleta selecionado, pra calcular a
  // "orientação de hoje" (autocuidado) — não expõe dados de outros atletas.
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!form.atleta || form.atleta === "__novo__") {
        if (!cancelled) setRecentRows([]);
        return;
      }
      const { data, error } = await supabase.rpc("get_own_recent_checkins", { p_athlete_id: form.atleta });
      if (!cancelled && !error && data) setRecentRows(data as CheckinRow[]);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [form.atleta, supabase]);

  const nomeAtletaSelecionado = useMemo(() => {
    if (form.atleta === "__novo__") return form.novoAtleta.trim();
    return roster.find((a) => a.id === form.atleta)?.nome ?? "";
  }, [form.atleta, form.novoAtleta, roster]);

  const serieRecente = useMemo(() => {
    const inputs = recentRows
      .map((r) => checkinRowToInput(r, nomeAtletaSelecionado))
      .sort((a, b) => a.data.localeCompare(b.data));
    return computeSeries(inputs);
  }, [recentRows, nomeAtletaSelecionado]);

  const ultimoAtleta = serieRecente.length > 0 ? serieRecente[serieRecente.length - 1] : null;

  const recsAutocuidado = useMemo(() => {
    if (!ultimoAtleta) return [];
    return recomendacoes(ultimoAtleta.modalidade as Modalidade, ultimoAtleta.alertaCarga, ultimoAtleta.alertaClinico)
      .map((r) => ({ ...r, itens: r.itens.filter((it) => it.publico === "todos") }))
      .filter((r) => r.itens.length > 0);
  }, [ultimoAtleta]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setSaving(true);

    try {
      let athleteId = form.atleta;

      if (form.atleta === "__novo__") {
        const nomeFinal = form.novoAtleta.trim();
        if (!nomeFinal) {
          setSaving(false);
          return;
        }
        const { data: inserted, error: insertErr } = await supabase
          .from("athletes")
          .insert({
            nome: nomeFinal,
            idade: form.novoAtletaIdade ? Number(form.novoAtletaIdade) : null,
            peso: form.novoAtletaPeso ? Number(form.novoAtletaPeso) : null,
            altura: form.novoAtletaAltura ? Number(form.novoAtletaAltura) : null,
            posicao: form.novoAtletaPosicao.trim() || null,
            historico_lesoes: form.novoAtletaLesoes.trim() || null,
          })
          .select("id, nome")
          .single();
        if (insertErr || !inserted) throw insertErr ?? new Error("Não foi possível cadastrar o atleta.");
        athleteId = inserted.id;
        setRoster((prev) => [...prev, inserted].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
      }

      if (!athleteId) {
        setSaving(false);
        return;
      }

      const { error: upsertErr } = await supabase.from("checkins").upsert(
        {
          athlete_id: athleteId,
          data: form.data,
          modalidade: form.modalidade,
          tipo: form.tipo,
          tipo_outro: form.tipo === "Outro" ? form.tipoOutro : null,
          minutos: form.minutos === "" ? null : Number(form.minutos),
          distancia_km: form.distanciaKm === "" ? null : Number(form.distanciaKm),
          tempo_min: form.tempoMin === "" ? null : Number(form.tempoMin),
          rpe: Number(form.rpe),
          sono_horas: Number(form.sonoHoras),
          fadiga: Number(form.fadiga),
          estresse: Number(form.estresse),
          tem_dor: form.temDor,
          dor: form.temDor ? Number(form.dorNivel) : 0,
          recuperacao: Number(form.recuperacao),
          regiao_dor: form.regiaoDor || null,
          observacoes: form.observacoes || null,
        },
        { onConflict: "athlete_id,data" },
      );
      if (upsertErr) throw upsertErr;

      setSavedMsg("Registro salvo.");
      setForm({ ...emptyForm, atleta: athleteId, data: proximaData(form.data) });

      const { data: refreshed } = await supabase.rpc("get_own_recent_checkins", { p_athlete_id: athleteId });
      if (refreshed) setRecentRows(refreshed as CheckinRow[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "erro desconhecido";
      setErrorMsg("Não foi possível salvar: " + message + ". Tente novamente.");
    } finally {
      setSaving(false);
      setTimeout(() => setSavedMsg(""), 4000);
    }
  }

  if (loading) {
    return <div style={{ color: "#5B6664", padding: 40, textAlign: "center" }}>Carregando…</div>;
  }

  return (
    <form onSubmit={submit}>
      <div
        style={{
          background: "#E4F1F0",
          border: "1px solid #DCE3E1",
          borderRadius: 8,
          padding: "10px 14px",
          marginBottom: 18,
          fontSize: 12.5,
          color: "#14201F",
        }}
      >
        Preencha entre 1h e 1h30 depois do fim do treino/jogo — depois disso a lembrança do esforço fica menos precisa.
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={{ fontSize: 13, color: "#5B6664" }}>Atleta</label>
        <select style={inputStyle} value={form.atleta} onChange={(e) => setForm({ ...form, atleta: e.target.value })} required>
          <option value="" disabled>
            Selecione seu nome
          </option>
          {roster.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
          <option value="__novo__">+ Meu nome não está na lista</option>
        </select>
        {form.atleta === "__novo__" && (
          <>
            <input
              style={{ ...inputStyle, marginTop: 10 }}
              placeholder="Digite seu nome completo"
              value={form.novoAtleta}
              onChange={(e) => setForm({ ...form, novoAtleta: e.target.value })}
              required
            />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input
                style={inputStyle}
                type="number"
                min="0"
                placeholder="Idade"
                value={form.novoAtletaIdade}
                onChange={(e) => setForm({ ...form, novoAtletaIdade: e.target.value })}
              />
              <input
                style={inputStyle}
                type="number"
                min="0"
                step="0.1"
                placeholder="Peso (kg)"
                value={form.novoAtletaPeso}
                onChange={(e) => setForm({ ...form, novoAtletaPeso: e.target.value })}
              />
              <input
                style={inputStyle}
                type="number"
                min="0"
                placeholder="Altura (cm)"
                value={form.novoAtletaAltura}
                onChange={(e) => setForm({ ...form, novoAtletaAltura: e.target.value })}
              />
            </div>
            <input
              style={{ ...inputStyle, marginTop: 10 }}
              placeholder="Posição / prova principal (ex: fixo, ala, meia maratona)"
              value={form.novoAtletaPosicao}
              onChange={(e) => setForm({ ...form, novoAtletaPosicao: e.target.value })}
            />
            <input
              style={{ ...inputStyle, marginTop: 10 }}
              placeholder="Teve alguma lesão antes? Qual e quando (opcional)"
              value={form.novoAtletaLesoes}
              onChange={(e) => setForm({ ...form, novoAtletaLesoes: e.target.value })}
            />
          </>
        )}
      </div>

      {recsAutocuidado.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 22 }}>
          <div style={{ fontSize: 13, color: "#5B6664", marginBottom: 10 }}>Com base no seu último check-in, aqui vai sua orientação de hoje:</div>
          {recsAutocuidado.map((r) => (
            <div key={r.titulo} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#297379", marginBottom: 4 }}>{r.titulo}</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#3F4A48" }}>
                {r.itens.map((it) => (
                  <li key={it.texto} style={{ marginBottom: 2 }}>
                    {it.texto}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginBottom: 18 }}>
        <label style={{ fontSize: 13, color: "#5B6664" }}>Data do check-in</label>
        <input style={inputStyle} type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} required />
        {form.data && <div style={{ fontSize: 12, color: "#5B6664", marginTop: 4 }}>{diaSemanaDe(form.data)}</div>}
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={{ fontSize: 13, color: "#5B6664" }}>Modalidade</label>
        <select
          style={inputStyle}
          value={form.modalidade}
          onChange={(e) => {
            const modalidade = e.target.value as Modalidade;
            setForm({ ...form, modalidade, tipo: TIPOS_POR_MODALIDADE[modalidade][0] });
          }}
        >
          {MODALIDADES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={{ fontSize: 13, color: "#5B6664" }}>Tipo</label>
        <select style={inputStyle} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
          {TIPOS_POR_MODALIDADE[form.modalidade].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {form.tipo === "Outro" && (
          <input
            style={{ ...inputStyle, marginTop: 10 }}
            value={form.tipoOutro}
            onChange={(e) => setForm({ ...form, tipoOutro: e.target.value })}
            placeholder="O que você fez? ex: pádel, bicicleta, natação"
            required
          />
        )}
      </div>

      {TIPOS_COM_CARGA.includes(form.tipo) && MODALIDADE_INPUT[form.modalidade] === "duracao" && (
        <>
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 13, color: "#5B6664" }}>{DURACAO_LABEL[form.modalidade]}</label>
            <input
              style={inputStyle}
              type="number"
              min="0"
              step="0.1"
              value={form.minutos}
              onChange={(e) => setForm({ ...form, minutos: e.target.value })}
              placeholder="ex: 25"
              required
            />
          </div>
          <Slider
            label="RPE da sessão (esforço percebido)"
            value={form.rpe}
            min={0}
            max={10}
            onChange={(v) => setForm({ ...form, rpe: v })}
            hint="0 = nenhum esforço · 10 = esforço máximo"
          />
        </>
      )}

      {TIPOS_COM_CARGA.includes(form.tipo) && MODALIDADE_INPUT[form.modalidade] === "distancia" && (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 13, color: "#5B6664" }}>Distância (km)</label>
              <input
                style={inputStyle}
                type="number"
                min="0"
                step="0.01"
                value={form.distanciaKm}
                onChange={(e) => setForm({ ...form, distanciaKm: e.target.value })}
                placeholder="ex: 10"
                required
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 13, color: "#5B6664" }}>Tempo total (min)</label>
              <input
                style={inputStyle}
                type="number"
                min="0"
                step="0.1"
                value={form.tempoMin}
                onChange={(e) => setForm({ ...form, tempoMin: e.target.value })}
                placeholder="ex: 52"
                required
              />
            </div>
          </div>
          {form.distanciaKm && form.tempoMin && (
            <div style={{ fontSize: 13, color: "#297379", marginTop: -10, marginBottom: 18 }}>
              Pace: {paceMinKm({ distanciaKm: form.distanciaKm, tempoMin: form.tempoMin })}
            </div>
          )}
          <Slider
            label="RPE da sessão (esforço percebido)"
            value={form.rpe}
            min={0}
            max={10}
            onChange={(v) => setForm({ ...form, rpe: v })}
            hint="0 = nenhum esforço · 10 = esforço máximo"
          />
        </>
      )}

      <div style={{ marginBottom: 22 }}>
        <label style={{ fontSize: 15, color: "#14201F", fontWeight: 500 }}>Horas de sono (noite anterior)</label>
        <input
          style={inputStyle}
          type="number"
          min="0"
          max="14"
          step="0.5"
          value={form.sonoHoras}
          onChange={(e) => setForm({ ...form, sonoHoras: Number(e.target.value) })}
        />
        <div style={{ fontSize: 12, color: "#5B6664", marginTop: 4 }}>Atletas costumam se beneficiar de 7–9h por noite</div>
      </div>
      <Slider label="Fadiga" value={form.fadiga} min={1} max={5} onChange={(v) => setForm({ ...form, fadiga: v })} hint="1 = descansado · 5 = exausto" />
      <Slider
        label="Estresse percebido"
        value={form.estresse}
        min={1}
        max={5}
        onChange={(v) => setForm({ ...form, estresse: v })}
        hint="1 = tranquilo · 5 = muito estressado (trabalho, estudo, vida pessoal)"
      />
      <Slider
        label="Sensação de recuperação"
        value={form.recuperacao}
        min={1}
        max={5}
        onChange={(v) => setForm({ ...form, recuperacao: v })}
        hint="1 = nada recuperado · 5 = totalmente recuperado"
      />

      <div style={{ marginBottom: 18 }}>
        <label style={{ fontSize: 15, color: "#14201F", fontWeight: 500 }}>Está sentindo dor?</label>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          {[
            { v: false, label: "Não" },
            { v: true, label: "Sim" },
          ].map((opt) => (
            <button
              key={String(opt.v)}
              type="button"
              onClick={() => setForm({ ...form, temDor: opt.v })}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: 6,
                border: form.temDor === opt.v ? "1px solid #297379" : "1px solid #DCE3E1",
                background: form.temDor === opt.v ? "#E4F1F0" : "#FFFFFF",
                color: form.temDor === opt.v ? "#297379" : "#5B6664",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {form.temDor && (
        <>
          <Slider label="Intensidade da dor" value={form.dorNivel} min={0} max={10} onChange={(v) => setForm({ ...form, dorNivel: v })} hint="0 = bem leve · 10 = dor máxima" />
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 13, color: "#5B6664" }}>Onde e como está a dor?</label>
            <input
              style={inputStyle}
              value={form.regiaoDor}
              onChange={(e) => setForm({ ...form, regiaoDor: e.target.value })}
              placeholder="ex: panturrilha direita, incomoda ao correr"
              required
            />
          </div>
        </>
      )}

      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 13, color: "#5B6664" }}>Observações (opcional)</label>
        <input
          style={inputStyle}
          value={form.observacoes}
          onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
          placeholder="ex: senti desconforto, joguei cansado, mudei de posição"
        />
        <div style={{ fontSize: 12, color: "#5B6664", marginTop: 4 }}>Conte se sentiu algum desconforto ou algo fora do comum</div>
      </div>

      <button type="submit" disabled={saving} style={{ ...primaryButtonStyle, width: "100%" }}>
        {saving ? "Salvando…" : "Enviar check-in"}
      </button>
      {savedMsg && <div style={{ marginTop: 12, fontSize: 14, color: "#2F7D52", textAlign: "center" }}>{savedMsg}</div>}
      {errorMsg && <div style={{ marginTop: 12, fontSize: 14, color: "#B23A32", textAlign: "center" }}>{errorMsg}</div>}
    </form>
  );
}
