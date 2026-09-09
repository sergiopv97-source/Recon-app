import PageShell from "@/components/PageShell";
import CheckinForm from "@/components/CheckinForm";

// Link próprio de cada profissional, ex: /checkin/sergio-vargas. O "slug"
// vem da URL e é resolvido pra um profissional real dentro do CheckinForm
// (via a função get_owner_by_slug). O link antigo sem slug ("/checkin",
// em app/checkin/page.tsx) continua funcionando também, caindo no
// profissional padrão — não quebra pra quem já tem esse link salvo.
export default async function CheckinComSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <PageShell>
      <CheckinForm slug={slug} />
    </PageShell>
  );
}
