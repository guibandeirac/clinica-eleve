import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    // Verificar se o chamador é admin
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const body = await request.json();
    const { nome, email, role, senha } = body as {
      nome: string;
      email: string;
      role: string;
      senha: string;
    };

    if (!nome || !email || !role || !senha) {
      return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Criar usuário no Supabase Auth
    const { data: newUser, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password: senha,
      user_metadata: { nome, role },
      email_confirm: true,
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    // O trigger cria o profile automaticamente; atualizar role e nome
    await adminClient
      .from("profiles")
      .update({ nome, role })
      .eq("id", newUser.user.id);

    const { data: createdProfile } = await adminClient
      .from("profiles")
      .select("*")
      .eq("id", newUser.user.id)
      .single();

    return NextResponse.json(createdProfile, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
