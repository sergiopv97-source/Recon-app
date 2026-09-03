// Erros do Supabase (PostgrestError, AuthError etc) não são instâncias de
// Error do JavaScript — são objetos simples com um campo "message". Essa
// função extrai uma mensagem legível de qualquer um desses formatos.
export function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === "object") {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
    // formato desconhecido — mostra o objeto inteiro em vez de esconder a causa
    try {
      const json = JSON.stringify(err);
      if (json && json !== "{}") return json;
    } catch {
      // ignora — cai no fallback abaixo
    }
  }
  if (typeof err === "string" && err) return err;
  return "erro desconhecido (tipo: " + typeof err + ")";
}
