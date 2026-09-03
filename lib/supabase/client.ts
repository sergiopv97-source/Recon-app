"use client";

import { createBrowserClient } from "@supabase/ssr";

// Cliente Supabase para uso no navegador (componentes "use client").
// As duas variáveis de ambiente abaixo são PÚBLICAS de propósito — a chave
// "anon" só pode fazer o que as regras de segurança (RLS) do banco permitirem,
// então é seguro ela ficar visível no navegador.
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
