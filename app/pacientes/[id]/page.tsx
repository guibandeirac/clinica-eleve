"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Edit, Plus, Power, Trash2, Stethoscope } from "lucide-react";
import { useStore, getDisplayStatus } from "@/lib/store";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PatientFormDialog } from "@/components/patient-form-dialog";
import { TreatmentFormDialog } from "@/components/treatment-form-dialog";
import { centsToBRL } from "@/lib/money";
import { formatDateBR } from "@/lib/date";
import { ChargeStatusBadge, FormaPagamentoBadge, TreatmentStatusBadge } from "@/components/status-badge";
import { can } from "@/lib/permissions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function PacienteDetalhePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { db, currentUser, updatePatient, deletePatient, cancelTreatment, deleteTreatment } = useStore();

  const [editOpen, setEditOpen] = useState(false);
  const [treatmentOpen, setTreatmentOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCancelTreatment, setConfirmCancelTreatment] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const paciente = db.patients.find((p) => p.id === params.id);

  const tratamentos = useMemo(
    () =>
      db.treatments
        .filter((t) => t.patient_id === params.id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [db.treatments, params.id]
  );

  const cobrancas = useMemo(() => {
    const tids = new Set(tratamentos.map((t) => t.id));
    return db.charges
      .filter((c) => tids.has(c.treatment_id))
      .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));
  }, [db.charges, tratamentos]);

  if (!paciente) {
    return (
      <div>
        <Link
          href="/pacientes"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <p>Paciente não encontrado.</p>
      </div>
    );
  }

  const totais = {
    total: cobrancas.reduce((acc, c) => acc + c.valor_centavos, 0),
    pago: cobrancas.filter((c) => c.status === "pago").reduce((acc, c) => acc + c.valor_centavos, 0),
    pendente: cobrancas.filter((c) => c.status === "pendente").reduce((acc, c) => acc + c.valor_centavos, 0),
  };

  const podeEditar = can("patient.edit", currentUser.role);
  const podeExcluir = can("patient.delete", currentUser.role);
  const podeCriarTratamento = can("treatment.create", currentUser.role);
  const podeExcluirTratamento = can("treatment.delete", currentUser.role);

  async function handleToggleAtivo() {
    setLoadingAction("ativo");
    try {
      await updatePatient(paciente!.id, { ativo: !paciente!.ativo });
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleDeletePatient() {
    setLoadingAction("delete");
    try {
      await deletePatient(paciente!.id);
      router.push("/pacientes");
    } finally {
      setLoadingAction(null);
      setConfirmDelete(false);
    }
  }

  async function handleCancelTreatment() {
    if (!confirmCancelTreatment) return;
    setLoadingAction("cancelTreatment");
    try {
      await cancelTreatment(confirmCancelTreatment);
    } finally {
      setLoadingAction(null);
      setConfirmCancelTreatment(null);
    }
  }

  async function handleDeleteTreatment(id: string) {
    if (!confirm("Excluir este tratamento e todas as parcelas?")) return;
    setLoadingAction(`deleteTreatment-${id}`);
    try {
      await deleteTreatment(id);
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div>
      <Link
        href="/pacientes"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Pacientes
      </Link>

      <PageHeader
        title={paciente.nome}
        description={paciente.ativo ? "Paciente ativo" : "Paciente inativo"}
        actions={
          <div className="flex items-center gap-2">
            {podeEditar && (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Edit className="h-4 w-4" /> Editar
              </Button>
            )}
            {podeEditar && (
              <Button
                variant="outline"
                onClick={handleToggleAtivo}
                disabled={loadingAction === "ativo"}
              >
                <Power className="h-4 w-4" /> {paciente.ativo ? "Desativar" : "Reativar"}
              </Button>
            )}
            {podeExcluir && (
              <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4" /> Excluir
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-normal">Dados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <div>
              <span className="text-muted-foreground">Telefone:</span>{" "}
              <span className="font-medium">{paciente.telefone ?? "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">CPF:</span>{" "}
              <span className="font-medium">{paciente.cpf ?? "—"}</span>
            </div>
            {paciente.observacoes && (
              <div className="pt-2 mt-2 border-t">
                <p className="text-muted-foreground text-xs mb-1">Observações</p>
                <p className="text-sm whitespace-pre-wrap">{paciente.observacoes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-normal">Valor pago</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-success">{centsToBRL(totais.pago)}</p>
            <p className="text-xs text-muted-foreground mt-1">de {centsToBRL(totais.total)} no total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-normal">A receber</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{centsToBRL(totais.pendente)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {cobrancas.filter((c) => c.status === "pendente").length} parcelas em aberto
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Tratamentos</CardTitle>
          {podeCriarTratamento && (
            <Button onClick={() => setTreatmentOpen(true)} size="sm">
              <Plus className="h-4 w-4" /> Novo tratamento
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {tratamentos.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-3">
              <Stethoscope className="h-8 w-8 text-muted-foreground/50" />
              <p>Nenhum tratamento registrado.</p>
              {podeCriarTratamento && (
                <Button onClick={() => setTreatmentOpen(true)} variant="outline" size="sm">
                  <Plus className="h-4 w-4" /> Adicionar tratamento
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Procedimento</TableHead>
                  <TableHead>Forma</TableHead>
                  <TableHead>Parcelas</TableHead>
                  <TableHead>Valor total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tratamentos.map((t) => {
                  const total = t.num_parcelas * t.valor_parcela_centavos;
                  const isDeleting = loadingAction === `deleteTreatment-${t.id}`;
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">
                        {t.procedimento}
                        <p className="text-xs text-muted-foreground font-normal mt-0.5">
                          Início {formatDateBR(t.data_inicio)} ·{" "}
                          {t.tipo_cobranca === "avista"
                            ? "à vista"
                            : `${t.periodicidade === "semanal" ? "semanal" : "mensal"}`}
                        </p>
                      </TableCell>
                      <TableCell>
                        <FormaPagamentoBadge forma={t.forma_pagamento} />
                      </TableCell>
                      <TableCell>
                        {t.num_parcelas}× {centsToBRL(t.valor_parcela_centavos)}
                      </TableCell>
                      <TableCell className="font-medium">{centsToBRL(total)}</TableCell>
                      <TableCell>
                        <TreatmentStatusBadge status={t.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {t.status === "ativo" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setConfirmCancelTreatment(t.id)}
                              disabled={loadingAction === "cancelTreatment"}
                            >
                              Cancelar
                            </Button>
                          )}
                          {podeExcluirTratamento && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isDeleting}
                              onClick={() => handleDeleteTreatment(t.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de cobranças</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Procedimento</TableHead>
                <TableHead>Parcela</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Forma</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pago em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cobrancas.length === 0 ? (
                <TableEmpty colSpan={7}>Nenhuma cobrança ainda.</TableEmpty>
              ) : (
                cobrancas.map((c) => {
                  const t = tratamentos.find((x) => x.id === c.treatment_id);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="text-sm">{t?.procedimento}</TableCell>
                      <TableCell>
                        {c.numero_parcela}/{t?.num_parcelas}
                      </TableCell>
                      <TableCell>{formatDateBR(c.data_vencimento)}</TableCell>
                      <TableCell>{centsToBRL(c.valor_centavos)}</TableCell>
                      <TableCell>
                        <FormaPagamentoBadge forma={c.forma_pagamento} />
                      </TableCell>
                      <TableCell>
                        <ChargeStatusBadge status={getDisplayStatus(c)} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.data_pagamento ? formatDateBR(c.data_pagamento) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PatientFormDialog open={editOpen} onOpenChange={setEditOpen} patient={paciente} />

      <TreatmentFormDialog
        open={treatmentOpen}
        onOpenChange={setTreatmentOpen}
        patientId={paciente.id}
      />

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent onClose={() => setConfirmDelete(false)}>
          <DialogHeader>
            <DialogTitle>Excluir paciente?</DialogTitle>
            <DialogDescription>
              Esta ação remove o paciente e todos os seus tratamentos e cobranças. Não pode ser
              desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={loadingAction === "delete"}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeletePatient}
              disabled={loadingAction === "delete"}
            >
              {loadingAction === "delete" ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!confirmCancelTreatment}
        onOpenChange={(o) => !o && setConfirmCancelTreatment(null)}
      >
        <DialogContent onClose={() => setConfirmCancelTreatment(null)}>
          <DialogHeader>
            <DialogTitle>Cancelar tratamento?</DialogTitle>
            <DialogDescription>
              O tratamento ficará marcado como cancelado e suas parcelas pendentes deixarão de
              aparecer na fila de cobranças. O histórico das parcelas já pagas é preservado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmCancelTreatment(null)}
              disabled={loadingAction === "cancelTreatment"}
            >
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelTreatment}
              disabled={loadingAction === "cancelTreatment"}
            >
              {loadingAction === "cancelTreatment" ? "Cancelando..." : "Cancelar tratamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
