"use client";

import Tesseract from "tesseract.js";

// OCR local e gratuito rodando no próprio navegador do usuário — tesseract.js
// foi feito primariamente para esse ambiente (Web Worker + WASM padrão do
// browser), o que evita todos os problemas de empacotamento/serverless que
// existem ao rodar a mesma biblioteca dentro de uma função Node na Vercel.
export async function extrairTextoDaImagemNoNavegador(
  arquivo: File,
  aoProgredir?: (progresso: number) => void
): Promise<string> {
  const { data } = await Tesseract.recognize(arquivo, "por", {
    logger: (m) => {
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        aoProgredir?.(m.progress);
      }
    },
  });
  return data.text;
}
