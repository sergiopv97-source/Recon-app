// Tokens visuais compartilhados — mesma identidade visual validada no
// protótipo (cor teal, tipografia Poppins/Work Sans).
import type { CSSProperties } from "react";

export { toneColor } from "@/lib/recon";

export const shellStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#F7F8F7",
  color: "#14201F",
  fontFamily: "'Work Sans', sans-serif",
  paddingBottom: 60,
};

export const inputStyle: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  background: "#FFFFFF",
  border: "1px solid #DCE3E1",
  borderRadius: 6,
  color: "#14201F",
  fontSize: 15,
  marginTop: 6,
};

export const cardStyle: CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #DCE3E1",
  borderRadius: 8,
  padding: "14px 16px",
};

export const primaryButtonStyle: CSSProperties = {
  padding: "14px",
  background: "#297379",
  border: "none",
  borderRadius: 6,
  color: "#F7F8F7",
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
};

export const FontImport = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700&family=Work+Sans:wght@400;500;600&display=swap');
    * { box-sizing: border-box; }
    body { margin: 0; }
    input[type=range] { height: 4px; }
    select, input[type=text], input[type=number] {
      font-family: 'Work Sans', sans-serif;
    }
  `}</style>
);
