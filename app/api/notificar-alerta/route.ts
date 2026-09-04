// Envia um e-mail pro treinador quando um check-in gera um alerta vermelho
// (de carga ou clínico). Chamado "fire-and-forget" pelo formulário de
// check-in — se der erro ou faltar configuração, o check-in do atleta já
// foi salvo normalmente, isso aqui é só um aviso extra.
//
// Usa a Resend (https://resend.com) — tem plano grátis e é simples de
// configurar. Precisa de duas variáveis de ambiente no servidor (NUNCA com
// prefixo NEXT_PUBLIC_, pra não vazar pro navegador):
//   RESEND_API_KEY → chave da conta Resend
//   TRAINER_EMAIL  → e-mail do treinador que vai receber o aviso
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const destino = process.env.TRAINER_EMAIL;

    // Sem configuração, não faz nada — não é um erro, é uma funcionalidade
    // opcional que só liga quando o treinador cadastrar as duas variáveis.
    if (!apiKey || !destino) {
      return NextResponse.json({ enviado: false, motivo: "não configurado" });
    }

    const body = await req.json();
    const atleta = String(body?.atleta ?? "atleta");
    const alertas = Array.isArray(body?.alertas) ? body.alertas.filter((a: unknown) => typeof a === "string") : [];
    if (alertas.length === 0) {
      return NextResponse.json({ enviado: false, motivo: "sem alertas" });
    }

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Recon <onboarding@resend.dev>",
        to: [destino],
        subject: `⚠️ Alerta de risco — ${atleta}`,
        text: `O check-in de ${atleta} gerou o(s) seguinte(s) alerta(s):\n\n${alertas
          .map((a: string) => "• " + a)
          .join("\n")}\n\nAcesse o painel do Recon pra ver os detalhes.`,
      }),
    });

    if (!resp.ok) {
      const detalhe = await resp.text();
      return NextResponse.json({ enviado: false, erro: detalhe }, { status: 502 });
    }

    return NextResponse.json({ enviado: true });
  } catch (err) {
    return NextResponse.json({ enviado: false, erro: String(err) }, { status: 500 });
  }
}
