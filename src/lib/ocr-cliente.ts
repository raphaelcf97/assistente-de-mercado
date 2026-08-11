"use client";

import { createWorker, PSM } from "tesseract.js";
import { prepararImagemParaOcr } from "./preparar-ocr";

// OCR local e gratuito rodando no próprio navegador do usuário — tesseract.js
// foi feito primariamente para esse ambiente (Web Worker + WASM padrão do
// browser), o que evita todos os problemas de empacotamento/serverless que
// existem ao rodar a mesma biblioteca dentro de uma função Node na Vercel.

// Conjunto de caracteres que realmente aparecem num cupom brasileiro.
//
// Sem essa restrição o modelo de português tenta ler código de produto como
// se fosse palavra e inventa acentuação: "AR087037" saiu como "ÁROGTOA7" e
// "1X1,5L" como "ÍXI,AI". Impressora térmica de cupom não imprime maiúscula
// acentuada (a descrição do produto vem sempre sem acento), então maiúscula
// acentuada é sempre alucinação e fica fora da lista. Minúscula acentuada
// continua permitida — aparece em linha de texto corrido tipo "Emissão".
const CARACTERES =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
  "abcdefghijklmnopqrstuvwxyz" +
  "áâãàçéêíóôõú" +
  "0123456789" +
  ".,:;/%()-+*$ ";

export async function extrairTextoDaImagemNoNavegador(
  arquivo: File,
  aoProgredir?: (progresso: number) => void
): Promise<string> {
  const imagem = await prepararImagemParaOcr(arquivo);

  const worker = await createWorker("por", undefined, {
    logger: (m) => {
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        aoProgredir?.(m.progress);
      }
    },
  });

  try {
    await worker.setParameters({
      // O cupom é um bloco único de texto em coluna. No modo automático
      // (padrão) o Tesseract tenta detectar colunas e acaba embaralhando a
      // ordem dos valores com a dos nomes.
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      // Preserva o espaçamento entre as colunas — é o que o parser usa pra
      // separar descrição / quantidade / preço unitário / total.
      preserve_interword_spaces: "1",
      tessedit_char_whitelist: CARACTERES,
      // A imagem já vem binarizada em alta resolução; declarar o DPI evita
      // que o Tesseract tente estimar (e erre) a escala do texto.
      user_defined_dpi: "300",
    });

    const { data } = await worker.recognize(imagem);
    return data.text;
  } finally {
    await worker.terminate();
  }
}
