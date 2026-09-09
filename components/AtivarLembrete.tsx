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

// iPhone/iPad, mesmo quando o Safari disfarça o user-agent de "Mac" (o
// iPad faz isso desde o iPadOS 13) — o truque padrão pra detectar isso é
// checar por tela sensível ao toque num "MacIntel", já que um Mac de
// verdade não tem touch.
function isAppleTouchDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const uaIsIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isIPadOSDisfarcado = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return uaIsIOS || isIPadOSDisfarcado;
}

// No Safari (iPhone/iPad), o navegador só entrega notificação push depois
// que o site foi adicionado à tela de início — sem isso, a própria API de
// push nem existe (limitação da Apple, não do Recon). "standalone" é a
// forma que o Safari expõe pra saber se já foi adicionado.
function jaInstaladoNaTelaDeInicio(): boolean {
  if (typeof window === "undefined") return false;
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

type Status = "verificando" | "precisaInstalar" | "naoSuportado" | "inativo" | "ativando" | "ativo" | "erro";

// Botão "ativar lembrete de check-in" — só faz sentido no aparelho do
// PRÓPRIO atleta (nunca no modo em que o treinador preenche por ele, ver
// CheckinForm).
export default function AtivarLembrete({ athleteId }: { athleteId: string }) {
  const [status, setStatus] = useState<Status>("verificando");
  const [erroMsg, setErroMsg] = useState("");

  useEffect(() => {
    let cancelado = false;
    (async () => {
      // No Safari da Apple (iPhone/iPad) sem estar na tela de início, a
      // API de push nem existe — precisa mostrar a instrução de instalar
      // ANTES de checar suporte, senão isso cai (errado) no "não
      // suportado" e o atleta nunca fica sabendo que dá pra ativar.
      if (isAppleTouchDevice() && !jaInstaladoNaTelaDeInicio()) {
        if (!cancelado) setStatus("precisaInstalar");
        return;
      }
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        if (!cancelado) setStatus("naoSuportado");
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

  if (status === "verificando" || status === "naoSuportado") return null;

  if (status === "precisaInstalar") {
    return (
      <div
        style={{
          marginBottom: 18,
          fontSize: 12.5,
          color: "#14201F",
          background: "#E4F1F0",
          border: "1px solid #DCE3E1",
          borderRadius: 8,
          padding: "10px 14px",
        }}
      >
        🔔 Quer um lembrete se esquecer de fazer o check-in? No iPhone/iPad, primeiro precisa adicionar o Recon à
        tela de início: toque em compartilhar <span aria-hidden="true">⬆️</span> → &quot;Adicionar à Tela de
        Início&quot;. Depois, abra o Recon por esse ícone (não pelo Safari direto) — aí sim o botão de ativar
        aparece aqui.
      </div>
    );
  }

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
          {erroMsg && <div style={{ color: "#B23A32", marginTop: 4 }}>{erroMsg}</div>}
        </>
      )}
    </div>
  );
}
