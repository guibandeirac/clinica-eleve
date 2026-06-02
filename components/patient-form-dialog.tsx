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
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/lib/store";
import type { Patient } from "@/lib/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient?: Patient | null;
  onSaved?: (p: Patient | null) => void;
};

export function PatientFormDialog({ open, onOpenChange, patient, onSaved }: Props) {
  const { createPatient, updatePatient } = useStore();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNome(patient?.nome ?? "");
      setTelefone(patient?.telefone ?? "");
      setCpf(patient?.cpf ?? "");
      setObservacoes(patient?.observacoes ?? "");
      setErro(null);
    }
  }, [open, patient]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      setErro("Nome é obrigatório");
      return;
    }
    setSaving(true);
    try {
      if (patient) {
        await updatePatient(patient.id, {
          nome: nome.trim(),
          telefone: telefone.trim() || undefined,
          cpf: cpf.trim() || undefined,
          observacoes: observacoes.trim() || undefined,
        });
        onSaved?.(null);
      } else {
        const created = await createPatient({
          nome: nome.trim(),
          telefone: telefone.trim() || undefined,
          cpf: cpf.trim() || undefined,
          observacoes: observacoes.trim() || undefined,
        });
        onSaved?.(created);
      }
      onOpenChange(false);
    } catch (err) {
      setErro("Erro ao salvar. Tente novamente.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>{patient ? "Editar paciente" : "Novo paciente"}</DialogTitle>
          <DialogDescription>Preencha os dados do paciente.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome *</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(11) 90000-0000"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cpf">CPF</Label>
              <Input id="cpf" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
            />
          </div>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : patient ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
