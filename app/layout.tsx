import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { Sidebar } from "@/components/sidebar";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Clínica Eleve — Gestão de Pacientes",
  description: "Sistema interno de gestão de pacientes e cobranças",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="pt-BR">
      <body className="antialiased">
        {user ? (
          <StoreProvider>
            <div className="flex min-h-screen">
              <Sidebar />
              <main className="flex-1 overflow-x-hidden">
                <div className="p-8 max-w-7xl mx-auto">{children}</div>
              </main>
            </div>
          </StoreProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
