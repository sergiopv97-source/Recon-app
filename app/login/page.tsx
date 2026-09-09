"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { inputStyle, primaryButtonStyle } from "@/lib/ui";
import PageShell from "@/components/PageShell";

function LoginForm() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setErrorMsg("E-mail ou senha incorretos.");
      return;
    }
    const redirectTo = searchParams.get("redirectTo") || "/painel";
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 360, width: "100%", margin: "40px 0 0" }}>
        <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 20, fontWeight: 600, marginBottom: 4, textAlign: "center" }}>
          Login do profissional
        </div>
        <div style={{ fontSize: 13, color: "#5B6664", marginBottom: 20, textAlign: "center" }}>
          Acesso restrito a fisioterapeutas/educadores físicos com conta no Recon.
        </div>
        <form onSubmit={submit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: "#5B6664" }}>E-mail</label>
            <input style={inputStyle} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: "#5B6664" }}>Senha</label>
            <input
              style={inputStyle}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={loading} style={{ ...primaryButtonStyle, width: "100%" }}>
            {loading ? "Entrando…" : "Entrar"}
          </button>
          {errorMsg && <div style={{ marginTop: 12, fontSize: 14, color: "#B23A32", textAlign: "center" }}>{errorMsg}</div>}
        </form>
        <div style={{ fontSize: 13, color: "#5B6664", textAlign: "center", marginTop: 20 }}>
          É fisioterapeuta ou educador físico e ainda não tem conta?{" "}
          <Link href="/cadastro" style={{ color: "#297379", fontWeight: 600 }}>
            Cadastre-se
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <PageShell showNav={false}>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </PageShell>
  );
}
