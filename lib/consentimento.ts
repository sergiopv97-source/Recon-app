// Texto do termo de consentimento LGPD, mostrado no cadastro do atleta.
// Fonte: termo redigido pelo responsável (Sergio Vargas), com o contato
// preenchido. Não é um substituto de revisão jurídica.

export interface SecaoTermo {
  titulo: string;
  paragrafos?: string[];
  itens?: string[];
}

export const TERMO_TITULO = "Termo de Consentimento — Monitoramento de Carga e Recuperação (Recon)";

export const TERMO_CABECALHO = "Responsável: Sergio Vargas — Fisioterapeuta · Local: Santa Maria/RS";

export const TERMO_SECOES: SecaoTermo[] = [
  {
    titulo: "O que é",
    paragrafos: [
      "O Recon é uma ferramenta de acompanhamento usada pelo fisioterapeuta Sergio Vargas para monitorar a carga de treino/jogo e os sinais de recuperação dos atletas atendidos, com o objetivo de reduzir o risco de lesão e orientar estratégias de recovery.",
    ],
  },
  {
    titulo: "Dados coletados",
    itens: [
      "Minutos jogados/treinados, distância e tempo (quando aplicável), esforço percebido (RPE)",
      "Qualidade e horas de sono",
      "Fadiga e estresse percebido",
      "Presença e intensidade de dor, e região do corpo (quando houver)",
      "Sensação de recuperação",
      "Registros de lesão ou doença, quando ocorrerem",
      "Dados cadastrais básicos: idade, peso, altura, posição/prova principal, histórico de lesão prévia",
    ],
  },
  {
    titulo: "Finalidade",
    paragrafos: [
      "Esses dados são usados exclusivamente para calcular indicadores de carga e recuperação e orientar decisões de treino e recovery do atleta junto ao fisioterapeuta responsável. Não são usados para nenhuma outra finalidade.",
    ],
  },
  {
    titulo: "Quem tem acesso",
    paragrafos: [
      "Os dados individuais completos são acessados apenas por Sergio Vargas, responsável pelo acompanhamento. O atleta tem acesso aos seus próprios dados e a orientações gerais de autocuidado baseadas neles.",
    ],
  },
  {
    titulo: "Armazenamento",
    paragrafos: [
      "Os dados ficam armazenados de forma associada ao nome do atleta, para permitir o acompanhamento contínuo da carga e da recuperação ao longo do tempo.",
    ],
  },
  {
    titulo: "Seus direitos",
    paragrafos: ["De acordo com a Lei Geral de Proteção de Dados (LGPD), você pode, a qualquer momento:"],
    itens: [
      "Solicitar acesso aos seus dados",
      "Solicitar correção de dados incorretos",
      "Solicitar a exclusão dos seus dados",
      "Revogar este consentimento e interromper sua participação, sem qualquer prejuízo",
    ],
  },
  {
    titulo: "Participação voluntária",
    paragrafos: [
      "A participação neste acompanhamento é voluntária. Você pode encerrar sua participação a qualquer momento, bastando comunicar o responsável.",
    ],
  },
];

export const TERMO_CONTATO = "Contato do responsável: Sergio Vargas — (55) 99620-6746 · sergiopv97@gmail.com";

export const TERMO_DECLARACAO =
  "Declaro que li e compreendi as informações acima, e concordo com a coleta e uso dos meus dados para os fins descritos neste termo.";
