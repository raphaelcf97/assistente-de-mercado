// Pré-processamento da foto antes do OCR.
//
// Foto de cupom fiscal é o pior caso possível pro Tesseract: impressão
// térmica de matriz de pontos, papel amassado, iluminação irregular e
// normalmente um fundo escuro em volta. Jogar o JPEG comprimido direto no
// OCR (que era o que o app fazia) destrói o texto duas vezes — o
// downscale some com os pontos finos das letras e o JPEG borra as bordas.
//
// Aqui a imagem segue o caminho oposto: vai para uma resolução alta,
// vira tons de cinza e passa por binarização adaptativa (Bradley-Roth),
// que decide preto/branco comparando cada pixel com a média da vizinhança
// em vez de um corte global. É isso que salva foto com um lado bem
// iluminado e outro na sombra, como as tiradas em cima da mesa.
//
// O resultado nunca é enviado para o servidor — só alimenta o OCR, que
// roda no próprio navegador. A foto guardada no Storage continua sendo a
// versão comprimida colorida.

// Texto de cupom é minúsculo; o Tesseract precisa de uns 20px de altura de
// caractere pra acertar. 2400px no lado maior chega lá sem estourar a
// memória de canvas do celular.
const LADO_ALVO = 2400;

// Janela da média local, como fração da largura. Precisa ser bem maior que
// um caractere e menor que a variação de iluminação da foto.
const JANELA_FRACAO = 1 / 14;

// Quanto o pixel pode estar abaixo da média da vizinhança antes de virar
// preto. Mais alto = mais agressivo (perde traço fino); mais baixo = deixa
// passar sujeira de fundo.
const TOLERANCIA = 0.14;

function paraCinza(dados: Uint8ClampedArray, total: number): Uint8Array {
  const cinza = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    const p = i * 4;
    // luminância perceptual — o texto térmico é neutro, mas o papel
    // costuma puxar amarelo sob luz quente
    cinza[i] = (dados[p] * 299 + dados[p + 1] * 587 + dados[p + 2] * 114) / 1000;
  }
  return cinza;
}

// Imagem integral (summed-area table): permite obter a soma de qualquer
// retângulo em tempo constante, o que torna a média local O(1) por pixel.
function imagemIntegral(cinza: Uint8Array, largura: number, altura: number): Uint32Array {
  const integral = new Uint32Array((largura + 1) * (altura + 1));
  const passo = largura + 1;
  for (let y = 0; y < altura; y++) {
    let somaLinha = 0;
    for (let x = 0; x < largura; x++) {
      somaLinha += cinza[y * largura + x];
      integral[(y + 1) * passo + (x + 1)] = integral[y * passo + (x + 1)] + somaLinha;
    }
  }
  return integral;
}

function binarizar(cinza: Uint8Array, largura: number, altura: number): Uint8Array {
  const integral = imagemIntegral(cinza, largura, altura);
  const passo = largura + 1;
  const raio = Math.max(8, Math.round(largura * JANELA_FRACAO) >> 1);
  const saida = new Uint8Array(largura * altura);

  for (let y = 0; y < altura; y++) {
    const y0 = Math.max(0, y - raio);
    const y1 = Math.min(altura - 1, y + raio);
    for (let x = 0; x < largura; x++) {
      const x0 = Math.max(0, x - raio);
      const x1 = Math.min(largura - 1, x + raio);
      const area = (x1 - x0 + 1) * (y1 - y0 + 1);
      const soma =
        integral[(y1 + 1) * passo + (x1 + 1)] -
        integral[y0 * passo + (x1 + 1)] -
        integral[(y1 + 1) * passo + x0] +
        integral[y0 * passo + x0];
      const media = soma / area;
      saida[y * largura + x] = cinza[y * largura + x] < media * (1 - TOLERANCIA) ? 0 : 255;
    }
  }
  return saida;
}

// Recebe o arquivo original (não a versão comprimida) e devolve um PNG em
// preto e branco pronto pro Tesseract. PNG e não JPEG de propósito: depois
// de binarizar, qualquer artefato de compressão vira ruído de borda.
export async function prepararImagemParaOcr(arquivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo);

  const escala = LADO_ALVO / Math.max(bitmap.width, bitmap.height);
  const largura = Math.max(1, Math.round(bitmap.width * escala));
  const altura = Math.max(1, Math.round(bitmap.height * escala));

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    bitmap.close();
    return arquivo;
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();

  const imagem = ctx.getImageData(0, 0, largura, altura);
  const total = largura * altura;
  const binaria = binarizar(paraCinza(imagem.data, total), largura, altura);

  for (let i = 0; i < total; i++) {
    const v = binaria[i];
    const p = i * 4;
    imagem.data[p] = v;
    imagem.data[p + 1] = v;
    imagem.data[p + 2] = v;
    imagem.data[p + 3] = 255;
  }
  ctx.putImageData(imagem, 0, 0);

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  return blob ?? arquivo;
}
