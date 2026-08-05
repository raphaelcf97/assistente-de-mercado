// Redimensiona/comprime a foto no próprio navegador antes de enviar.
// Fotos de celular sem compressão facilmente passam de 5-10MB, o que:
// (a) deixa o OCR bem mais lento, e (b) pode estourar o limite de 4.5MB
// por requisição da Vercel. 1600px de lado maior já é mais que suficiente
// pra ler texto de nota fiscal.
const LADO_MAXIMO = 1600;
const QUALIDADE_JPEG = 0.82;

export async function comprimirImagem(arquivo: File): Promise<File> {
  const bitmap = await createImageBitmap(arquivo);

  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) return arquivo;

  ctx.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALIDADE_JPEG)
  );
  if (!blob) return arquivo;

  return new File([blob], "nota.jpg", { type: "image/jpeg" });
}
