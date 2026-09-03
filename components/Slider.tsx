export default function Slider({
  label,
  value,
  onChange,
  min,
  max,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  hint?: string;
}) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <label style={{ fontSize: 15, color: "#14201F", fontWeight: 500 }}>{label}</label>
        <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 22, color: "#297379", fontWeight: 600 }}>{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "#297379" }}
      />
      {hint && <div style={{ fontSize: 12, color: "#5B6664", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}
