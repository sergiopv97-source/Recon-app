// Erros do Supabase (PostgrestError, AuthError etc) não são instâncias de
// Error do JavaScript — são objetos simples com um campo "message". Essa
// função extrai uma mensagem legível de qualquer um desses formatos.
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return "erro desconhecido";
}
