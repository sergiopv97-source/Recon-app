"use client";

import Link from "next/link";
import { ClipboardCheck, Stethoscope, ChevronRight } from "lucide-react";
import PageShell from "@/components/PageShell";
import { cardStyle } from "@/lib/ui";

function OpcaoEntrada({
  href,
  icon,
  titulo,
  descricao,
}: {
  href: string;
  icon: React.ReactNode;
  titulo: string;
  descricao: string;
}) {
  return (
    <Link
      href={href}
      style={{
        ...cardStyle,
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "22px 20px",
        textDecoration: "none",
        color: "#14201F",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "#E4F1F0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#297379",
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 2 }}>{titulo}</div>
        <div style={{ fontSize: 13, color: "#5B6664" }}>{descricao}</div>
      </div>
      <ChevronRight size={20} color="#93A19E" />
    </Link>
  );
}

// Página inicial — a pessoa escolhe se é atleta (vai preencher o check-in)
// ou profissional (vai entrar no painel). Antes disso a raiz do site
// redirecionava direto pro check-in; isso ficava confuso pra quem chegava
// aqui sem saber que "check-in" era só pro atleta, e não dava nenhum
// caminho visível pro lado do profissional.
export default function Home() {
  return (
    <PageShell showNav={false}>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div style={{ maxWidth: 420, width: "100%", margin: "20px 0 0" }}>
          <div style={{ fontSize: 14, color: "#5B6664", textAlign: "center", marginBottom: 24 }}>Como você quer entrar?</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <OpcaoEntrada
              href="/checkin"
              icon={<ClipboardCheck size={24} strokeWidth={2} />}
              titulo="Check-in do atleta"
              descricao="Preencha o questionário depois do treino ou jogo."
            />
            <OpcaoEntrada
              href="/login"
              icon={<Stethoscope size={24} strokeWidth={2} />}
              titulo="Painel do profissional"
              descricao="Fisioterapeutas e educadores físicos entram por aqui."
            />
          </div>
        </div>
      </div>
    </PageShell>
  );
}
