"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Charge,
  ChargeDisplayStatus,
  DatabaseSnapshot,
  FormaPagamento,
  Patient,
  Profile,
  Treatment,
} from "./types";
import { previewInstallments, type InstallmentPreview } from "./installments";
import { isOverdue, todayISO } from "./date";

export function getDisplayStatus(charge: Charge): ChargeDisplayStatus {
  if (charge.status === "pago") return "pago";
  if (isOverdue(charge.data_vencimento)) return "atrasado";
  return "pendente";
}

type StoreCtx = {
  ready: boolean;
  db: DatabaseSnapshot;
  currentUser: Profile;
  // patients
  createPatient: (input: Omit<Patient, "id" | "created_at" | "created_by" | "ativo">) => Promise<Patient>;
  updatePatient: (id: string, patch: Partial<Patient>) => Promise<void>;
  deletePatient: (id: string) => Promise<void>;
  // treatments
  createTreatment: (
    input: Omit<Treatment, "id" | "created_at" | "created_by" | "status">
  ) => Promise<{ treatment: Treatment; charges: Charge[] }>;
  cancelTreatment: (id: string) => Promise<void>;
  deleteTreatment: (id: string) => Promise<void>;
  // charges
  markChargePaid: (
    id: string,
    info: { data_pagamento: string; forma_pagamento: FormaPagamento }
  ) => Promise<void>;
  revertCharge: (id: string) => Promise<void>;
  updateChargeAmount: (id: string, valor_centavos: number) => Promise<void>;
  // users
  createUser: (input: { nome: string; email: string; role: string; senha: string }) => Promise<void>;
  updateUser: (id: string, patch: Partial<Profile>) => Promise<void>;
  // utils
  previewInstallmentsFor: typeof previewInstallments;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<StoreCtx | null>(null);

const FALLBACK_USER: Profile = {
  id: "",
  nome: "Carregando...",
  email: "",
  role: "profissional",
  ativo: true,
  created_at: "",
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const supabase = createClient();
  const [db, setDB] = useState<DatabaseSnapshot>({
    profiles: [],
    patients: [],
    treatments: [],
    charges: [],
    currentUserId: "",
  });
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const [
      { data: profiles },
      { data: patients },
      { data: treatments },
      { data: charges },
      { data: { user } },
    ] = await Promise.all([
      supabase.from("profiles").select("*").order("nome"),
      supabase.from("patients").select("*").order("nome"),
      supabase.from("treatments").select("*").order("created_at", { ascending: false }),
      supabase.from("charges").select("*").order("data_vencimento"),
      supabase.auth.getUser(),
    ]);

    setDB({
      profiles: profiles ?? [],
      patients: patients ?? [],
      treatments: treatments ?? [],
      charges: charges ?? [],
      currentUserId: user?.id ?? "",
    });
  }, [supabase]);

  useEffect(() => {
    refresh().finally(() => setReady(true));
  }, [refresh]);

  const currentUser = useMemo(
    () => db.profiles.find((p) => p.id === db.currentUserId) ?? FALLBACK_USER,
    [db]
  );

  const createPatient: StoreCtx["createPatient"] = useCallback(
    async (input) => {
      const { data, error } = await supabase
        .from("patients")
        .insert({ ...input, created_by: db.currentUserId })
        .select()
        .single();
      if (error) throw error;
      await refresh();
      return data;
    },
    [supabase, db.currentUserId, refresh]
  );

  const updatePatient: StoreCtx["updatePatient"] = useCallback(
    async (id, patch) => {
      const { error } = await supabase.from("patients").update(patch).eq("id", id);
      if (error) throw error;
      await refresh();
    },
    [supabase, refresh]
  );

  const deletePatient: StoreCtx["deletePatient"] = useCallback(
    async (id) => {
      const { error } = await supabase.from("patients").delete().eq("id", id);
      if (error) throw error;
      await refresh();
    },
    [supabase, refresh]
  );

  const createTreatment: StoreCtx["createTreatment"] = useCallback(
    async (input) => {
      const { data: treatmentId, error } = await supabase.rpc(
        "criar_tratamento_com_parcelas",
        {
          p_patient_id: input.patient_id,
          p_profissional_id: input.profissional_id,
          p_procedimento: input.procedimento,
          p_forma_pagamento: input.forma_pagamento,
          p_tipo_cobranca: input.tipo_cobranca,
          p_periodicidade: input.periodicidade ?? null,
          p_num_parcelas: input.num_parcelas,
          p_valor_parcela_centavos: input.valor_parcela_centavos,
          p_data_inicio: input.data_inicio,
          p_observacoes: input.observacoes ?? null,
        }
      );
      if (error) throw error;

      const [{ data: treatment }, { data: charges }] = await Promise.all([
        supabase.from("treatments").select("*").eq("id", treatmentId).single(),
        supabase.from("charges").select("*").eq("treatment_id", treatmentId).order("numero_parcela"),
      ]);

      await refresh();
      return { treatment: treatment!, charges: charges ?? [] };
    },
    [supabase, refresh]
  );

  const cancelTreatment: StoreCtx["cancelTreatment"] = useCallback(
    async (id) => {
      const { error } = await supabase.from("treatments").update({ status: "cancelado" }).eq("id", id);
      if (error) throw error;
      await refresh();
    },
    [supabase, refresh]
  );

  const deleteTreatment: StoreCtx["deleteTreatment"] = useCallback(
    async (id) => {
      const { error } = await supabase.from("treatments").delete().eq("id", id);
      if (error) throw error;
      await refresh();
    },
    [supabase, refresh]
  );

  const markChargePaid: StoreCtx["markChargePaid"] = useCallback(
    async (id, info) => {
      const { error } = await supabase.rpc("dar_baixa_cobranca", {
        p_charge_id: id,
        p_data_pagamento: info.data_pagamento,
        p_forma_pagamento: info.forma_pagamento,
      });
      if (error) throw error;
      await refresh();
    },
    [supabase, refresh]
  );

  const revertCharge: StoreCtx["revertCharge"] = useCallback(
    async (id) => {
      const { error } = await supabase.rpc("estornar_baixa_cobranca", { p_charge_id: id });
      if (error) throw error;
      await refresh();
    },
    [supabase, refresh]
  );

  const updateChargeAmount: StoreCtx["updateChargeAmount"] = useCallback(
    async (id, valor_centavos) => {
      const { error } = await supabase.from("charges").update({ valor_centavos }).eq("id", id);
      if (error) throw error;
      await refresh();
    },
    [supabase, refresh]
  );

  const createUser: StoreCtx["createUser"] = useCallback(
    async (input) => {
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Erro ao criar usuário");
      }
      await refresh();
    },
    [refresh]
  );

  const updateUser: StoreCtx["updateUser"] = useCallback(
    async (id, patch) => {
      const { error } = await supabase.from("profiles").update(patch).eq("id", id);
      if (error) throw error;
      await refresh();
    },
    [supabase, refresh]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }, [supabase]);

  const value: StoreCtx = {
    ready,
    db,
    currentUser,
    createPatient,
    updatePatient,
    deletePatient,
    createTreatment,
    cancelTreatment,
    deleteTreatment,
    markChargePaid,
    revertCharge,
    updateChargeAmount,
    createUser,
    updateUser,
    previewInstallmentsFor: previewInstallments,
    refresh,
    signOut,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore deve ser usado dentro do StoreProvider");
  return ctx;
}

export { todayISO };
