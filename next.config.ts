import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O tesseract.js carrega seu worker (worker_threads) e o motor WASM
  // (tesseract.js-core) por caminho dinâmico, então o tracing automático
  // da Vercel não detecta esses arquivos e não os inclui no deploy —
  // sem isso a função quebra em runtime com "Cannot find module".
  outputFileTracingIncludes: {
    "/api/compras/extrair": [
      "./node_modules/tesseract.js/src/worker-script/node/**/*",
      "./node_modules/tesseract.js-core/**/*",
    ],
  },
};

export default nextConfig;
