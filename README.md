# Assistente de Mercado

App pessoal (PWA) para controlar gastos de mercado: registro de compra por foto da nota fiscal (lida via Claude Vision), histórico de preços por produto/mercado e saldo do vale alimentação.

- **Stack**: Next.js (App Router) + TypeScript + Tailwind, Supabase (Postgres + Storage), OCR local gratuito (Tesseract.js), deploy na Vercel.
- **Setup completo (contas, deploy, PWA)**: veja [`SETUP.md`](SETUP.md).
- **Schema do banco**: [`supabase/schema.sql`](supabase/schema.sql).

## Desenvolvimento local

```bash
cp .env.local.example .env.local   # preencha as variáveis
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).
