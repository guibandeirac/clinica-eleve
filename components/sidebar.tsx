"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Receipt, UserCog, Stethoscope, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { can, ROLE_LABEL } from "@/lib/permissions";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pacientes", label: "Pacientes", icon: Users },
  { href: "/cobrancas", label: "Cobranças", icon: Receipt },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { currentUser, signOut } = useStore();

  return (
    <aside className="w-64 shrink-0 border-r bg-muted/20 flex flex-col">
      <div className="p-5 border-b">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded bg-primary text-primary-foreground grid place-items-center">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-sm leading-none">Clínica Eleve</p>
            <p className="text-xs text-muted-foreground mt-1">Gestão de pacientes</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-foreground hover:bg-accent"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}

        {can("user.manage", currentUser.role) && (
          <Link
            href="/usuarios"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
              pathname?.startsWith("/usuarios")
                ? "bg-primary text-primary-foreground font-medium"
                : "text-foreground hover:bg-accent"
            )}
          >
            <UserCog className="h-4 w-4" />
            Usuários
          </Link>
        )}
      </nav>

      <div className="p-4 border-t">
        <div className="mb-3">
          <p className="text-xs font-medium">{currentUser.nome}</p>
          <p className="text-xs text-muted-foreground">{ROLE_LABEL[currentUser.role]}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => signOut()}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </aside>
  );
}
