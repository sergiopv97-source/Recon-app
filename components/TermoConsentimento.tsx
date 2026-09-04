"use client";

import { useState } from "react";
import { TERMO_TITULO, TERMO_CABECALHO, TERMO_SECOES, TERMO_CONTATO, TERMO_DECLARACAO } from "@/lib/consentimento";

export default function TermoConsentimento({
  aceito,
  onChangeAceito,
}: {
  aceito: boolean;
  onChangeAceito: (v: boolean) => void;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #DCE3E1", borderRadius: 8, padding: "14px 16px", marginBottom: 18 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#14201F", marginBottom: 4 }}>Termo de consentimento (LGPD)</div>
      <div style={{ fontSize: 12.5, color: "#5B6664", marginBottom: 8 }}>
        Como é seu primeiro check-in, precisamos que você leia e concorde com o uso dos seus dados.
      </div>

      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        style={{
          background: "none",
          border: "none",
          color: "#297379",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          padding: 0,
          marginBottom: aberto ? 12 : 0,
        }}
      >
        {aberto ? "Ocultar o termo completo ▲" : "Ler o termo completo ▼"}
      </button>

      {aberto && (
        <div
          style={{
            background: "#F7F8F7",
            border: "1px solid #E7ECEA",
            borderRadius: 6,
            padding: "12px 14px",
            marginBottom: 12,
            maxHeight: 280,
            overflowY: "auto",
            fontSize: 12.5,
            color: "#3F4A48",
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 700, color: "#14201F", marginBottom: 4 }}>{TERMO_TITULO}</div>
          <div style={{ color: "#5B6664", marginBottom: 12 }}>{TERMO_CABECALHO}</div>
          {TERMO_SECOES.map((secao) => (
            <div key={secao.titulo} style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, color: "#14201F", marginBottom: 4 }}>{secao.titulo}</div>
              {secao.paragrafos?.map((p) => (
                <p key={p} style={{ margin: "0 0 6px" }}>
                  {p}
                </p>
              ))}
              {secao.itens && (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {secao.itens.map((it) => (
                    <li key={it} style={{ marginBottom: 2 }}>
                      {it}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          <div style={{ color: "#5B6664" }}>{TERMO_CONTATO}</div>
        </div>
      )}

      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={aceito}
          onChange={(e) => onChangeAceito(e.target.checked)}
          style={{ marginTop: 3, width: 18, height: 18, accentColor: "#297379", flexShrink: 0 }}
          required
        />
        <span style={{ fontSize: 13, color: "#14201F" }}>{TERMO_DECLARACAO}</span>
      </label>
    </div>
  );
}
