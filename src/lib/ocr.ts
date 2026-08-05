import Tesseract from "tesseract.js";
import os from "os";

// tesseract.js calcula o caminho do worker em runtime via
// path.join(__dirname, ...), o que o tracer de arquivos da Vercel não
// consegue detectar de forma confiável (mesmo com outputFileTracingIncludes
// no next.config.ts) — resultando em "Cannot find module .../worker-script/
// node/index.js" em produção. require.resolve() com uma string literal é
// o padrão que todo bundler/tracer reconhece de forma garantida.
const workerPath = require.resolve("tesseract.js/src/worker-script/node/index.js");

// OCR local e gratuito (sem chamada a nenhuma API paga). Roda no próprio
// servidor Node — na primeira execução baixa o pacote de idioma português
// (~2MB, cacheado depois) do CDN público do Tesseract.
//
// cachePath aponta para os.tmpdir() porque em serverless (Vercel) o
// diretório de trabalho do processo é somente-leitura — só /tmp é gravável.
export async function extrairTextoDaImagem(bytes: Buffer): Promise<string> {
  const worker = await Tesseract.createWorker("por", undefined, { cachePath: os.tmpdir(), workerPath });
  try {
    const { data } = await worker.recognize(bytes);
    return data.text;
  } finally {
    await worker.terminate();
  }
}
