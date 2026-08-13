# Setup — Assistente de Mercado

Guia passo a passo para colocar o app no ar. Você vai precisar criar 3 contas gratuitas (Supabase, GitHub, Vercel) — nenhuma delas eu consigo criar por você. Não há nenhuma API paga envolvida: não precisa de conta na Anthropic nem cartão de crédito em lugar nenhum.

## 1. Banco de dados (Supabase)

1. Crie uma conta em [supabase.com](https://supabase.com) e clique em **New Project**.
2. Escolha um nome (ex: `assistente-mercado`), uma senha de banco (guarde, mas não vai precisar dela no dia a dia) e a região mais próxima (ex: São Paulo).
3. Depois que o projeto for criado, vá em **SQL Editor** → **New query**, cole todo o conteúdo do arquivo [`supabase/schema.sql`](supabase/schema.sql) deste repositório e clique em **Run**. Isso cria todas as tabelas.
   - **Migrations posteriores**: a pasta [`supabase/migrations/`](supabase/migrations/) tem alterações feitas depois da criação do banco. Rode cada uma, **em ordem**, da mesma forma (SQL Editor → cola → Run):
     - `002_categoria_produtos.sql` — categoria dos produtos, usada na aba "Produtos"
     - `003_vale_refeicao.sql` — segunda carteira (vale refeição) e lançamento de gasto fora de casa
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
- Em **Vales** você configura, para **cada carteira** (alimentação e refeição), o valor e o dia da recarga mensal. As duas são independentes — podem cair em dias diferentes.
- Todo lançamento escolhe de qual carteira saiu: **Alimentação**, **Refeição** ou **Outro** (dinheiro, Pix, cartão próprio — registra o gasto mas não debita vale nenhum).
- **Insights** é a tela inicial do app. Ela se monta sozinha conforme o histórico cresce: comparação de preço entre mercados (precisa do mesmo produto comprado em 2 lugares), variação de preço ao longo do tempo (mesmo produto em 2 datas), cesta principal, para onde vai o dinheiro, dia da semana mais caro e ritmo de cada vale no mês.
- Há dois tipos de lançamento em **Registrar**:
  - **Compra de mercado** — com itens; é o que alimenta o histórico de preços.
  - **Gasto fora** — restaurante, bar, lanche, delivery; só lugar, data e valor. Existe para o saldo do vale fechar com a realidade.
- **Lançamento é manual**: mercado, data e uma linha por produto (descrição, quantidade, medida e quanto pagou). O preço por kg/L/unidade é calculado sozinho — não digite.
  - A descrição tem autocompletar dos produtos que você já comprou. Escolher da lista é o que liga a compra ao histórico; digitar um nome novo cria um produto novo.
  - Assim que a linha estiver completa, aparece quanto você pagou por medida e, se já houver histórico, se está mais caro ou mais barato que a sua média.
  - Se o nome tiver a medida embutida ("REQUEIJÃO 300ML"), a quantidade e a unidade já vêm preenchidas.
  - **Total pago** só precisa ser preenchido se a nota teve desconto; sem isso ele usa a soma dos itens. É esse valor que é debitado do vale.
  - A foto da nota é anexo opcional, guardada só para consulta.

> Houve uma tentativa de ler a nota automaticamente por OCR (Tesseract). Foi medida contra uma nota real de 35 itens e chegou a no máximo 14 preços corretos — com erros silenciosos, do tipo `22,76` virar `22,15`. Como preço errado contamina o histórico, que é o propósito do app, o OCR foi removido. Se um dia valer a pena automatizar, o caminho é a chave de acesso do QR code da NFC-e, não a foto.

---

### Rodando localmente (opcional, para eu continuar ajustando o app)

```bash
cd "C:\ASSISTENTE DE MERCADO"
cp .env.local.example .env.local   # preencha com os mesmos valores do passo 3
npm install
npm run dev
```

Abra `http://localhost:3000`.
