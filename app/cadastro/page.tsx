"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { inputStyle, primaryButtonStyle } from "@/lib/ui";
import { errorMessage } from "@/lib/errors";
import PageShell from "@/components/PageShell";

// Cadastro público de profissional (Fase 2) — fisioterapeutas/educadores
// físicos criam a própria conta aqui, sem precisar que você crie ela na
// mão pelo Supabase. A linha em "professionals" é criada sozinha por um
// gatilho no banco (on_auth_user_created) assim que a conta é criada —
// veja supabase/migrations/0001_init.sql. O link de check-in próprio
// (slug) fica pra escolher depois, no painel (card "Seu link de
// check-in"), igual já funciona pra quem já tem conta.
function CadastroForm() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [precisaConfirmarEmail, setPrecisaConfirmarEmail] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    if (!nome.trim()) {
      setErrorMsg("Informe seu nome.");
      return;
    }
    if (senha.length < 6) {
      setErrorMsg("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (senha !== confirmarSenha) {
      setErrorMsg("As senhas não são iguais.");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { data: { nome: nome.trim() } },
    });
    setLoading(false);

    if (error) {
      setErrorMsg(errorMessage(error));
      return;
    }

    if (data.session) {
      // Confirmação de e-mail desligada nesse projeto Supabase — a conta já
      // entra logada direto.
      router.push("/painel");
      router.refresh();
      return;
    }

    // Confirmação de e-mail ligada (padrão do Supabase): a conta foi criada,
    // mas só fica ativa depois de clicar no link mandado por e-mail.
    setPrecisaConfirmarEmail(true);
  }

  if (precisaConfirmarEmail) {
    return (
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div style={{ maxWidth: 380, width: "100%", margin: "40px 0 0", textAlign: "center" }}>
          <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 20, fontWeight: 600, marginBottom: 12 }}>Quase lá!</div>
          <div style={{ fontSize: 14, color: "#5B6664", lineHeight: 1.5 }}>
            Mandamos um e-mail de confirmação pra <strong>{email}</strong>. Clique no link dele pra ativar sua conta — depois é só{" "}
            <Link href="/login" style={{ color: "#297379", fontWeight: 600 }}>
              fazer login
            </Link>
            .
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 380, width: "100%", margin: "40px 0 0" }}>
        <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 20, fontWeight: 600, marginBottom: 4, textAlign: "center" }}>
          Criar conta de profissional
        </div>
        <div style={{ fontSize: 13, color: "#5B6664", marginBottom: 20, textAlign: "center" }}>
          Pra fisioterapeutas e educadores físicos acompanharem os próprios atletas/pacientes no Recon.
        </div>
        <form onSubmit={submit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: "#5B6664" }}>Nome completo</label>
            <input style={inputStyle} type="text" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: "#5B6664" }}>E-mail</label>
            <input style={inputStyle} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: "#5B6664" }}>Senha</label>
            <input
              style={inputStyle}
              type="password"
              autoComplete="new-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
            <div style={{ fontSize: 12, color: "#5B6664", marginTop: 4 }}>Pelo menos 6 caracteres.</div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 13, color: "#5B6664" }}>Confirmar senha</label>
            <input
              style={inputStyle}
              type="password"
              autoComplete="new-password"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={loading} style={{ ...primaryButtonStyle, width: "100%" }}>
            {loading ? "Criando conta…" : "Criar conta"}
          </button>
          {errorMsg && <div style={{ marginTop: 12, fontSize: 14, color: "#B23A32", textAlign: "center" }}>{errorMsg}</div>}
        </form>
        <div style={{ fontSize: 13, color: "#5B6664", textAlign: "center", marginTop: 20 }}>
          Já tem conta?{" "}
          <Link href="/login" style={{ color: "#297379", fontWeight: 600 }}>
            Entrar
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CadastroPage() {
  return (
    <PageShell showNav={false}>
      <CadastroForm />
    </PageShell>
  );
}
