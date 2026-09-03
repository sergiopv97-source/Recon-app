import PageShell from "@/components/PageShell";
import PainelClient from "@/components/PainelClient";

// Rota protegida pelo middleware (lib/supabase/middleware.ts) — só entra
// quem estiver logado como treinador.
export default function PainelPage() {
  return (
    <PageShell>
      <PainelClient />
    </PageShell>
  );
}
