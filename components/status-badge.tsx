import { Badge } from "@/components/ui/badge";
import type { ChargeDisplayStatus, FormaPagamento, TreatmentStatus } from "@/lib/types";

export function ChargeStatusBadge({ status }: { status: ChargeDisplayStatus }) {
  if (status === "pago") return <Badge variant="success">Pago</Badge>;
  if (status === "atrasado") return <Badge variant="destructive">Atrasado</Badge>;
  return <Badge variant="warning">Pendente</Badge>;
}

export function FormaPagamentoBadge({ forma }: { forma: FormaPagamento }) {
  const label =
    forma === "credito" ? "Crédito" : forma === "pix" ? "PIX" : "Espécie";
  const variant = forma === "credito" ? "secondary" : forma === "pix" ? "default" : "muted";
  return <Badge variant={variant}>{label}</Badge>;
}

export function TreatmentStatusBadge({ status }: { status: TreatmentStatus }) {
  if (status === "concluido") return <Badge variant="success">Concluído</Badge>;
  if (status === "cancelado") return <Badge variant="muted">Cancelado</Badge>;
  return <Badge variant="default">Ativo</Badge>;
}
