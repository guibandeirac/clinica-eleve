"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useStore, todayISO } from "@/lib/store";
import { centsToBRL } from "@/lib/money";
import { formatDateBR } from "@/lib/date";
import type { Charge, FormaPagamento } from "@/lib/types";

type Props = {
  charge: Charge | null;
  onOpenChange: (open: boolean) => void;
};

export function MarkPaidDialog({ charge, onOpenChange }: Props) {
  const { db, markChargePaid } = useStore();
  const [data, setData] = useState(todayISO());
  const [forma, setForma] = useState<FormaPagamento>("pix");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (charge) {
      setData(todayISO());
      setForma(charge.forma_pagamento);
      setErro(null);
    }
  }, [charge]);

  if (!charge) return null;

  const treatment = db.treatments.find((t) => t.id === charge.treatment_id);
  const patient = treatment && db.patients.find((p) => p.id === treatment.patient_id);

  async function handleConfirmar() {
    if (!charge) return;
    setSaving(true);
    try {
      await markChargePaid(charge.id, { data_pagamento: data, forma_pagamento: forma });
      onOpenChange(false);
    } catch (err) {
      setErro("Erro ao registrar baixa. Tente novamente.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!charge} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>Confirmar baixa</DialogTitle>
          <DialogDescription>
            Marcar parcela como paga e registrar a forma de pagamento usada.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border bg-muted/30 p-3 mb-4 text-sm space-y-1">
          <p>
            <span className="text-muted-foreground">Paciente:</span>{" "}
            <span className="font-medium">{patient?.nome}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Procedimento:</span>{" "}
            {treatment?.procedimento}
          </p>
          <p>
            <span className="text-muted-foreground">Parcela:</span>{" "}
            {charge.numero_parcela}/{treatment?.num_parcelas} ·{" "}
            <span className="font-semibold">{centsToBRL(charge.valor_centavos)}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Vencimento:</span>{" "}
            {formatDateBR(charge.data_vencimento)}
          </p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="data-pagamento">Data do pagamento</Label>
            <Input
              id="data-pagamento"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="forma-pagamento">Forma de pagamento</Label>
            <Select
              id="forma-pagamento"
              value={forma}
              onChange={(e) => setForma(e.target.value as FormaPagamento)}
            >
              <option value="pix">PIX</option>
              <option value="credito">Crédito</option>
              <option value="especie">Espécie</option>
            </Select>
          </div>
        </div>

        {erro && <p className="text-sm text-destructive">{erro}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="success" onClick={handleConfirmar} disabled={saving}>
            {saving ? "Registrando..." : "Confirmar baixa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
