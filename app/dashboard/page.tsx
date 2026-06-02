"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CalendarClock, AlertTriangle, Wallet, TrendingUp, CreditCard } from "lucide-react";
import { useStore, getDisplayStatus } from "@/lib/store";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { centsToBRL } from "@/lib/money";
import { isThisMonth, isThisWeek, isToday, formatDateBR } from "@/lib/date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const { ready, db } = useStore();

  const stats = useMemo(() => {
    const pendentes = db.charges.filter((c) => c.status === "pendente");
    const pagas = db.charges.filter((c) => c.status === "pago");

    const aVencerHoje = pendentes.filter((c) => isToday(c.data_vencimento));
    const aVencerSemana = pendentes.filter((c) => isThisWeek(c.data_vencimento));
    const atrasadas = pendentes.filter((c) => getDisplayStatus(c) === "atrasado");
    const recebidoMes = pagas.filter((c) => c.data_pagamento && isThisMonth(c.data_pagamento));
    const aReceberMes = pendentes.filter((c) => isThisMonth(c.data_vencimento));

    const sum = (arr: typeof db.charges) => arr.reduce((acc, c) => acc + c.valor_centavos, 0);

    const distribuicao: Record<string, { count: number; total: number }> = {
      credito: { count: 0, total: 0 },
      pix: { count: 0, total: 0 },
      especie: { count: 0, total: 0 },
    };
    for (const c of pendentes) {
      distribuicao[c.forma_pagamento].count += 1;
      distribuicao[c.forma_pagamento].total += c.valor_centavos;
    }

    return {
      aVencerHoje: { count: aVencerHoje.length, total: sum(aVencerHoje) },
      aVencerSemana: { count: aVencerSemana.length, total: sum(aVencerSemana) },
      atrasadas: { count: atrasadas.length, total: sum(atrasadas) },
      recebidoMes: { count: recebidoMes.length, total: sum(recebidoMes) },
      aReceberMes: { count: aReceberMes.length, total: sum(aReceberMes) },
      distribuicao,
      proximas: pendentes
        .slice()
        .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))
        .slice(0, 5),
    };
  }, [db.charges]);

  if (!ready) {
    return <div className="text-muted-foreground">Carregando...</div>;
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Visão geral do dia. Quem precisa ser cobrado, quanto e quando."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="A vencer hoje"
          icon={<CalendarClock className="h-4 w-4" />}
          count={stats.aVencerHoje.count}
          total={stats.aVencerHoje.total}
        />
        <StatCard
          title="Esta semana"
          icon={<CalendarClock className="h-4 w-4" />}
          count={stats.aVencerSemana.count}
          total={stats.aVencerSemana.total}
        />
        <StatCard
          title="Atrasadas"
          icon={<AlertTriangle className="h-4 w-4" />}
          count={stats.atrasadas.count}
          total={stats.atrasadas.total}
          tone="danger"
          link={{ href: "/cobrancas?status=atrasado", label: "Ver atrasadas" }}
        />
        <StatCard
          title="A receber no mês"
          icon={<Wallet className="h-4 w-4" />}
          count={stats.aReceberMes.count}
          total={stats.aReceberMes.total}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-success" /> Recebido no mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-success">{centsToBRL(stats.recebidoMes.total)}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {stats.recebidoMes.count}{" "}
              {stats.recebidoMes.count === 1 ? "baixa registrada" : "baixas registradas"}
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4" /> Pendentes por forma de pagamento
            </CardTitle>
            <CardDescription>Distribuição das cobranças em aberto</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {(["credito", "pix", "especie"] as const).map((forma) => {
                const data = stats.distribuicao[forma];
                const label = forma === "credito" ? "Crédito" : forma === "pix" ? "PIX" : "Espécie";
                return (
                  <div key={forma} className="rounded-md border p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className="text-xl font-bold mt-1">{centsToBRL(data.total)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {data.count} {data.count === 1 ? "cobrança" : "cobranças"}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Próximos vencimentos</CardTitle>
              <CardDescription>As 5 cobranças pendentes mais próximas</CardDescription>
            </div>
            <Link href="/cobrancas">
              <Button variant="outline" size="sm">Ver tudo</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {stats.proximas.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhuma cobrança pendente. Cadastre um tratamento para começar.
            </p>
          ) : (
            <ul className="divide-y">
              {stats.proximas.map((c) => {
                const treatment = db.treatments.find((t) => t.id === c.treatment_id);
                const patient = treatment && db.patients.find((p) => p.id === treatment.patient_id);
                const display = getDisplayStatus(c);
                return (
                  <li key={c.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-sm">{patient?.nome ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {treatment?.procedimento} · parcela {c.numero_parcela}/{treatment?.num_parcelas}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm">{centsToBRL(c.valor_centavos)}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-2 justify-end mt-0.5">
                        {formatDateBR(c.data_vencimento)}
                        {display === "atrasado" && <Badge variant="destructive" className="text-[10px]">atrasado</Badge>}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  title,
  icon,
  count,
  total,
  tone,
  link,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  total: number;
  tone?: "danger";
  link?: { href: string; label: string };
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-muted-foreground">{title}</p>
          <span className={tone === "danger" ? "text-destructive" : "text-muted-foreground"}>
            {icon}
          </span>
        </div>
        <p className={`text-2xl font-bold ${tone === "danger" ? "text-destructive" : ""}`}>
          {centsToBRL(total)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {count} {count === 1 ? "cobrança" : "cobranças"}
        </p>
        {link && (
          <Link href={link.href} className="inline-flex text-xs text-primary mt-2 hover:underline">
            {link.label} →
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
