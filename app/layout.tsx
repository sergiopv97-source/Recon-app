import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Recon — Monitoramento de carga e recuperação",
  description: "Controle de carga e recuperação de atletas — Sergio Vargas Fisioterapeuta",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
