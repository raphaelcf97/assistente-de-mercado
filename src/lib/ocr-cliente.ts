"use client";

import { createWorker, PSM } from "tesseract.js";

// OCR local e gratuito rodando no próprio navegador do usuário — tesseract.js
// foi feito primariamente para esse ambiente (Web Worker + WASM padrão do
// browser), o que evita todos os problemas de empacotamento/serverless que
// existem ao rodar a mesma biblioteca dentro de uma função Node na Vercel.
//
// A imagem vai para o Tesseract EXATAMENTE como saiu da câmera, sem nenhum
// tratamento. Isso é contraintuitivo, mas foi medido contra uma nota real de
// 35 itens: binarização adaptativa + upscale, que é a receita clássica pra
// OCR de documento, derrubou o resultado de 25 para 9 itens extraídos. O
// Tesseract já faz o próprio pré-processamento internamente e faz melhor —
// qualquer coisa por cima come o traço fino da impressão térmica.
//
//   arquivo cru          -> 32/35 nomes, 25 itens, confiança 48
//   cinza sem ampliar    -> 30/35 nomes, 25 itens, confiança 45
//   cinza ampliado 2x    -> 29/35 nomes, 22 itens, confiança 44
//   binarizado (antes)   -> 20/35 nomes,  9 itens, confiança 39
//
// Idem pra compressão: a versão reduzida que vai pro Storage não serve pro
// OCR, por isso a tela de registro guarda o arquivo original separado.

// Conjunto de caracteres que aparecem num cupom brasileiro. Ganho pequeno
// mas consistente (32 nomes contra 31, 14 preços contra 13): sem ele o
// modelo de português tenta ler código de produto como palavra e inventa
// acentuação. Maiúscula acentuada fica de fora porque impressora térmica
// não imprime acento em maiúscula — quando aparece, é alucinação.
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
  const worker = await createWorker("por", undefined, {
    logger: (m) => {
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        aoProgredir?.(m.progress);
      }
    },
  });

  try {
    await worker.setParameters({
      // O cupom é um bloco único de texto em coluna. Os outros modos foram
      // testados na mesma nota e são muito piores: PSM 4 dá 14 itens,
      // PSM 3 dá 1 e os modos esparsos (11/12) não extraem nada.
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      // Preserva o espaçamento entre as colunas — é o que o parser usa pra
      // separar descrição / quantidade / preço unitário / total.
      preserve_interword_spaces: "1",
      tessedit_char_whitelist: CARACTERES,
      user_defined_dpi: "300",
    });

    const { data } = await worker.recognize(arquivo);
    return data.text;
  } finally {
    await worker.terminate();
  }
}
