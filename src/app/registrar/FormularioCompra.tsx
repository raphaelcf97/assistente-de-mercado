"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { comprimirImagem } from "@/lib/comprimir-imagem";
import { formatarMoeda, formatarData } from "@/lib/format";
import { normalizarNome } from "@/lib/matching";
import { precoPorUnidadeDoItem, type UnidadeBase } from "@/lib/preco-unitario";
import { UNIDADES, medidaNaDescricao, type UnidadeMedida } from "@/lib/unidades";
import type { CompraConfirmada } from "@/lib/types";

export type ProdutoConhecido = {
  id: string;
  nome: string;
  compras: number;
  precoMedio: { valor: number; unidade: UnidadeBase } | null;
  ultimo: { valor: number; unidade: UnidadeBase; data: string; mercado: string } | null;
};

type ItemForm = {
  descricao: string;
  quantidade: string;
  unidade: UnidadeMedida | "";
  precoTotal: string;
  produtoId: string | null;
};

const ITEM_VAZIO: ItemForm = {
  descricao: "",
  quantidade: "",
  unidade: "",
  precoTotal: "",
  produtoId: null,
};

// Entrada manual aceita vírgula (é o que o teclado brasileiro oferece) e
// ponto, sem tratar separador de milhar — ninguém digita "1.518" querendo
// mil e quinhentos numa linha de compra de mercado.
function num(v: string): number {
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function hoje(): string {
  return new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD no fuso local
}

export default function FormularioCompra({
  mercados,
  produtos,
}: {
  mercados: { id: string; nome: string }[];
  produtos: ProdutoConhecido[];
}) {
  const router = useRouter();

  const [mercadoNome, setMercadoNome] = useState("");
  const [dataCompra, setDataCompra] = useState(hoje);
  const [pagoVale, setPagoVale] = useState(true);
  const [itens, setItens] = useState<ItemForm[]>([{ ...ITEM_VAZIO }]);
  const [totalPago, setTotalPago] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [concluido, setConcluido] = useState(false);

  const porNome = useMemo(() => {
    const mapa = new Map<string, ProdutoConhecido>();
    for (const p of produtos) mapa.set(normalizarNome(p.nome), p);
    return mapa;
  }, [produtos]);

  const mercadoId = useMemo(() => {
    const alvo = normalizarNome(mercadoNome);
    return mercados.find((m) => normalizarNome(m.nome) === alvo)?.id ?? null;
  }, [mercadoNome, mercados]);

  const somaItens = itens.reduce((acc, it) => acc + num(it.precoTotal), 0);
  const itensValidos = itens.filter((it) => it.descricao.trim() && num(it.precoTotal) > 0);
  const podeSalvar =
    Boolean(mercadoNome.trim()) && Boolean(dataCompra) && itensValidos.length > 0 && !salvando;

  function atualizar(idx: number, mudanca: Partial<ItemForm>) {
    setItens((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const novo = { ...item, ...mudanca };

        // Ao digitar a descrição: vincula ao produto do histórico quando o
        // nome bate, e aproveita a medida embutida no nome ("LEITE 1L") pra
        // já preencher unidade e quantidade.
        if (mudanca.descricao !== undefined) {
          novo.produtoId = porNome.get(normalizarNome(novo.descricao))?.id ?? null;
          const pista = medidaNaDescricao(novo.descricao);
          if (pista && !item.unidade) {
            novo.unidade = pista.unidade;
            if (!item.quantidade) novo.quantidade = String(pista.quantidade);
          }
        }
        return novo;
      })
    );
  }

  function adicionarItem() {
    setItens((prev) => [...prev, { ...ITEM_VAZIO }]);
  }

  function removerItem(idx: number) {
    setItens((prev) => (prev.length === 1 ? [{ ...ITEM_VAZIO }] : prev.filter((_, i) => i !== idx)));
  }

  async function selecionarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return setFoto(null);
    try {
      setFoto(await comprimirImagem(arquivo));
    } catch {
      setFoto(arquivo);
    }
  }

  async function salvar() {
    if (!podeSalvar) return;
    setErro(null);
    setSalvando(true);

    const total = num(totalPago) > 0 ? num(totalPago) : somaItens;
    const payload: CompraConfirmada = {
      mercado_nome: mercadoNome.trim(),
      mercado_id: mercadoId,
      data_compra: dataCompra,
      valor_total: total,
      forma_pagamento_detectada: pagoVale ? "Vale Alimentação" : null,
      pago_vale_alimentacao: pagoVale,
      itens: itensValidos.map((item) => ({
        nome_lido_na_nota: item.descricao.trim(),
        quantidade: num(item.quantidade) || 1,
        unidade: item.unidade || null,
        preco_unitario: null,
        preco_total: num(item.precoTotal),
        produto_id: item.produtoId,
        novo_produto_nome: item.produtoId ? null : item.descricao.trim(),
      })),
    };

    try {
      const fd = new FormData();
      fd.append("payload", JSON.stringify(payload));
      if (foto) fd.append("foto", foto);
      const res = await fetch("/api/compras", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErro(data.erro ?? "Não foi possível salvar a compra.");
        setSalvando(false);
        return;
      }
      setConcluido(true);
    } catch {
      setErro("Falha de conexão ao salvar.");
      setSalvando(false);
    }
  }

  if (concluido) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <h1 className="mb-2 text-lg font-semibold text-alelo-900">Compra registrada!</h1>
        <p className="mb-6 text-sm text-neutral-500">
          {itensValidos.length} {itensValidos.length === 1 ? "item entrou" : "itens entraram"} no seu
          histórico de preços.
          {pagoVale && " O valor foi debitado do vale."}
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => router.push("/produtos")}
            className="rounded-lg bg-alelo-500 py-3 font-medium text-white hover:bg-alelo-600"
          >
            Ver meus produtos
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg border border-alelo-200 py-3 font-medium text-alelo-700"
          >
            Registrar outra compra
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md p-4 pb-28">
      <h1 className="mb-4 text-lg font-semibold text-alelo-900">Registrar compra</h1>

      {erro && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      {/* ── cabeçalho da compra ─────────────────────────────────────── */}
      <div className="mb-5 space-y-3 rounded-xl border border-alelo-100 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Mercado</label>
          <input
            list="lista-mercados"
            value={mercadoNome}
            onChange={(e) => setMercadoNome(e.target.value)}
            placeholder="Onde você comprou"
            className="w-full rounded-lg border border-alelo-200 px-3 py-2 outline-none focus:border-alelo-500"
          />
          <datalist id="lista-mercados">
            {mercados.map((m) => (
              <option key={m.id} value={m.nome} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Data</label>
          <input
            type="date"
            value={dataCompra}
            onChange={(e) => setDataCompra(e.target.value)}
            className="w-full rounded-lg border border-alelo-200 px-3 py-2 outline-none focus:border-alelo-500"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={pagoVale}
            onChange={(e) => setPagoVale(e.target.checked)}
            className="h-4 w-4 accent-alelo-500"
          />
          Pago com vale alimentação
        </label>
      </div>

      {/* ── itens ───────────────────────────────────────────────────── */}
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-neutral-700">Itens</h2>
        <span className="text-xs text-neutral-400">{itensValidos.length} lançados</span>
      </div>

      <div className="space-y-3">
        {itens.map((item, idx) => (
          <LinhaItem
            key={idx}
            item={item}
            indice={idx}
            total={itens.length}
            produto={item.produtoId ? produtos.find((p) => p.id === item.produtoId) ?? null : null}
            onMudar={(m) => atualizar(idx, m)}
            onRemover={() => removerItem(idx)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={adicionarItem}
        className="mt-3 w-full rounded-lg border border-dashed border-alelo-300 py-3 text-sm font-medium text-alelo-600 hover:bg-alelo-50"
      >
        + Adicionar item
      </button>

      <datalist id="lista-produtos">
        {produtos.map((p) => (
          <option key={p.id} value={p.nome} />
        ))}
      </datalist>

      {/* ── fechamento ──────────────────────────────────────────────── */}
      <div className="mt-5 space-y-3 rounded-xl border border-alelo-100 bg-white p-4">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-neutral-600">Soma dos itens</span>
          <span className="font-semibold text-alelo-900">{formatarMoeda(somaItens)}</span>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">
            Total pago {totalPago.trim() === "" && "(usa a soma acima)"}
          </label>
          <input
            inputMode="decimal"
            value={totalPago}
            onChange={(e) => setTotalPago(e.target.value)}
            placeholder={somaItens > 0 ? somaItens.toFixed(2).replace(".", ",") : "0,00"}
            className="w-full rounded-lg border border-alelo-200 px-3 py-2 outline-none focus:border-alelo-500"
          />
          <p className="mt-1 text-xs text-neutral-400">
            Só preencha se a nota teve desconto e o valor pago foi diferente da soma. É esse valor
            que sai do vale.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">
            Foto da nota (opcional)
          </label>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={selecionarFoto}
            className="block w-full text-sm text-neutral-500"
          />
        </div>
      </div>

      <button
        onClick={salvar}
        disabled={!podeSalvar}
        className="mt-4 w-full rounded-lg bg-alelo-500 py-3 font-medium text-white transition-colors hover:bg-alelo-600 disabled:opacity-40"
      >
        {salvando ? "Salvando..." : "Salvar compra"}
      </button>
    </div>
  );
}

// ── uma linha de item ──────────────────────────────────────────────────
function LinhaItem({
  item,
  indice,
  total,
  produto,
  onMudar,
  onRemover,
}: {
  item: ItemForm;
  indice: number;
  total: number;
  produto: ProdutoConhecido | null;
  onMudar: (m: Partial<ItemForm>) => void;
  onRemover: () => void;
}) {
  const precoPorMedida = precoPorUnidadeDoItem(
    num(item.quantidade),
    item.unidade || null,
    num(item.precoTotal)
  );

  // Só compara com o histórico quando as duas medidas estão na mesma base —
  // R$/kg não diz nada contra R$/un.
  const referencia =
    produto?.precoMedio && precoPorMedida && produto.precoMedio.unidade === precoPorMedida.unidade
      ? produto.precoMedio
      : null;
  const variacao = referencia ? (precoPorMedida!.valor / referencia.valor - 1) * 100 : null;

  return (
    <div className="rounded-xl border border-alelo-100 bg-white p-3">
      <div className="mb-2 flex items-start gap-2">
        <input
          list="lista-produtos"
          value={item.descricao}
          onChange={(e) => onMudar({ descricao: e.target.value })}
          placeholder="Descrição do produto"
          className="min-w-0 flex-1 rounded-lg border border-alelo-200 px-3 py-2 text-sm outline-none focus:border-alelo-500"
        />
        {total > 1 && (
          <button
            type="button"
            onClick={onRemover}
            aria-label={`Remover item ${indice + 1}`}
            className="shrink-0 rounded-lg px-2 py-2 text-lg leading-none text-neutral-300 hover:bg-red-50 hover:text-red-500"
          >
            ×
          </button>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] gap-2">
        <input
          inputMode="decimal"
          value={item.quantidade}
          onChange={(e) => onMudar({ quantidade: e.target.value })}
          placeholder="Qtd"
          className="w-full rounded-lg border border-alelo-200 px-2 py-2 text-sm outline-none focus:border-alelo-500"
        />
        <select
          value={item.unidade}
          onChange={(e) => onMudar({ unidade: e.target.value as UnidadeMedida | "" })}
          className="rounded-lg border border-alelo-200 px-2 py-2 text-sm outline-none focus:border-alelo-500"
        >
          <option value="">medida</option>
          {UNIDADES.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <input
          inputMode="decimal"
          value={item.precoTotal}
          onChange={(e) => onMudar({ precoTotal: e.target.value })}
          placeholder="R$ pago"
          className="w-full rounded-lg border border-alelo-200 px-2 py-2 text-sm outline-none focus:border-alelo-500"
        />
      </div>

      {/* o número que o app existe pra calcular */}
      {precoPorMedida && (
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-lg bg-alelo-50 px-3 py-2">
          <span className="text-base font-semibold text-alelo-800">
            {formatarMoeda(precoPorMedida.valor)}
          </span>
          <span className="text-xs text-alelo-600">por {precoPorMedida.unidade}</span>
          {variacao !== null && Math.abs(variacao) >= 1 && (
            <span
              className={`ml-auto text-xs font-medium ${
                variacao > 0 ? "text-red-600" : "text-emerald-600"
              }`}
            >
              {variacao > 0 ? "↑" : "↓"} {Math.abs(variacao).toFixed(0)}%{" "}
              {variacao > 0 ? "mais caro" : "mais barato"} que a média
            </span>
          )}
        </div>
      )}

      {/* histórico do produto, quando já existe */}
      {produto && (produto.precoMedio || produto.ultimo) && (
        <p className="mt-1.5 text-xs text-neutral-500">
          {produto.precoMedio && (
            <>
              média {formatarMoeda(produto.precoMedio.valor)}/{produto.precoMedio.unidade} em{" "}
              {produto.compras} {produto.compras === 1 ? "compra" : "compras"}
            </>
          )}
          {produto.ultimo && (
            <>
              {produto.precoMedio && " · "}
              última {formatarMoeda(produto.ultimo.valor)}/{produto.ultimo.unidade}
              {produto.ultimo.mercado && ` no ${produto.ultimo.mercado}`} em{" "}
              {formatarData(produto.ultimo.data)}
            </>
          )}
        </p>
      )}
      {item.descricao.trim() && !produto && (
        <p className="mt-1.5 text-xs text-neutral-400">Produto novo — vai começar o histórico.</p>
      )}
    </div>
  );
}
