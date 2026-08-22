import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { formatarMoeda, formatarData } from "@/lib/format";
import { CARTEIRAS_VALE, ROTULO_CARTEIRA, ROTULO_CATEGORIA } from "@/lib/carteiras";
import {
  cestaPrincipal,
  comparativoMercados,
  economiaPotencial,
  gastoPorCategoria,
  gastoPorDiaSemana,
  gastoPorEstabelecimento,
  ritmoDoMes,
  variacaoPrecos,
  type CompraBruta,
  type ItemBruto,
} from "@/lib/insights";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const supabase = supabaseAdmin();

  const [
    { data: mercados },
    { data: produtos },
    { data: comprasRaw },
    { data: itensRaw },
    { data: transacoes },
    { data: saldoRows },
    { data: configRows },
  ] = await Promise.all([
    supabase.from("mercados").select("id, nome"),
    supabase.from("produtos").select("id, nome_canonico"),
    supabase.from("compras").select("id, data_compra, valor_total, categoria, carteira, mercado_id"),
    supabase.from("itens_compra").select("compra_id, produto_id, quantidade, unidade, preco_total"),
    supabase.from("vale_transacoes").select("carteira, valor, data"),
    supabase.from("vale_saldo").select("carteira, saldo"),
    supabase.from("vale_config").select("carteira, dia_do_mes, ativo"),
  ]);

  const nomeMercado = new Map((mercados ?? []).map((m) => [m.id, m.nome]));
  const nomeProduto = new Map((produtos ?? []).map((p) => [p.id, p.nome_canonico]));
  const dadosCompra = new Map((comprasRaw ?? []).map((c) => [c.id, c]));

  const compras: CompraBruta[] = (comprasRaw ?? []).map((c) => ({
    data: c.data_compra,
    valor_total: c.valor_total,
    categoria: c.categoria,
    carteira: c.carteira,
    mercado_nome: nomeMercado.get(c.mercado_id) ?? "—",
  }));

  const itens: ItemBruto[] = [];
  for (const item of itensRaw ?? []) {
    const compra = dadosCompra.get(item.compra_id);
    if (!compra) continue;
    itens.push({
      produto_id: item.produto_id,
      produto_nome: nomeProduto.get(item.produto_id) ?? "—",
      mercado_id: compra.mercado_id,
      mercado_nome: nomeMercado.get(compra.mercado_id) ?? "—",
      data: compra.data_compra,
      quantidade: item.quantidade,
      unidade: item.unidade,
      preco_total: item.preco_total,
    });
  }

  const saldos: Record<string, number> = {};
  for (const s of saldoRows ?? []) saldos[s.carteira] = s.saldo;

  // só conta "dias até a recarga" pra carteira que tem recarga ativa
  // configurada — sem isso não existe uma próxima data pra apontar
  const diasRecarga: Record<string, number> = {};
  for (const c of configRows ?? []) if (c.ativo) diasRecarga[c.carteira] = c.dia_do_mes;

  const comparativo = comparativoMercados(itens);
  const economia = economiaPotencial(itens);
  const variacoes = variacaoPrecos(itens);
  const cesta = cestaPrincipal(itens);
  const porCategoria = gastoPorCategoria(compras);
  const porEstabelecimento = gastoPorEstabelecimento(compras);
  const porDia = gastoPorDiaSemana(compras);
  const ritmo = ritmoDoMes(transacoes ?? [], saldos, diasRecarga, [...CARTEIRAS_VALE]);

  const destaque = comparativo.find((c) => c.diferencaPct >= 5);
  const totalGasto = compras.reduce((s, c) => s + c.valor_total, 0);

  if (compras.length === 0) {
    return (
      <div className="mx-auto max-w-md p-4 pb-24">
        <h1 className="mb-1 text-lg font-semibold text-alelo-900">Insights</h1>
        <p className="mb-6 text-sm text-neutral-500">
          Aqui é onde o histórico vira resposta.
        </p>
        <div className="rounded-xl border border-dashed border-alelo-200 bg-white p-6 text-center">
          <p className="mb-1 text-sm font-medium text-alelo-800">Nada pra mostrar ainda</p>
          <p className="mb-4 text-sm text-neutral-500">
            Registre sua primeira compra e esta tela começa a se montar sozinha.
          </p>
          <Link
            href="/registrar"
            className="inline-block rounded-lg bg-alelo-500 px-4 py-2 text-sm font-medium text-white"
          >
            Registrar compra
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md p-4 pb-24">
      <h1 className="mb-1 text-lg font-semibold text-alelo-900">Insights</h1>
      <p className="mb-5 text-sm text-neutral-500">
        {compras.length} {compras.length === 1 ? "lançamento" : "lançamentos"} ·{" "}
        {formatarMoeda(totalGasto)} no total
      </p>

      {/* ── destaque: a diferença de preço que mais pesa ──────────────── */}
      {destaque && (
        <div className="mb-5 rounded-2xl bg-gradient-to-br from-alelo-600 to-alelo-800 p-5 text-white shadow-sm">
          <p className="mb-1 text-xs uppercase tracking-wide text-alelo-200">
            Maior diferença de preço
          </p>
          <p className="mb-3 text-xl font-semibold leading-tight">{destaque.produto}</p>
          <div className="space-y-1.5">
            {destaque.mercados.map((m, i) => (
              <div key={m.mercado} className="flex items-baseline justify-between gap-3 text-sm">
                <span className={i === 0 ? "font-medium" : "text-alelo-200"}>
                  {i === 0 && "✓ "}
                  {m.mercado}
                </span>
                <span className={i === 0 ? "font-semibold" : "text-alelo-200"}>
                  {formatarMoeda(m.preco)}/{destaque.unidade}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 border-t border-white/20 pt-3 text-sm text-alelo-100">
            Comprando no {destaque.mercados[0].mercado} você paga{" "}
            <strong className="text-white">{destaque.diferencaPct.toFixed(0)}% menos</strong>.
          </p>
        </div>
      )}

      {/* ── onde comprar mais barato ──────────────────────────────────── */}
      <Secao
        titulo="Onde comprar mais barato"
        subtitulo="Produtos que você já comprou em mais de um lugar"
        vazio={
          comparativo.length === 0
            ? "Compre um mesmo produto em dois mercados diferentes e a comparação aparece aqui."
            : null
        }
      >
        <div className="space-y-3">
          {comparativo.slice(0, 8).map((c) => {
            const maior = c.mercados[c.mercados.length - 1].preco;
            return (
              <div key={c.produto_id} className="rounded-xl border border-alelo-100 bg-white p-3">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <Link
                    href={`/produtos/${c.produto_id}`}
                    className="truncate text-sm font-medium text-alelo-800 underline decoration-alelo-200"
                  >
                    {c.produto}
                  </Link>
                  <span className="shrink-0 text-xs font-medium text-red-600">
                    +{c.diferencaPct.toFixed(0)}%
                  </span>
                </div>
                <div className="space-y-1.5">
                  {c.mercados.map((m, i) => (
                    <div key={m.mercado}>
                      <div className="mb-0.5 flex items-baseline justify-between text-xs">
                        <span className={i === 0 ? "font-medium text-emerald-700" : "text-neutral-600"}>
                          {m.mercado}
                        </span>
                        <span className={i === 0 ? "font-medium text-emerald-700" : "text-neutral-500"}>
                          {formatarMoeda(m.preco)}/{c.unidade}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                        <div
                          className={`h-full rounded-full ${i === 0 ? "bg-emerald-500" : "bg-alelo-300"}`}
                          style={{ width: `${(m.preco / maior) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {economia > 0.5 && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            Somando tudo, comprar sempre no mais barato teria custado{" "}
            <strong>{formatarMoeda(economia)}</strong> a menos. É uma referência, não uma meta —
            nem sempre compensa atravessar a cidade por causa disso.
          </p>
        )}
      </Secao>

      {/* ── variação de preço ─────────────────────────────────────────── */}
      <Secao
        titulo="Subiu e desceu"
        subtitulo="Primeira contra a última compra de cada produto"
        vazio={
          variacoes.length === 0
            ? "Compre o mesmo produto em duas datas diferentes pra ver o preço se mexer."
            : null
        }
      >
        <div className="space-y-2">
          {variacoes.slice(0, 8).map((v) => (
            <div
              key={v.produto_id}
              className="flex items-center justify-between gap-3 rounded-lg border border-alelo-100 bg-white p-3"
            >
              <div className="min-w-0">
                <Link
                  href={`/produtos/${v.produto_id}`}
                  className="block truncate text-sm font-medium text-alelo-800"
                >
                  {v.produto}
                </Link>
                <p className="text-xs text-neutral-500">
                  {formatarMoeda(v.primeiro)} → {formatarMoeda(v.ultimo)} por {v.unidade}
                </p>
                <p className="text-[11px] text-neutral-400">
                  {formatarData(v.dataPrimeiro)} a {formatarData(v.dataUltimo)}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${
                  v.variacaoPct > 0
                    ? "bg-red-50 text-red-700"
                    : v.variacaoPct < 0
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-neutral-100 text-neutral-500"
                }`}
              >
                {v.variacaoPct > 0 ? "↑" : v.variacaoPct < 0 ? "↓" : "="}{" "}
                {Math.abs(v.variacaoPct).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </Secao>

      {/* ── cesta ─────────────────────────────────────────────────────── */}
      <Secao
        titulo="O que mais pesa na conta"
        subtitulo="Produtos por quanto você já gastou neles"
        vazio={cesta.length === 0 ? "Registre uma compra com itens pra ver sua cesta." : null}
      >
        <div className="space-y-2">
          {cesta.map((p) => (
            <div key={p.produto_id}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <Link href={`/produtos/${p.produto_id}`} className="truncate text-neutral-700">
                  {p.produto}
                </Link>
                <span className="shrink-0 font-medium text-alelo-900">
                  {formatarMoeda(p.gasto)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-alelo-400 to-alelo-600"
                  style={{ width: `${Math.max(2, p.pct)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Secao>

      {/* ── para onde vai o dinheiro ──────────────────────────────────── */}
      <Secao titulo="Para onde vai o dinheiro" subtitulo="Por tipo de gasto" vazio={null}>
        <div className="mb-4 space-y-2">
          {porCategoria.map((f) => (
            <FatiaBarra
              key={f.rotulo}
              rotulo={ROTULO_CATEGORIA[f.rotulo as keyof typeof ROTULO_CATEGORIA] ?? f.rotulo}
              valor={f.valor}
              pct={f.pct}
            />
          ))}
        </div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
          Por estabelecimento
        </p>
        <div className="space-y-2">
          {porEstabelecimento.slice(0, 6).map((f) => (
            <FatiaBarra key={f.rotulo} rotulo={f.rotulo} valor={f.valor} pct={f.pct} />
          ))}
        </div>
      </Secao>

      {/* ── dia da semana ─────────────────────────────────────────────── */}
      <Secao
        titulo="Que dia você gasta mais"
        subtitulo="Somando todos os lançamentos por dia da semana"
        vazio={null}
      >
        <GraficoSemana dados={porDia} />
      </Secao>

      {/* ── ritmo do vale ─────────────────────────────────────────────── */}
      <Secao titulo="Ritmo do mês" subtitulo="Entradas e saídas de cada vale neste mês" vazio={null}>
        <div className="space-y-3">
          {ritmo.map((r) => (
            <div key={r.carteira} className="rounded-xl border border-alelo-100 bg-white p-3">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-sm font-medium text-alelo-800">
                  {ROTULO_CARTEIRA[r.carteira as keyof typeof ROTULO_CARTEIRA] ?? r.carteira}
                </span>
                <span className="text-sm font-semibold text-alelo-900">
                  {formatarMoeda(r.saldo)}
                </span>
              </div>
              <div className="flex gap-4 text-xs text-neutral-500">
                <span>
                  entrou <strong className="text-emerald-700">{formatarMoeda(r.entrou)}</strong>
                </span>
                <span>
                  saiu <strong className="text-neutral-700">{formatarMoeda(r.saiu)}</strong>
                </span>
              </div>
              {r.porDiaRestante !== null && r.saldo > 0 && (
                <p className="mt-2 border-t border-alelo-50 pt-2 text-xs text-neutral-500">
                  Dá <strong className="text-alelo-800">{formatarMoeda(r.porDiaRestante)}</strong> por
                  dia nos {r.diasRestantes} dias que faltam para a próxima recarga.
                </p>
              )}
              {r.saldo <= 0 && r.entrou > 0 && (
                <p className="mt-2 border-t border-alelo-50 pt-2 text-xs text-neutral-500">
                  Saldo zerado — a próxima recarga é a que vai repor.
                </p>
              )}
              {r.saldo > 0 && r.porDiaRestante === null && (
                <p className="mt-2 border-t border-alelo-50 pt-2 text-xs text-neutral-500">
                  {r.recargaConfigurada
                    ? "A recarga cai hoje."
                    : "Configure o dia da recarga acima para ver quanto sobra por dia até lá."}
                </p>
              )}
            </div>
          ))}
        </div>
      </Secao>
    </div>
  );
}

// ── peças visuais ───────────────────────────────────────────────────────

function Secao({
  titulo,
  subtitulo,
  vazio,
  children,
}: {
  titulo: string;
  subtitulo: string;
  vazio: string | null;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h2 className="text-sm font-semibold text-alelo-900">{titulo}</h2>
      <p className="mb-3 text-xs text-neutral-400">{subtitulo}</p>
      {vazio ? (
        <p className="rounded-lg border border-dashed border-alelo-200 bg-white px-3 py-4 text-center text-xs text-neutral-500">
          {vazio}
        </p>
      ) : (
        children
      )}
    </section>
  );
}

function FatiaBarra({ rotulo, valor, pct }: { rotulo: string; valor: number; pct: number }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span className="truncate text-neutral-700">{rotulo}</span>
        <span className="shrink-0 text-neutral-500">
          {formatarMoeda(valor)} <span className="text-xs text-neutral-400">{pct.toFixed(0)}%</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-alelo-400 to-alelo-600"
          style={{ width: `${Math.max(2, pct)}%` }}
        />
      </div>
    </div>
  );
}

// Gráfico de barras em SVG: escala com viewBox (fica nítido em qualquer
// tamanho de tela), grade de referência atrás das barras, valor escrito em
// cima de cada uma e o dia campeão destacado com cor sólida.
function GraficoSemana({ dados }: { dados: { dia: string; valor: number }[] }) {
  const maiorValor = Math.max(...dados.map((d) => d.valor), 0);
  const temDados = maiorValor > 0;
  const campeao = temDados ? dados.reduce((a, b) => (b.valor > a.valor ? b : a)) : null;

  const LARGURA = 320;
  const ALTURA = 190;
  const MARGEM_TOPO = 26; // espaço pro valor acima da barra mais alta
  const MARGEM_BASE = 22; // espaço pro rótulo do dia
  const ALTURA_UTIL = ALTURA - MARGEM_TOPO - MARGEM_BASE;
  const linhaBase = ALTURA - MARGEM_BASE;

  const larguraColuna = LARGURA / dados.length;
  const larguraBarra = larguraColuna * 0.5;

  // grade de referência em 25/50/75/100% do maior valor do período
  const grade = temDados ? [0.25, 0.5, 0.75, 1] : [];

  return (
    <div>
      <svg
        viewBox={`0 0 ${LARGURA} ${ALTURA}`}
        className="w-full"
        role="img"
        aria-label={
          campeao
            ? `Gasto por dia da semana. Dia mais alto: ${campeao.dia}, ${formatarMoeda(campeao.valor)}.`
            : "Gasto por dia da semana, sem dados ainda."
        }
      >
        {grade.map((fracao) => {
          const y = linhaBase - fracao * ALTURA_UTIL;
          return (
            <line
              key={fracao}
              x1={0}
              y1={y}
              x2={LARGURA}
              y2={y}
              stroke="var(--color-alelo-50)"
              strokeWidth={1}
            />
          );
        })}
        <line x1={0} y1={linhaBase} x2={LARGURA} y2={linhaBase} stroke="var(--color-alelo-200)" strokeWidth={1} />

        {dados.map((d, i) => {
          const x = i * larguraColuna + (larguraColuna - larguraBarra) / 2;
          const alturaBarra = temDados ? Math.max(d.valor > 0 ? 3 : 0, (d.valor / maiorValor) * ALTURA_UTIL) : 0;
          const y = linhaBase - alturaBarra;
          const ehCampeao = campeao !== null && d.dia === campeao.dia && d.valor === campeao.valor;

          return (
            <g key={d.dia}>
              {d.valor > 0 && (
                <text
                  x={x + larguraBarra / 2}
                  y={y - 6}
                  textAnchor="middle"
                  fontSize={9}
                  fill={ehCampeao ? "var(--color-alelo-700)" : "var(--color-alelo-400)"}
                  fontWeight={ehCampeao ? 600 : 400}
                >
                  {Math.round(d.valor)}
                </text>
              )}
              <rect
                x={x}
                y={y}
                width={larguraBarra}
                height={alturaBarra}
                rx={3}
                fill={ehCampeao ? "var(--color-alelo-600)" : "var(--color-alelo-200)"}
              />
              <text
                x={x + larguraColuna / 2}
                y={ALTURA - 6}
                textAnchor="middle"
                fontSize={10}
                fill="var(--color-alelo-700)"
              >
                {d.dia}
              </text>
            </g>
          );
        })}
      </svg>
      {campeao && (
        <p className="mt-1 text-xs text-neutral-500">
          Seu dia mais caro é <strong className="text-alelo-800">{campeao.dia}</strong>, com{" "}
          {formatarMoeda(campeao.valor)} acumulados.
        </p>
      )}
    </div>
  );
}
