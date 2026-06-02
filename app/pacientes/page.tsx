"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, Users } from "lucide-react";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
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
import { can } from "@/lib/permissions";
import { EmptyState } from "@/components/ui/empty-state";

export default function PacientesPage() {
  const { db, currentUser } = useStore();
  const [busca, setBusca] = useState("");
  const [filtroAtivo, setFiltroAtivo] = useState<"todos" | "ativo" | "inativo">("ativo");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return db.patients
      .filter((p) => {
        if (filtroAtivo === "ativo" && !p.ativo) return false;
        if (filtroAtivo === "inativo" && p.ativo) return false;
        if (!q) return true;
        return (
          p.nome.toLowerCase().includes(q) ||
          (p.telefone ?? "").toLowerCase().includes(q) ||
          (p.cpf ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [db.patients, busca, filtroAtivo]);

  const podeCriar = can("patient.create", currentUser.role);

  return (
    <div>
      <PageHeader
        title="Pacientes"
        description="Cadastro e histórico de pacientes da clínica"
        actions={
          podeCriar && (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" /> Novo paciente
            </Button>
          )
        }
      />

      <Card className="p-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone ou CPF"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={filtroAtivo}
            onChange={(e) => setFiltroAtivo(e.target.value as typeof filtroAtivo)}
            className="w-40"
          >
            <option value="ativo">Ativos</option>
            <option value="inativo">Inativos</option>
            <option value="todos">Todos</option>
          </Select>
        </div>
      </Card>

      {db.patients.length === 0 ? (
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="Nenhum paciente cadastrado"
          description="Comece cadastrando o primeiro paciente da clínica."
          action={
            podeCriar && (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" /> Cadastrar paciente
              </Button>
            )
          }
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Tratamentos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.length === 0 ? (
                <TableEmpty colSpan={6}>Nenhum paciente encontrado com esses filtros.</TableEmpty>
              ) : (
                filtrados.map((p) => {
                  const tratamentos = db.treatments.filter((t) => t.patient_id === p.id);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.nome}</TableCell>
                      <TableCell className="text-muted-foreground">{p.telefone ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{p.cpf ?? "—"}</TableCell>
                      <TableCell>{tratamentos.length}</TableCell>
                      <TableCell>
                        {p.ativo ? (
                          <Badge variant="success">Ativo</Badge>
                        ) : (
                          <Badge variant="muted">Inativo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/pacientes/${p.id}`}>
                          <Button variant="outline" size="sm">Abrir</Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <PatientFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
