// Lembrete automático de check-in — todo dia à noite, manda uma
// notificação push só pros atletas que ainda NÃO preencheram o check-in
// hoje e que ativaram o lembrete (ver components/AtivarLembrete.tsx).
// Diferente do resumo semanal (que é pro treinador), esse é pro próprio
// atleta — um empurrãozinho pra não esquecer.
//
// Chamado automaticamente pela Vercel (Cron Jobs, ver vercel.json) — nunca
// pelo navegador.
//
// Precisa de três variáveis de ambiente extras, além de
// SUPABASE_SERVICE_ROLE_KEY e CRON_SECRET (já usadas pelo resumo semanal):
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY → o par de chaves que
//     identifica o Recon pros serviços de push (Apple, Google etc.) —
//     geradas uma vez só pra esse projeto, não são segredo de terceiros
//     como as outras chaves.
//   VAPID_SUBJECT → um contato (mailto:seuemail@... ou uma URL) exigido
//     pelo protocolo Web Push, pra quem opera o serviço de push conseguir
//     entrar em contato em caso de abuso.
//
// Agendado pra rodar às 23h UTC = 20h em Santa Maria/RS (Brasil não muda
// mais horário de verão, é sempre UTC-3) — horário em que quem treinou
// hoje já treinou, mas ainda dá tempo de preencher antes de dormir. Como
// o disparo e a comparação de "hoje" acontecem no mesmo dia em UTC e em
// horário de Brasília, não precisa converter fuso horário aqui.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

interface PushSubscriptionRow {
  id: string;
  athlete_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function GET(req: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ enviados: 0, motivo: "CRON_SECRET não configurado" }, { status: 501 });
    }
    if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT;
    if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
      return NextResponse.json({ enviados: 0, motivo: "lembrete de check-in ainda não configurado" }, { status: 501 });
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const hojeISO = new Date().toISOString().slice(0, 10);

    const [{ data: athletes }, { data: checkinsHoje }, { data: subscriptions }] = await Promise.all([
      supabase.from("athletes").select("id, nome"),
      supabase.from("checkins").select("athlete_id").eq("data", hojeISO),
      supabase.from("push_subscriptions").select("*"),
    ]);
    if (!athletes || !subscriptions) {
      return NextResponse.json({ enviados: 0, motivo: "não consegui ler atletas/inscrições" }, { status: 502 });
    }

    const jaFezCheckinHoje = new Set((checkinsHoje ?? []).map((c) => c.athlete_id as string));
    const subsPorAtleta = new Map<string, PushSubscriptionRow[]>();
    (subscriptions as PushSubscriptionRow[]).forEach((s) => {
      const lista = subsPorAtleta.get(s.athlete_id) ?? [];
      lista.push(s);
      subsPorAtleta.set(s.athlete_id, lista);
    });

    let enviados = 0;
    let semCheckin = 0;
    const inscricoesExpiradas: string[] = [];

    for (const atleta of athletes as { id: string; nome: string }[]) {
      if (jaFezCheckinHoje.has(atleta.id)) continue;
      const subs = subsPorAtleta.get(atleta.id);
      if (!subs || subs.length === 0) continue;
      semCheckin++;

      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({
              title: "Check-in do Recon",
              body: `${atleta.nome}, não esquece de preencher seu check-in de hoje.`,
              url: "/checkin",
            })
          );
          enviados++;
        } catch (err) {
          // 404/410 = inscrição não existe mais (usuário desinstalou, trocou
          // de aparelho, revogou permissão etc.) — limpa do banco, senão
          // ficaríamos tentando mandar pra sempre.
          const status = (err as { statusCode?: number })?.statusCode;
          if (status === 404 || status === 410) inscricoesExpiradas.push(sub.id);
        }
      }
    }

    if (inscricoesExpiradas.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", inscricoesExpiradas);
    }

    return NextResponse.json({ enviados, atletasSemCheckin: semCheckin, inscricoesRemovidas: inscricoesExpiradas.length });
  } catch (err) {
    return NextResponse.json({ enviados: 0, erro: err instanceof Error ? err.message : "erro desconhecido" }, { status: 500 });
  }
}
