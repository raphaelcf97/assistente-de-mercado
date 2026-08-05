import Tesseract from "tesseract.js";
import os from "os";

// OCR local e gratuito (sem chamada a nenhuma API paga). Roda no próprio
// servidor Node — na primeira execução baixa o pacote de idioma português
// (~2MB, cacheado depois) do CDN público do Tesseract.
//
// cachePath aponta para os.tmpdir() porque em serverless (Vercel) o
// diretório de trabalho do processo é somente-leitura — só /tmp é gravável.
export async function extrairTextoDaImagem(bytes: Buffer): Promise<string> {
  const worker = await Tesseract.createWorker("por", undefined, { cachePath: os.tmpdir() });
  try {
    const { data } = await worker.recognize(bytes);
    return data.text;
  } finally {
    await worker.terminate();
  }
}
