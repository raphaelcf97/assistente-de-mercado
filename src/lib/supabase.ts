import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

let client: ReturnType<typeof createClient<Database>> | null = null;

// Cliente server-side com a service role key. Nunca importar este módulo
// em código que roda no navegador — a chave tem acesso total ao banco.
export function supabaseAdmin() {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configuradas. Veja SETUP.md."
    );
  }

  client = createClient<Database>(url, key, {
    auth: { persistSession: false },
  });
  return client;
}
