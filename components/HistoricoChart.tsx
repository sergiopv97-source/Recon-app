"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { rotuloPeriodo, type CheckinComputed } from "@/lib/recon";

export interface MarcadorHistorico {
  id: string;
  data: string;
  label: string;
}

// Gráfico de carga sRPE + índice de recuperação ao longo do tempo. Usado
// tanto no painel do treinador (com marcadores de lesão/doença) quanto na
// tela do próprio atleta (sem marcadores — ele não vê registros de lesão).
export default function HistoricoChart({ serie, marcadores }: { serie: CheckinComputed[]; marcadores?: MarcadorHistorico[] }) {
  if (serie.length < 2) return null;

  return (
    <div style={{ height: 160, marginBottom: 16 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={serie.map((e) => ({ x: rotuloPeriodo(e), carga: e.carga, indice: e.indice }))}>
          <CartesianGrid stroke="#E7ECEA" strokeDasharray="3 3" />
          <XAxis dataKey="x" stroke="#5B6664" fontSize={11} />
          <YAxis stroke="#5B6664" fontSize={11} />
          <Tooltip contentStyle={{ background: "#FFFFFF", border: "1px solid #DCE3E1", fontSize: 12 }} />
          <Line type="monotone" dataKey="carga" stroke="#297379" strokeWidth={2} dot={false} name="Carga sRPE" />
          <Line type="monotone" dataKey="indice" stroke="#2C7FB0" strokeWidth={2} dot={false} name="Índice recuperação" />
          {marcadores
            ?.filter((m) => serie.some((e) => rotuloPeriodo(e) === rotuloPeriodo({ data: m.data })))
            .map((m) => (
              <ReferenceLine
                key={m.id}
                x={rotuloPeriodo({ data: m.data })}
                stroke="#B23A32"
                strokeDasharray="4 2"
                label={{ value: m.label, position: "top", fill: "#B23A32", fontSize: 10 }}
              />
            ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
