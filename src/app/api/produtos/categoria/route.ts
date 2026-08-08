import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const produto_id = body?.produto_id;
  const categoria = body?.categoria;

  if (typeof produto_id !== "string" || !produto_id) {
    return NextResponse.json({ erro: "Produto não informado." }, { status: 400 });
  }
  if (categoria !== null && typeof categoria !== "string") {
    return NextResponse.json({ erro: "Categoria inválida." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("produtos")
    .update({ categoria: categoria || null })
    .eq("id", produto_id);

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
