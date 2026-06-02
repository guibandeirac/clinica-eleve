"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, CheckCircle2, RotateCcw, Receipt } from "lucide-react";
import { useStore, getDisplayStatus } from "@/lib/store";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { centsToBRL } from "@/lib/money";
import { formatDateBR, isThisWeek, isToday } from "@/lib/date";
import { ChargeStatusBadge, FormaPagamentoBadge } from "@/components/status-badge";
import { MarkPaidDialog } from "@/components/mark-paid-dialog";
import { can } from "@/lib/permissions";
import type { Charge, ChargeDisplayStatus, FormaPagamento } from "@/lib/types";
import { EmptyState } from "@/components/ui/empty-state";

type StatusFiltro = "todos" | "pendente" | "atrasado" | "pago";

export default function CobrancasPage() {
  const searchParams = useSearchParams();
  const { db, currentUser, revertCharge } = useStore();

  const initialStatus = (searchParams.get("status") as StatusFiltro) ?? "todos";

  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>(initialStatus);
  const [formaFiltro, setFormaFiltro] = useState<"todas" | FormaPagamento>("todas");
  const [profissionalFiltro, setProfissionalFiltro] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [marcandoPago, setMarcandoPago] = useState<Charge | null>(null);
  const [revertendo, setRevertendo] = useState<string | null>(null);

  const podeMarcarPago = can("charge.markPaid", currentUser.role);
  const podeReverter = can("charge.revert", currentUser.role);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return db.charges.filter((c) => {
      const treatment = db.treatments.find((t) => t.id === c.treatment_id);
      if (!treatment) return false;
      if (treatment.status === "cancelado" && c.status !== "pago") return false;

      const patient = db.patients.find((p) => p.id === treatment.patient_id);
      const display = getDisplayStatus(c);

      if (statusFiltro !== "todos" && display !== statusFiltro) return false;
      if (formaFiltro !== "todas" && c.forma_pagamento !== formaFiltro) return false;
      if (profissionalFiltro !== "todos" && treatment.profissional_id !== profissionalFiltro)
        return false;
      if (
        q &&
        !(
          patient?.nome.toLowerCase().includes(q) ||
          treatment.procedimento.toLowerCase().includes(q)
        )
      ) {
        return false;
      }
      return true;
    });
  }, [db, statusFiltro, formaFiltro, profissionalFiltro, busca]);

  const grupos = useMemo(() => {
    const atrasadas: typeof filtradas = [];
    const semana: typeof filtradas = [];
    const futuras: typeof filtradas = [];
    const pagas: typeof filtradas = [];

    for (const c of filtradas) {
      const d = getDisplayStatus(c);
      if (d === "pago") pagas.push(c);
      else if (d === "atrasado") atrasadas.push(c);
      else if (isToday(c.data_vencimento) || isThisWeek(c.data_vencimento)) semana.push(c);
      else futuras.push(c);
    }

    const sortAsc = (a: Charge, b: Charge) => a.data_vencimento.localeCompare(b.data_vencimento);
    atrasadas.sort(sortAsc);
    semana.sort(sortAsc);
    futuras.sort(sortAsc);
    pagas.sort((a, b) => (b.data_pagamento ?? "").localeCompare(a.data_pagamento ?? ""));

    return { atrasadas, semana, futuras, pagas };
  }, [filtradas]);

  const totaisCabecalho = useMemo(() => {
    const sum = (arr: Charge[]) => arr.reduce((acc, c) => acc + c.valor_centavos, 0);
    return {
      atrasadas: sum(grupos.atrasadas),
      semana: sum(grupos.semana),
      futuras: sum(grupos.futuras),
      pagas: sum(grupos.pagas),
    };
  }, [grupos]);

  const profissionais = db.profiles.filter(
    (p) => p.role === "profissional" || p.role === "admin"
  );

  async function handleRevert(chargeId: string) {
    if (!confirm("Estornar esta baixa e voltar para pendente?")) return;
    setRevertendo(chargeId);
    try {
      await revertCharge(chargeId);
    } catch (err) {
      alert("Erro ao estornar. Tente novamente.");
      console.error(err);
    } finally {
      setRevertendo(null);
    }
  }

  function renderTable(items: Charge[]) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Paciente</TableHead>
            <TableHead>Procedimento</TableHead>
            <TableHead>Parcela</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead>Forma</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((c) => {
            const t = db.treatments.find((x) => x.id === c.treatment_id);
            const p = t && db.patients.find((x) => x.id === t.patient_id);
            const display: ChargeDisplayStatus = getDisplayStatus(c);
            return (
              <TableRow key={c.id}>
                <TableCell>
                  <Link
                    href={`/pacientes/${p?.id ?? ""}`}
                    className="font-medium hover:underline"
                  >
                    {p?.nome ?? "—"}
                  </Link>
                </TableCell>
                <TableCell className="text-sm">{t?.procedimento}</TableCell>
                <TableCell className="text-sm">
                  {c.numero_parcela}/{t?.num_parcelas}
                </TableCell>
                <TableCell className="font-medium">{centsToBRL(c.valor_centavos)}</TableCell>
                <TableCell>
                  {formatDateBR(c.data_vencimento)}
                  {c.status === "pago" && c.data_pagamento && (
                    <p className="text-xs text-muted-foreground">
                      Pago em {formatDateBR(c.data_pagamento)}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <FormaPagamentoBadge forma={c.forma_pagamento} />
                </TableCell>
                <TableCell>
                  <ChargeStatusBadge status={display} />
                </TableCell>
                <TableCell className="text-right">
                  {display !== "pago" ? (
                    podeMarcarPago && (
                      <Button size="sm" variant="success" onClick={() => setMarcandoPago(c)}>
                        <CheckCircle2 className="h-4 w-4" /> Marcar pago
                      </Button>
                    )
                  ) : (
                    podeReverter && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={revertendo === c.id}
                        onClick={() => handleRevert(c.id)}
                      >
                        <RotateCcw className="h-4 w-4" />{" "}
                        {revertendo === c.id ? "..." : "Estornar"}
                      </Button>
                    )
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  }

  const hasNothing =
    grupos.atrasadas.length === 0 &&
    grupos.semana.length === 0 &&
    grupos.futuras.length === 0 &&
    grupos.pagas.length === 0;

  return (
    <div>
      <PageHeader
        title="Cobranças"
        description="Fila de todas as parcelas geradas. Filtre, agrupe e dê baixa nos pagamentos recebidos."
      />

      <Card className="mb-4">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar paciente ou procedimento"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value as StatusFiltro)}
          >
            <option value="todos">Todos os status</option>
            <option value="pendente">Pendentes</option>
            <option value="atrasado">Atrasadas</option>
            <option value="pago">Pagas</option>
          </Select>
          <Select
            value={formaFiltro}
            onChange={(e) => setFormaFiltro(e.target.value as typeof formaFiltro)}
          >
            <option value="todas">Todas as formas</option>
            <option value="pix">PIX</option>
            <option value="credito">Crédito</option>
            <option value="especie">Espécie</option>
          </Select>
          <Select
            value={profissionalFiltro}
            onChange={(e) => setProfissionalFiltro(e.target.value)}
          >
            <option value="todos">Todos os profissionais</option>
            {profissionais.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </Select>
        </CardContent>
      </Card>

      {hasNothing ? (
        <EmptyState
          icon={<Receipt className="h-10 w-10" />}
          title="Nenhuma cobrança encontrada"
          description="Cobranças são geradas automaticamente ao criar um tratamento."
        />
      ) : (
        <div className="space-y-6">
          {grupos.atrasadas.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span className="text-destructive">Atrasadas</span>
                    <span className="text-sm font-normal text-muted-foreground">
                      {grupos.atrasadas.length} ·{" "}
                      <span className="font-semibold text-destructive">
                        {centsToBRL(totaisCabecalho.atrasadas)}
                      </span>
                    </span>
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">{renderTable(grupos.atrasadas)}</CardContent>
            </Card>
          )}

          {grupos.semana.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  Esta semana
                  <span className="text-sm font-normal text-muted-foreground">
                    {grupos.semana.length} ·{" "}
                    <span className="font-semibold text-foreground">
                      {centsToBRL(totaisCabecalho.semana)}
                    </span>
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">{renderTable(grupos.semana)}</CardContent>
            </Card>
          )}

          {grupos.futuras.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  Próximas
                  <span className="text-sm font-normal text-muted-foreground">
                    {grupos.futuras.length} · {centsToBRL(totaisCabecalho.futuras)}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">{renderTable(grupos.futuras)}</CardContent>
            </Card>
          )}

          {grupos.pagas.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="text-success">Pagas</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    {grupos.pagas.length} · {centsToBRL(totaisCabecalho.pagas)}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">{renderTable(grupos.pagas)}</CardContent>
            </Card>
          )}
        </div>
      )}

      <MarkPaidDialog charge={marcandoPago} onOpenChange={(o) => !o && setMarcandoPago(null)} />
    </div>
  );
}
