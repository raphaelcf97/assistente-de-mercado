import { supabaseAdmin } from "@/lib/supabase";

const BUCKET = "notas";

export async function uploadFotoNota(bytes: Buffer, contentType: string) {
  const supabase = supabaseAdmin();
  const ext = contentType === "image/png" ? "png" : "jpg";
  const path = `${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType, upsert: false });

  if (error) throw new Error(`Falha ao subir foto da nota: ${error.message}`);
  return path;
}

export async function urlAssinadaFotoNota(path: string, expiresInSeconds = 60 * 60) {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw new Error(`Falha ao gerar URL da foto: ${error.message}`);
  return data.signedUrl;
}
