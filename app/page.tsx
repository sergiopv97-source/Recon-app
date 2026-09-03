import { redirect } from "next/navigation";

// A raiz do site leva direto pro check-in — é o link que os atletas usam.
export default function Home() {
  redirect("/checkin");
}
