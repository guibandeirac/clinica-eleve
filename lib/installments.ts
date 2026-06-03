import { addDaysISO, addMonthsISO } from "./date";
import type { Treatment, Charge } from "./types";

export type InstallmentPreview = {
  numero_parcela: number;
  data_vencimento: string;
  valor_centavos: number;
  is_entrada?: boolean;
};

export function previewInstallments(input: {
  tipo_cobranca: Treatment["tipo_cobranca"];
  periodicidade: Treatment["periodicidade"];
  num_parcelas: number;
  valor_parcela_centavos: number;
  data_inicio: string;
  entrada_centavos?: number;
}): InstallmentPreview[] {
  const { tipo_cobranca, periodicidade, num_parcelas, valor_parcela_centavos, data_inicio, entrada_centavos = 0 } = input;
  const hasEntrada = entrada_centavos > 0;
  const total = tipo_cobranca === "avista" ? 1 : Math.max(1, num_parcelas);
  const previews: InstallmentPreview[] = [];

  if (hasEntrada) {
    previews.push({
      numero_parcela: 1,
      data_vencimento: data_inicio,
      valor_centavos: entrada_centavos,
      is_entrada: true,
    });
  }

  for (let i = 0; i < total; i++) {
    const numero = i + 1 + (hasEntrada ? 1 : 0);
    let data = data_inicio;
    if (tipo_cobranca === "recorrente") {
      const shift = hasEntrada ? i + 1 : i;
      if (shift > 0) {
        if (periodicidade === "semanal") {
          data = addDaysISO(data_inicio, shift * 7);
        } else if (periodicidade === "mensal") {
          data = addMonthsISO(data_inicio, shift);
        }
      }
    }
    previews.push({
      numero_parcela: numero,
      data_vencimento: data,
      valor_centavos: valor_parcela_centavos,
    });
  }

  return previews;
}

export function buildCharges(treatmentId: string, previews: InstallmentPreview[], forma_pagamento: Treatment["forma_pagamento"]): Charge[] {
  const now = new Date().toISOString();
  return previews.map((p) => ({
    id: crypto.randomUUID(),
    treatment_id: treatmentId,
    numero_parcela: p.numero_parcela,
    valor_centavos: p.valor_centavos,
    data_vencimento: p.data_vencimento,
    forma_pagamento,
    status: "pendente" as const,
    data_pagamento: null,
    baixado_por: null,
    created_at: now,
  }));
}
