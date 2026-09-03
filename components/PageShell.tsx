"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Radar } from "lucide-react";
import { FontImport, shellStyle } from "@/lib/ui";

function NavBtn({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      style={{
        flex: 1,
        padding: "16px 8px",
        textAlign: "center",
        textDecoration: "none",
        borderBottom: active ? "2px solid #297379" : "2px solid transparent",
        color: active ? "#14201F" : "#5B6664",
        fontSize: 14,
        fontWeight: 600,
        letterSpacing: 0.2,
      }}
    >
      {label}
    </Link>
  );
}

export default function PageShell({ children, showNav = true }: { children: React.ReactNode; showNav?: boolean }) {
  const pathname = usePathname();

  return (
    <div style={shellStyle}>
      <FontImport />
      <div style={{ padding: "28px 20px 0", maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Radar size={30} color="#297379" strokeWidth={2} />
          <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 34, fontWeight: 700, lineHeight: 1, letterSpacing: 1 }}>RECON</div>
        </div>
        <div style={{ color: "#5B6664", fontSize: 14, marginTop: 6 }}>Monitoramento de carga e recuperação — atualizado a cada check-in</div>
      </div>

      {showNav && (
        <div style={{ display: "flex", borderBottom: "1px solid #E7ECEA", position: "sticky", top: 0, background: "#F7F8F7", zIndex: 10 }}>
          <div style={{ display: "flex", maxWidth: 720, margin: "0 auto", width: "100%" }}>
            <NavBtn href="/checkin" label="Check-in do atleta" active={pathname === "/checkin"} />
            <NavBtn href="/painel" label="Painel do treinador" active={pathname?.startsWith("/painel") ?? false} />
          </div>
        </div>
      )}

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px" }}>{children}</div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "8px 20px 30px", textAlign: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Sergio Vargas Fisioterapeuta" style={{ height: 28, width: "auto", opacity: 0.85 }} />
      </div>
    </div>
  );
}
