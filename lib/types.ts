export type Role = "admin" | "recepcao" | "profissional";

export type Profile = {
  id: string;
  nome: string;
  email: string;
  role: Role;
  ativo: boolean;
  created_at: string;
};

export type Patient = {
  id: string;
  nome: string;
  telefone?: string;
  cpf?: string;
  observacoes?: string;
  ativo: boolean;
  created_at: string;
  created_by: string;
};

export type FormaPagamento = "credito" | "pix" | "especie";
export type TipoCobranca = "avista" | "recorrente";
export type Periodicidade = "semanal" | "mensal";
export type TreatmentStatus = "ativo" | "concluido" | "cancelado";

export type Treatment = {
  id: string;
  patient_id: string;
  profissional_id: string | null;
  procedimento: string;
  forma_pagamento: FormaPagamento;
  tipo_cobranca: TipoCobranca;
  periodicidade: Periodicidade | null;
  num_parcelas: number;
  valor_parcela_centavos: number;
  entrada_centavos: number;
  data_inicio: string; // ISO date (YYYY-MM-DD)
  status: TreatmentStatus;
  observacoes?: string;
  created_at: string;
  created_by: string;
};

export type ChargeStatus = "pendente" | "pago";
export type ChargeDisplayStatus = "pendente" | "pago" | "atrasado";

export type Charge = {
  id: string;
  treatment_id: string;
  numero_parcela: number;
  valor_centavos: number;
  data_vencimento: string;
  forma_pagamento: FormaPagamento;
  status: ChargeStatus;
  data_pagamento: string | null;
  baixado_por: string | null;
  created_at: string;
};

export type DatabaseSnapshot = {
  profiles: Profile[];
  patients: Patient[];
  treatments: Treatment[];
  charges: Charge[];
  currentUserId: string;
};
