// Resumo semanal por e-mail pro treinador — diferente do aviso de alerta
// vermelho (que dispara na hora, a cada check-in), esse roda uma vez por
// semana (configurado em vercel.json) e manda uma visão geral do grupo:
// quantos atletas em cada nível de risco, quem está com alerta vermelho
// agora, e quem não preenche o check-in há alguns dias.
//
// Chamado automaticamente pela Vercel (Cron Jobs) — nunca pelo navegador.
// Usa a mesma lógica de negócio de lib/recon.ts (fonte única da verdade),
// só que rodando no servidor em vez do painel.
//
// Um e-mail POR PROFISSIONAL, cada um só com os PRÓPRIOS atletas — antes
// dessa versão, existia um único e-mail (TRAINER_EMAIL) que misturava os
// atletas de todos os profissionais cadastrados. Isso passou despercebido
// enquanto só existia um profissional (você); deixou de fazer sentido
// assim que o cadastro público (/cadastro) entrou no ar. O e-mail de cada
// um vai pro próprio e-mail de login dele (via API de administração do
// Supabase, que só a chave de serviço consegue usar).
//
// Precisa de duas variáveis de ambiente, além de RESEND_API_KEY (já usada
// pelo aviso de alerta vermelho):
//   SUPABASE_SERVICE_ROLE_KEY → chave de serviço do Supabase (não é a
//     mesma "publishable key" do navegador — essa aqui ignora as regras
//     de segurança de propósito, porque é o único jeito de um processo
//     automático (sem ninguém logado) ler os dados de todos os
//     profissionais/atletas pra montar os resumos, e de descobrir o
//     e-mail de login de cada profissional. NUNCA usar essa chave no
//     navegador.
//   CRON_SECRET → uma senha aleatória só pra confirmar que quem chamou
//     essa rota foi a Vercel de verdade, não um visitante qualquer.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { computeSeries, riscoGeral, ordemChave, diaAnterior, type CheckinComputed } from "@/lib/recon";
import { checkinRowToInput, type AthleteRow, type CheckinRow } from "@/lib/db-types";

export async function GET(req: Request) {
  try {
    // Confirma que quem chamou foi a própria Vercel (ela manda esse
    // cabeçalho sozinha em todo disparo agendado), não um visitante
    // batendo direto nessa URL.
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ enviados: 0, motivo: "CRON_SECRET não configurado" }, { status: 501 });
    }
    if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!resendKey || !supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ enviados: 0, motivo: "resumo semanal ainda não configurado" }, { status: 501 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const [{ data: professionals }, { data: athletes }, { data: checkins }] = await Promise.all([
      supabase.from("professionals").select("id, nome"),
      supabase.from("athletes").select("*"),
      supabase.from("checkins").select("*"),
    ]);
    if (!professionals || !athletes) {
      return NextResponse.json({ enviados: 0, motivo: "não consegui ler profissionais/atletas" }, { status: 502 });
    }

    let enviados = 0;
    const semEmail: string[] = [];
    const falhas: string[] = [];

    for (const prof of professionals as { id: string; nome: string | null }[]) {
      const atletasDoProf = (athletes as AthleteRow[]).filter((a) => a.owner_id === prof.id);
      if (atletasDoProf.length === 0) continue; // nada pra resumir ainda

      const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(prof.id);
      const destino = userData?.user?.email;
      if (userErr || !destino) {
        semEmail.push(prof.nome || prof.id);
        continue;
      }

      const porAtleta: Record<string, CheckinComputed[]> = {};
      atletasDoProf.forEach((a) => {
        const doAtleta = ((checkins as CheckinRow[]) || []).filter((c) => c.athlete_id === a.id);
        const inputs = doAtleta.map((c) => checkinRowToInput(c, a.nome)).sort((x, y) => ordemChave(x) - ordemChave(y));
        porAtleta[a.id] = computeSeries(inputs);
      });

      let verde = 0,
        amarelo = 0,
        vermelho = 0,
        semDados = 0;
      const comAlertaVermelho: string[] = [];
      atletasDoProf.forEach((a) => {
        const serie = porAtleta[a.id];
        const risco = riscoGeral(serie);
        if (!risco) semDados++;
        else if (risco.tone === "danger") {
          vermelho++;
          const ultimo = serie[serie.length - 1];
          const motivos = [ultimo?.alertaCarga, ultimo?.alertaClinico].filter((al) => al?.tone === "danger").map((al) => al!.label);
          comAlertaVermelho.push(`${a.nome} (${motivos.join(", ") || "risco alto"})`);
        } else if (risco.tone === "warn") amarelo++;
        else verde++;
      });

      // Atletas sem check-in nos últimos 3 dias corridos — sinal de que
      // alguém pode estar afastado, esquecendo de preencher, ou parou.
      const hojeISO = new Date().toISOString().slice(0, 10);
      const limiteISO = diaAnterior(diaAnterior(diaAnterior(hojeISO)));
      const semCheckinRecente = atletasDoProf
        .filter((a) => {
          const serie = porAtleta[a.id];
          const ultimo = serie[serie.length - 1];
          return !ultimo || ultimo.data <= limiteISO;
        })
        .map((a) => a.nome)
        .sort((x, y) => x.localeCompare(y, "pt-BR"));

      const linhas = [
        `Resumo semanal do Recon — ${new Date().toLocaleDateString("pt-BR")}`,
        "",
        `Total de atletas: ${atletasDoProf.length}`,
        `🟢 Risco baixo/ok: ${verde}`,
        `🟡 Risco moderado: ${amarelo}`,
        `🔴 Risco alto: ${vermelho}`,
        `Sem dados suficientes ainda: ${semDados}`,
        "",
      ];
      if (comAlertaVermelho.length > 0) {
        linhas.push("Atletas com alerta vermelho agora:");
        comAlertaVermelho.forEach((l) => linhas.push(`  • ${l}`));
        linhas.push("");
      }
      if (semCheckinRecente.length > 0) {
        linhas.push("Sem check-in há 3+ dias:");
        semCheckinRecente.forEach((n) => linhas.push(`  • ${n}`));
        linhas.push("");
      }
      linhas.push("Acesse o painel do Recon pra ver os detalhes de cada atleta.");

      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Recon <onboarding@resend.dev>",
          to: [destino],
          subject: `📋 Resumo semanal Recon — ${vermelho} vermelho(s), ${amarelo} amarelo(s)`,
          text: linhas.join("\n"),
        }),
      });

      if (resp.ok) {
        enviados++;
      } else {
        falhas.push(prof.nome || prof.id);
      }
    }

    return NextResponse.json({ enviados, semEmail, falhas });
  } catch (err) {
    return NextResponse.json({ enviados: 0, erro: err instanceof Error ? err.message : "erro desconhecido" }, { status: 500 });
  }
}
