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

type PixModalidade = "avista" | "parcelado" | "entrada_parcelado";
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
  // Crédito-specific
  const [creditoModalidade, setCreditoModalidade] = useState<"avista" | "parcelado">("avista");
  const [valorTotalCredito, setValorTotalCredito] = useState<string>("0,00");
  // PIX-specific
  const [pixModalidade, setPixModalidade] = useState<PixModalidade>("avista");
  const [valorEntrada, setValorEntrada] = useState<string>("0,00");
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
      setCreditoModalidade("avista");
      setValorTotalCredito("0,00");
      setPixModalidade("avista");
      setValorEntrada("0,00");
      setDataInicio(todayISO());
      setObservacoes("");
      setErro(null);
    }
  }, [open]);

  const isCredito = formaPagamento === "credito";
  const isPix = formaPagamento === "pix";

  // Valores efetivos para preview e submit
  const valorParcelaCentavos = brlInputToCents(valorParcela);
  const valorEntradaCentavos = brlInputToCents(valorEntrada);
  const valorTotalCreditoCentavos = brlInputToCents(valorTotalCredito);
  const creditoNumParcelas = creditoModalidade === "parcelado" ? numParcelas : 1;

  const efetivTipoCobranca: TipoCobranca = isCredito
    ? (creditoModalidade === "parcelado" ? "recorrente" : "avista")
    : isPix
      ? (pixModalidade === "avista" ? "avista" : "recorrente")
      : tipoCobranca;
  const efetivNumParcelas = isCredito
    ? creditoNumParcelas
    : isPix
      ? (pixModalidade === "avista" ? 1 : numParcelas)
      : (tipoCobranca === "avista" ? 1 : numParcelas);
  const efetivValorCentavos = isCredito
    ? (creditoNumParcelas > 0 ? Math.round(valorTotalCreditoCentavos / creditoNumParcelas) : 0)
    : valorParcelaCentavos;
  const efetivEntradaCentavos = isPix && pixModalidade === "entrada_parcelado"
    ? valorEntradaCentavos
    : 0;

  const preview = useMemo(() => {
    if (!dataInicio || efetivValorCentavos <= 0) return [];
    return previewInstallments({
      tipo_cobranca: efetivTipoCobranca,
      periodicidade: efetivTipoCobranca === "recorrente" ? periodicidade : null,
      num_parcelas: efetivNumParcelas,
      valor_parcela_centavos: efetivValorCentavos,
      data_inicio: dataInicio,
      entrada_centavos: efetivEntradaCentavos,
    });
  }, [efetivTipoCobranca, periodicidade, efetivNumParcelas, efetivValorCentavos, dataInicio, efetivEntradaCentavos]);

  const total = preview.reduce((acc, p) => acc + p.valor_centavos, 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!procedimento.trim()) {
      setErro("Descreva o procedimento");
      return;
    }
    if (isCredito) {
      if (valorTotalCreditoCentavos <= 0) {
        setErro("Informe o valor total");
        return;
      }
      if (creditoModalidade === "parcelado" && (numParcelas < 2 || numParcelas > 120)) {
        setErro("Número de parcelas inválido (2 a 120)");
        return;
      }
    } else {
      if (valorParcelaCentavos <= 0) {
        setErro("Informe o valor da parcela");
        return;
      }
      const needsParcelas = isPix ? pixModalidade !== "avista" : tipoCobranca === "recorrente";
      if (needsParcelas && (numParcelas < 1 || numParcelas > 120)) {
        setErro("Número de parcelas inválido (1 a 120)");
        return;
      }
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
        tipo_cobranca: efetivTipoCobranca,
        periodicidade: efetivTipoCobranca === "recorrente" ? periodicidade : null,
        num_parcelas: efetivNumParcelas,
        valor_parcela_centavos: efetivValorCentavos,
        entrada_centavos: efetivEntradaCentavos,
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

          {isCredito ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="credito-modalidade">Modalidade *</Label>
                  <Select
                    id="credito-modalidade"
                    value={creditoModalidade}
                    onChange={(e) => setCreditoModalidade(e.target.value as "avista" | "parcelado")}
                  >
                    <option value="avista">À vista</option>
                    <option value="parcelado">Parcelado</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="valor-total">Valor total *</Label>
                  <Input
                    id="valor-total"
                    value={valorTotalCredito}
                    onChange={(e) => setValorTotalCredito(e.target.value)}
                    placeholder="0,00"
                  />
                </div>
              </div>

              {creditoModalidade === "parcelado" ? (
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="parcelas-credito">N° parcelas *</Label>
                    <Input
                      id="parcelas-credito"
                      type="number"
                      min={2}
                      max={120}
                      value={numParcelas}
                      onChange={(e) => setNumParcelas(Number(e.target.value) || 2)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Valor por parcela</Label>
                    <Input
                      value={efetivValorCentavos > 0 ? centsToBRL(efetivValorCentavos) : "0,00"}
                      readOnly
                      className="bg-muted text-muted-foreground"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="data">Data 1ª parcela *</Label>
                    <Input
                      id="data"
                      type="date"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="data">Data de pagamento *</Label>
                    <Input
                      id="data"
                      type="date"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </>
          ) : isPix ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pix-modalidade">Modalidade *</Label>
                  <Select
                    id="pix-modalidade"
                    value={pixModalidade}
                    onChange={(e) => setPixModalidade(e.target.value as PixModalidade)}
                  >
                    <option value="avista">À vista</option>
                    <option value="parcelado">Parcelado</option>
                    <option value="entrada_parcelado">Entrada + Parcelado</option>
                  </Select>
                </div>
                {pixModalidade !== "avista" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="periodicidade-pix">Periodicidade *</Label>
                    <Select
                      id="periodicidade-pix"
                      value={periodicidade}
                      onChange={(e) => setPeriodicidade(e.target.value as Periodicidade)}
                    >
                      <option value="semanal">Semanal</option>
                      <option value="mensal">Mensal</option>
                    </Select>
                  </div>
                )}
              </div>

              {pixModalidade === "avista" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="valor">Valor *</Label>
                    <Input
                      id="valor"
                      value={valorParcela}
                      onChange={(e) => setValorParcela(e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="data">Data de pagamento *</Label>
                    <Input
                      id="data"
                      type="date"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {pixModalidade === "parcelado" && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="parcelas">Nº parcelas *</Label>
                    <Input
                      id="parcelas"
                      type="number"
                      min={1}
                      max={120}
                      value={numParcelas}
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
              )}

              {pixModalidade === "entrada_parcelado" && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="parcelas">Nº parcelas *</Label>
                      <Input
                        id="parcelas"
                        type="number"
                        min={1}
                        max={120}
                        value={numParcelas}
                        onChange={(e) => setNumParcelas(Number(e.target.value) || 1)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="valor-entrada">Valor da entrada</Label>
                      <Input
                        id="valor-entrada"
                        value={valorEntrada}
                        onChange={(e) => setValorEntrada(e.target.value)}
                        placeholder="0,00"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="valor-parcela">Valor por parcela *</Label>
                      <Input
                        id="valor-parcela"
                        value={valorParcela}
                        onChange={(e) => setValorParcela(e.target.value)}
                        placeholder="0,00"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
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
                </>
              )}
            </>
          ) : (
            <>
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
            </>
          )}

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
                    {(() => {
                      const hasEntradaRow = preview[0]?.is_entrada ?? false;
                      return preview.map((p) => (
                        <tr key={p.numero_parcela} className="border-t">
                          <td className="py-1.5">
                            {p.is_entrada
                              ? <span className="text-xs font-semibold text-primary">Entrada</span>
                              : hasEntradaRow ? p.numero_parcela - 1 : p.numero_parcela}
                          </td>
                          <td className="py-1.5">{formatDateBR(p.data_vencimento)}</td>
                          <td className="py-1.5 text-right font-medium">
                            {centsToBRL(p.valor_centavos)}
                          </td>
                        </tr>
                      ));
                    })()}
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
