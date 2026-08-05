# Setup — Assistente de Mercado

Guia passo a passo para colocar o app no ar. Você vai precisar criar 3 contas gratuitas (Supabase, GitHub, Vercel) — nenhuma delas eu consigo criar por você. A leitura da nota fiscal roda por OCR local (Tesseract), sem nenhuma API paga — não precisa de conta na Anthropic nem cartão de crédito em lugar nenhum.

## 1. Banco de dados (Supabase)

1. Crie uma conta em [supabase.com](https://supabase.com) e clique em **New Project**.
2. Escolha um nome (ex: `assistente-mercado`), uma senha de banco (guarde, mas não vai precisar dela no dia a dia) e a região mais próxima (ex: São Paulo).
3. Depois que o projeto for criado, vá em **SQL Editor** → **New query**, cole todo o conteúdo do arquivo [`supabase/schema.sql`](supabase/schema.sql) deste repositório e clique em **Run**. Isso cria todas as tabelas.
4. Vá em **Storage** → **New bucket** → nome `notas` → marque como **Private** (não público) → criar.
5. Vá em **Project Settings** → **API**. Anote:
   - **Project URL** → vai virar `SUPABASE_URL`
   - **service_role key** (em "Project API keys", é a chave secreta, não a `anon`/`public`) → vai virar `SUPABASE_SERVICE_ROLE_KEY`

## 2. Repositório no GitHub

Se você ainda não tem um repositório para este projeto, crie um (pode ser privado) em [github.com/new](https://github.com/new) e depois, a partir da pasta `C:\ASSISTENTE DE MERCADO`, rode:

```bash
git remote add origin https://github.com/SEU-USUARIO/assistente-de-mercado.git
git add .
git commit -m "Primeira versão do Assistente de Mercado"
git push -u origin main
```

## 3. Deploy (Vercel)

1. Crie uma conta em [vercel.com](https://vercel.com) (pode entrar direto com o GitHub).
2. **Add New** → **Project** → selecione o repositório que você acabou de criar.
3. Antes de clicar em Deploy, abra **Environment Variables** e adicione:

   | Nome | Valor |
   |---|---|
   | `SUPABASE_URL` | do passo 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | do passo 1 |
   | `APP_PIN` | o PIN que você quer usar para abrir o app (ex: `1234`) |
   | `APP_SESSION_SECRET` | uma string aleatória longa — gere uma com `openssl rand -hex 32` no terminal, ou peça pra mim gerar uma quando chegarmos nessa etapa |

   O `CRON_SECRET` é opcional (protege o endpoint de recarga automática contra chamadas externas) — pode deixar em branco por enquanto.

4. Clique em **Deploy**. Em 1-2 minutos o app estará no ar em uma URL tipo `assistente-de-mercado.vercel.app`.
5. O arquivo `vercel.json` já está configurado para rodar a recarga automática do vale todo dia às 09:00 (horário de Brasília) — não precisa configurar nada a mais na Vercel para isso funcionar, desde que o deploy tenha sido feito com esse arquivo no repositório.

## 4. Instalar no celular (PWA)

1. Abra a URL do app (`https://seu-app.vercel.app`) no Chrome do celular.
2. Toque no menu (⋮) → **Adicionar à tela inicial** (Android) ou, no Safari (iPhone), toque em Compartilhar → **Adicionar à Tela de Início**.
3. Pronto — o app abre como um aplicativo normal, com ícone próprio.

## 5. Uso do dia a dia

- Ao abrir o app pela primeira vez em cada aparelho, ele vai pedir o PIN definido em `APP_PIN`.
- Configure o valor e o dia da recarga mensal do vale em **Vale → Recarga mensal automática**.
- Toda compra registrada é assumida como paga no vale — desmarque a opção na tela de registro quando não for o caso.
- **Sobre a leitura da nota**: é OCR genérico local (Tesseract), não uma IA — funciona bem em notas nítidas, mas erra mais em fotos tortas/borradas ou em formatos de cupom fora do padrão. Revise sempre a tela de confirmação antes de salvar; os campos que o OCR não conseguiu ler ficam destacados. Se a taxa de erro incomodar muito no uso real, dá pra revisitar essa parte depois (ex: melhorar as heurísticas de leitura conforme os formatos de nota que você mais usa).

---

### Rodando localmente (opcional, para eu continuar ajustando o app)

```bash
cd "C:\ASSISTENTE DE MERCADO"
cp .env.local.example .env.local   # preencha com os mesmos valores do passo 3
npm install
npm run dev
```

Abra `http://localhost:3000`.
