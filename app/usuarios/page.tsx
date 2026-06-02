"use client";

import { useState } from "react";
import { Plus, UserCog } from "lucide-react";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { ROLE_LABEL, can } from "@/lib/permissions";
import type { Role } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatDateBR } from "@/lib/date";

export default function UsuariosPage() {
  const { db, currentUser, createUser, updateUser } = useStore();
  const [openCreate, setOpenCreate] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [role, setRole] = useState<Role>("recepcao");
  const [erro, setErro] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  if (!can("user.manage", currentUser.role)) {
    return (
      <div>
        <PageHeader title="Usuários" />
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Você não tem permissão para acessar esta tela.
          </CardContent>
        </Card>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !email.trim() || !senha) {
      setErro("Nome, email e senha são obrigatórios");
      return;
    }
    if (senha.length < 6) {
      setErro("Senha deve ter ao menos 6 caracteres");
      return;
    }
    setSaving(true);
    setErro(null);
    try {
      await createUser({ nome: nome.trim(), email: email.trim(), role, senha });
      setNome("");
      setEmail("");
      setSenha("");
      setRole("recepcao");
      setOpenCreate(false);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao criar usuário");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateRole(id: string, newRole: Role) {
    setUpdatingId(id);
    try {
      await updateUser(id, { role: newRole });
    } catch {
      alert("Erro ao atualizar perfil");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleToggleAtivo(id: string, ativo: boolean) {
    setUpdatingId(id);
    try {
      await updateUser(id, { ativo: !ativo });
    } catch {
      alert("Erro ao atualizar usuário");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Usuários"
        description="Gerencie os usuários internos e seus perfis de acesso"
        actions={
          <Button onClick={() => setOpenCreate(true)}>
            <Plus className="h-4 w-4" /> Novo usuário
          </Button>
        }
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {db.profiles.length === 0 ? (
              <TableEmpty colSpan={6}>Nenhum usuário cadastrado.</TableEmpty>
            ) : (
              db.profiles.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <UserCog className="h-4 w-4 text-muted-foreground" />
                      {u.nome}
                      {u.id === currentUser.id && (
                        <Badge variant="outline" className="text-[10px]">
                          você
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                  <TableCell>
                    <Select
                      value={u.role}
                      onChange={(e) => handleUpdateRole(u.id, e.target.value as Role)}
                      className="w-36 h-8 text-xs"
                      disabled={updatingId === u.id || u.id === currentUser.id}
                    >
                      <option value="admin">Admin</option>
                      <option value="recepcao">Recepção</option>
                      <option value="profissional">Profissional</option>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {u.ativo ? (
                      <Badge variant="success">Ativo</Badge>
                    ) : (
                      <Badge variant="muted">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateBR(u.created_at.slice(0, 10))}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updatingId === u.id || u.id === currentUser.id}
                      onClick={() => handleToggleAtivo(u.id, u.ativo)}
                    >
                      {updatingId === u.id ? "..." : u.ativo ? "Desativar" : "Reativar"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent onClose={() => setOpenCreate(false)}>
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
            <DialogDescription>
              Defina os dados e o perfil de acesso do usuário. Uma senha temporária será criada.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="user-nome">Nome *</Label>
              <Input
                id="user-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-email">Email *</Label>
              <Input
                id="user-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-senha">Senha temporária *</Label>
              <Input
                id="user-senha"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-role">Perfil *</Label>
              <Select
                id="user-role"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                <option value="admin">{ROLE_LABEL.admin}</option>
                <option value="recepcao">{ROLE_LABEL.recepcao}</option>
                <option value="profissional">{ROLE_LABEL.profissional}</option>
              </Select>
            </div>
            {erro && <p className="text-sm text-destructive">{erro}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenCreate(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Criando..." : "Criar usuário"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
