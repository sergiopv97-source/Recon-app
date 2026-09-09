"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Converte a chave pública VAPID (base64 url-safe) pro formato que a
// PushManager.subscribe() do navegador espera — trecho padrão da
// documentação de Web Push, não tem lógica de negócio nenhuma aqui.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function iOSSemAtalho(): boolean {
  if (typeof window === "undefined") return false;
  const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  // No Safari, "standalone" é true quando o site já foi adicionado à tela
  // de início — sem isso, o iOS não entrega push nenhum (limitação da
  // Apple, não do Recon).
  const jaInstalado = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iOS && !jaInstalado;
}

// Botão "ativar lembrete de check-in" — só faz sentido no aparelho do
// PRÓPRIO atleta (nunca no modo em que o treinador preenche por ele, ver
// CheckinForm). Fica escondido se o navegador não suportar notificação
// push (ex: Safari de desktop mais antigo).
export default function AtivarLembrete({ athleteId }: { athleteId: string }) {
  const [suportado, setSuportado] = useState(true);
  const [status, setStatus] = useState<"verificando" | "inativo" | "ativando" | "ativo" | "erro">("verificando");
  const [erroMsg, setErroMsg] = useState("");

  useEffect(() => {
    let cancelado = false;
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        if (!cancelado) setSuportado(false);
        return;
      }
      try {
        const registro = await navigator.serviceWorker.register("/sw.js");
        const inscricao = await registro.pushManager.getSubscription();
        if (!cancelado) setStatus(inscricao ? "ativo" : "inativo");
      } catch {
        if (!cancelado) setStatus("inativo");
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  async function ativar() {
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      setStatus("erro");
      setErroMsg("Lembrete ainda não configurado nesse site.");
      return;
    }
    setStatus("ativando");
    setErroMsg("");
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") {
        setStatus("inativo");
        setErroMsg("Sem permissão de notificação, não dá pra ativar o lembrete.");
        return;
      }
      const registro = await navigator.serviceWorker.ready;
      const inscricao = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });
      const json = inscricao.toJSON();
      const supabase = createClient();
      const { error } = await supabase.rpc("salvar_push_subscription", {
        p_athlete_id: athleteId,
        p_endpoint: json.endpoint,
        p_p256dh: json.keys?.p256dh,
        p_auth: json.keys?.auth,
      });
      if (error) throw error;
      setStatus("ativo");
    } catch {
      setStatus("erro");
      setErroMsg("Não consegui ativar o lembrete agora. Tenta de novo em alguns minutos.");
    }
  }

  if (!suportado || status === "verificando") return null;

  return (
    <div style={{ marginBottom: 18, fontSize: 12.5 }}>
      {status === "ativo" ? (
        <div style={{ color: "#2F7D52" }}>🔔 Lembrete diário de check-in ativado neste aparelho.</div>
      ) : (
        <>
          <button
            type="button"
            onClick={ativar}
            disabled={status === "ativando"}
            style={{ background: "none", border: "none", color: "#297379", fontWeight: 600, cursor: "pointer", padding: 0, fontSize: 12.5 }}
          >
            🔔 {status === "ativando" ? "Ativando…" : "Ativar lembrete diário de check-in"}
          </button>
          {iOSSemAtalho() && (
            <div style={{ color: "#5B6664", marginTop: 4 }}>
              No iPhone, isso só funciona depois de adicionar o Recon à tela de início (toque em compartilhar
              <span aria-hidden="true"> ⬆️ </span>→ &quot;Adicionar à Tela de Início&quot;), por causa de uma limitação da Apple.
            </div>
          )}
          {erroMsg && <div style={{ color: "#B23A32", marginTop: 4 }}>{erroMsg}</div>}
        </>
      )}
    </div>
  );
}
