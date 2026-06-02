"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { useStore, todayISO } from "@/lib/store";
import { previewInstallments } from "@/lib/installments";
import { brlInputToCents, centsToBRL } from "@/lib/money";
import { formatDateBR } from "@/lib/date";
import type { FormaPagamento, Periodicidade, TipoCobranca } from "@/lib/types";
import { ROLE_LABEL } from "@/lib/permissions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
};

export function TreatmentFormDialog({ open, onOpenChange, patientId }: Props) {
  const { db, createTreatment } = useStore();

  const [procedimento, setProcedimento] = useState("");
  const [profissionalId, setProfissionalId] = useState<string>("");
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>("pix");
  const [tipoCobranca, setTipoCobranca] = useState<TipoCobranca>("recorrente");
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>("mensal");
  const [numParcelas, setNumParcelas] = useState<number>(4);
  const [valorParcela, setValorParcela] = useState<string>("0,00");
  const [dataInicio, setDataInicio] = useState<string>(todayISO());
  const [observacoes, setObservacoes] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setProcedimento("");
      setProfissionalId("");
      setFormaPagamento("pix");
      setTipoCobranca("recorrente");
      setPeriodicidade("mensal");
      setNumParcelas(4);
      setValorParcela("0,00");
      setDataInicio(todayISO());
      setObservacoes("");
      setErro(null);
    }
  }, [open]);

  const valorCentavos = brlInputToCents(valorParcela);
  const totalParcelas = tipoCobranca === "avista" ? 1 : numParcelas;

  const preview = useMemo(() => {
    if (!dataInicio || valorCentavos <= 0) return [];
    return previewInstallments({
      tipo_cobranca: tipoCobranca,
      periodicidade: tipoCobranca === "recorrente" ? periodicidade : null,
      num_parcelas: totalParcelas,
      valor_parcela_centavos: valorCentavos,
      data_inicio: dataInicio,
    });
  }, [tipoCobranca, periodicidade, totalParcelas, valorCentavos, dataInicio]);

  const total = preview.reduce((acc, p) => acc + p.valor_centavos, 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!procedimento.trim()) {
      setErro("Descreva o procedimento");
      return;
    }
    if (valorCentavos <= 0) {
      setErro("Informe o valor da parcela");
      return;
    }
    if (tipoCobranca === "recorrente" && (numParcelas < 1 || numParcelas > 120)) {
      setErro("Número de parcelas inválido (1 a 120)");
      return;
    }
    if (!dataInicio) {
      setErro("Informe a data de início");
      return;
    }

    setSaving(true);
    try {
      await createTreatment({
        patient_id: patientId,
        profissional_id: profissionalId || null,
        procedimento: procedimento.trim(),
        forma_pagamento: formaPagamento,
        tipo_cobranca: tipoCobranca,
        periodicidade: tipoCobranca === "recorrente" ? periodicidade : null,
        num_parcelas: totalParcelas,
        valor_parcela_centavos: valorCentavos,
        data_inicio: dataInicio,
        observacoes: observacoes.trim() || undefined,
      });
      onOpenChange(false);
    } catch (err) {
      setErro("Erro ao criar tratamento. Tente novamente.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo tratamento</DialogTitle>
          <DialogDescription>
            Os vencimentos das parcelas serão gerados automaticamente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="procedimento">Procedimento *</Label>
            <Input
              id="procedimento"
              value={procedimento}
              onChange={(e) => setProcedimento(e.target.value)}
              placeholder="Ex: Limpeza dentária"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="profissional">Profissional responsável</Label>
              <Select
                id="profissional"
                value={profissionalId}
                onChange={(e) => setProfissionalId(e.target.value)}
              >
                <option value="">— Não atribuído —</option>
                {db.profiles.filter((p) => p.ativo).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} ({ROLE_LABEL[p.role]})
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="forma">Forma de pagamento *</Label>
              <Select
                id="forma"
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value as FormaPagamento)}
              >
                <option value="pix">PIX</option>
                <option value="credito">Crédito</option>
                <option value="especie">Espécie</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tipo">Tipo de cobrança *</Label>
              <Select
                id="tipo"
                value={tipoCobranca}
                onChange={(e) => setTipoCobranca(e.target.value as TipoCobranca)}
              >
                <option value="avista">À vista</option>
                <option value="recorrente">Recorrente</option>
              </Select>
            </div>
            {tipoCobranca === "recorrente" && (
              <div className="space-y-1.5">
                <Label htmlFor="periodicidade">Periodicidade *</Label>
                <Select
                  id="periodicidade"
                  value={periodicidade}
                  onChange={(e) => setPeriodicidade(e.target.value as Periodicidade)}
                >
                  <option value="semanal">Semanal</option>
                  <option value="mensal">Mensal</option>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="parcelas">
                {tipoCobranca === "avista" ? "Parcelas" : "Nº parcelas *"}
              </Label>
              <Input
                id="parcelas"
                type="number"
                min={1}
                max={120}
                value={tipoCobranca === "avista" ? 1 : numParcelas}
                disabled={tipoCobranca === "avista"}
                onChange={(e) => setNumParcelas(Number(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="valor">Valor por parcela *</Label>
              <Input
                id="valor"
                value={valorParcela}
                onChange={(e) => setValorParcela(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="data">Data de início *</Label>
              <Input
                id="data"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obs">Observações</Label>
            <Textarea
              id="obs"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
            />
          </div>

          {preview.length > 0 && (
            <div className="rounded-md border bg-muted/30 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium">Preview das parcelas</p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Total:</span>{" "}
                  <span className="font-semibold">{centsToBRL(total)}</span>
                </p>
              </div>
              <div className="max-h-48 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left py-1 font-normal">Nº</th>
                      <th className="text-left py-1 font-normal">Vencimento</th>
                      <th className="text-right py-1 font-normal">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((p) => (
                      <tr key={p.numero_parcela} className="border-t">
                        <td className="py-1.5">{p.numero_parcela}</td>
                        <td className="py-1.5">{formatDateBR(p.data_vencimento)}</td>
                        <td className="py-1.5 text-right font-medium">
                          {centsToBRL(p.valor_centavos)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Criando..." : "Criar tratamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
