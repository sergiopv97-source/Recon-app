import { toneColor, type Alerta } from "@/lib/recon";

export default function Badge({ alerta }: { alerta: Alerta | null | undefined }) {
  if (!alerta) return <span style={{ color: "#93A19E", fontSize: 13 }}>—</span>;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 13,
        fontWeight: 600,
        color: toneColor[alerta.tone],
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: toneColor[alerta.tone],
          display: "inline-block",
        }}
      />
      {alerta.label}
    </span>
  );
}
