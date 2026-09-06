// Lê um print de app de treino (Garmin Connect, Strava, Apple Fitness etc.)
// e extrai os dados objetivos do formulário de check-in (modalidade,
// distância, tempo/minutos, data), pra o atleta não precisar digitar tudo
// de novo. NUNCA envia isso pro banco direto — só devolve os dados pro
// formulário, que continua exigindo o atleta conferir e completar o resto
// (RPE, sono, fadiga, estresse, dor — nada disso vem de relógio nenhum).
//
// Usa a API da Anthropic (Claude Haiku 4.5, o modelo mais barato) — precisa
// da variável de ambiente ANTHROPIC_API_KEY no servidor (nunca com prefixo
// NEXT_PUBLIC_). Sem ela configurada, a rota devolve um erro claro e o
// formulário simplesmente não oferece a opção de anexar print.
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { MODALIDADES, TIPOS_POR_MODALIDADE } from "@/lib/recon";

type MediaTypeAceito = "image/jpeg" | "image/png" | "image/webp" | "image/gif";
const TIPOS_ACEITOS: MediaTypeAceito[] = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 8 * 1024 * 1024; // 8MB — generoso pra print de celular

function comoMediaTypeAceito(tipo: string): MediaTypeAceito | null {
  return (TIPOS_ACEITOS as string[]).includes(tipo) ? (tipo as MediaTypeAceito) : null;
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ erro: "Leitura de print ainda não configurada." }, { status: 501 });
    }

    const formData = await req.formData();
    const arquivo = formData.get("print");
    if (!(arquivo instanceof File)) {
      return NextResponse.json({ erro: "Nenhuma imagem enviada." }, { status: 400 });
    }
    const mediaType = comoMediaTypeAceito(arquivo.type === "image/jpg" ? "image/jpeg" : arquivo.type);
    if (!mediaType) {
      return NextResponse.json({ erro: "Envie uma imagem (print de tela) em JPG, PNG, WEBP ou GIF." }, { status: 400 });
    }
    if (arquivo.size > MAX_BYTES) {
      return NextResponse.json({ erro: "Imagem muito grande (máximo 8MB)." }, { status: 400 });
    }

    const buffer = Buffer.from(await arquivo.arrayBuffer());
    const base64 = buffer.toString("base64");

    const vocabulario = MODALIDADES.map((m) => `${m} (tipos possíveis: ${TIPOS_POR_MODALIDADE[m].join(", ")})`).join("; ");

    // O modelo não sabe que dia é "hoje" sozinho (não tem relógio) — sem
    // isso, ele chuta um ano com base em padrão de treino, o que já causou
    // erro real (voltou um ano no passado). Informar a data de verdade
    // resolve isso.
    const hojeISO = new Date().toISOString().slice(0, 10);

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 500,
      system:
        "Você lê prints de apps de treino (Garmin Connect, Strava, Apple Fitness etc.) e extrai dados estruturados " +
        "pra pré-preencher um formulário de check-in de atleta. Responda SOMENTE com um objeto JSON válido, sem " +
        "markdown, sem texto antes ou depois. Formato exato:\n" +
        '{"modalidade": string ou null, "tipo": string ou null, "distanciaKm": number ou null, "tempoMin": number ou null, ' +
        '"minutos": number ou null, "data": "AAAA-MM-DD" ou null, "confianca": "alta" ou "media" ou "baixa", "observacao": string ou null}\n\n' +
        `Hoje é ${hojeISO} — use isso como referência real pra qualquer cálculo de data, nunca chute outro ano. ` +
        `"modalidade" só pode ser um destes valores, ou null se não tiver certeza: ${MODALIDADES.join(", ")}.\n` +
        `"tipo" depende da modalidade escolhida — use um dos tipos válidos dela, ou null: ${vocabulario}.\n` +
        "Se a modalidade for de distância (Corrida ou Bike), preencha distanciaKm e tempoMin (tempo total em MINUTOS " +
        "decimais, convertendo de hh:mm:ss se preciso) e deixe minutos null. Pra qualquer outra modalidade, preencha " +
        "minutos (duração total da sessão) e deixe distanciaKm e tempoMin null. Se o print mostrar uma atividade " +
        'genérica (ex: "Cardio", "Outro", sem dar pra saber o esporte exato), deixe modalidade e tipo null e explique ' +
        'em "observacao" — não adivinhe o esporte. Se o título/nome da atividade já diz o esporte claramente (ex: ' +
        '"Corrida", "Futsal", "Musculação"), preencha modalidade com esse valor — NUNCA deixe modalidade null se você ' +
        'mesmo identificar o esporte em "observacao"; os dois campos têm que ser consistentes entre si. ' +
        `A data provável é ${hojeISO} (hoje) ou um dia próximo — só use um ano diferente se o print mostrar esse ano ` +
        "explicitamente por escrito (não invente, não deduza de memória). Leia o dia e o mês exatamente como aparecem " +
        "escritos na imagem, dígito por dígito — não calcule ou infira o dia a partir de outra informação. " +
        "A imagem tanto pode ser um print de tela (nítido, texto digital) quanto uma foto tirada da tela física do " +
        "relógio (pode ter reflexo, ângulo, iluminação ruim) — nos dois casos, leia o que der pra ler com confiança. " +
        "Se a foto estiver borrada, com reflexo forte ou ilegível a ponto de não dar pra confiar no número, deixe o " +
        "campo null em vez de arriscar um valor errado, e diga em \"observacao\" que a imagem não ficou clara o " +
        "suficiente. Se não conseguir ler algum campo com confiança, deixe null — nunca invente valor.",
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: "Extraia os dados desse print ou foto de treino." },
          ],
        },
      ],
    });

    let texto = "";
    for (const block of response.content) {
      if (block.type === "text") texto += block.text;
    }
    const jsonTexto = texto
      .trim()
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();

    let extraido: unknown;
    try {
      extraido = JSON.parse(jsonTexto);
    } catch {
      return NextResponse.json({ erro: "Não consegui interpretar os dados desse print. Tente outro print ou preencha manualmente." }, { status: 502 });
    }

    return NextResponse.json({ dados: extraido });
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : "Erro ao processar o print.";
    return NextResponse.json({ erro: mensagem }, { status: 500 });
  }
}
