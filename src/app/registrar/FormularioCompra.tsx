"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { comprimirImagem } from "@/lib/comprimir-imagem";
import { formatarMoeda, formatarData } from "@/lib/format";
import { normalizarNome } from "@/lib/matching";
import { precoPorUnidadeDoItem, type UnidadeBase } from "@/lib/preco-unitario";
import { UNIDADES, medidaNaDescricao, type UnidadeMedida } from "@/lib/unidades";
import {
  CARTEIRAS,
  CATEGORIAS_SEM_ITENS,
  ROTULO_CARTEIRA,
  ROTULO_CATEGORIA,
  type Carteira,
  type CategoriaCompra,
} from "@/lib/carteiras";
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
  saldos,
}: {
  mercados: { id: string; nome: string }[];
  produtos: ProdutoConhecido[];
  saldos: Record<string, number>;
}) {
  const router = useRouter();

  // "mercado" é o lançamento com produtos, que alimenta o histórico de
  // preços. "fora" é gasto avulso (restaurante, bar, delivery): só valor,
  // lugar e data — existe pra que o saldo do vale feche com a realidade.
  const [modo, setModo] = useState<"mercado" | "fora">("mercado");
  const [categoriaFora, setCategoriaFora] = useState<CategoriaCompra>("restaurante");
  const [carteira, setCarteira] = useState<Carteira>("alimentacao");

  const [local, setLocal] = useState("");
  const [dataCompra, setDataCompra] = useState(hoje);
  const [itens, setItens] = useState<ItemForm[]>([{ ...ITEM_VAZIO }]);
  const [totalPago, setTotalPago] = useState("");
  const [valorAvulso, setValorAvulso] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [concluido, setConcluido] = useState(false);

  const categoria: CategoriaCompra = modo === "mercado" ? "mercado" : categoriaFora;

  const porNome = useMemo(() => {
    const mapa = new Map<string, ProdutoConhecido>();
    for (const p of produtos) mapa.set(normalizarNome(p.nome), p);
    return mapa;
  }, [produtos]);

  const localId = useMemo(() => {
    const alvo = normalizarNome(local);
    return mercados.find((m) => normalizarNome(m.nome) === alvo)?.id ?? null;
  }, [local, mercados]);

  const somaItens = itens.reduce((acc, it) => acc + num(it.precoTotal), 0);
  const itensValidos = itens.filter((it) => it.descricao.trim() && num(it.precoTotal) > 0);

  const valorFinal =
    modo === "fora"
      ? num(valorAvulso)
      : num(totalPago) > 0
        ? num(totalPago)
        : somaItens;

  const podeSalvar =
    Boolean(local.trim()) &&
    Boolean(dataCompra) &&
    (modo === "mercado" ? itensValidos.length > 0 : valorFinal > 0) &&
    !salvando;

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

    const payload: CompraConfirmada = {
      mercado_nome: local.trim(),
      mercado_id: localId,
      data_compra: dataCompra,
      valor_total: valorFinal,
      forma_pagamento_detectada: carteira === "outro" ? null : `Vale ${ROTULO_CARTEIRA[carteira]}`,
      carteira,
      categoria,
      itens:
        modo === "mercado"
          ? itensValidos.map((item) => ({
              nome_lido_na_nota: item.descricao.trim(),
              quantidade: num(item.quantidade) || 1,
              unidade: item.unidade || null,
              preco_unitario: null,
              preco_total: num(item.precoTotal),
              produto_id: item.produtoId,
              novo_produto_nome: item.produtoId ? null : item.descricao.trim(),
            }))
          : [],
    };

    try {
      const fd = new FormData();
      fd.append("payload", JSON.stringify(payload));
      if (foto) fd.append("foto", foto);
      const res = await fetch("/api/compras", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErro(data.erro ?? "Não foi possível salvar.");
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
        <h1 className="mb-2 text-lg font-semibold text-alelo-900">Lançamento salvo!</h1>
        <p className="mb-6 text-sm text-neutral-500">
          {modo === "mercado" ? (
            <>
              {itensValidos.length} {itensValidos.length === 1 ? "item entrou" : "itens entraram"} no
              seu histórico de preços.
            </>
          ) : (
            <>{formatarMoeda(valorFinal)} registrado.</>
          )}
          {carteira !== "outro" && ` Debitado do vale ${ROTULO_CARTEIRA[carteira].toLowerCase()}.`}
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => router.push(modo === "mercado" ? "/produtos" : "/vale")}
            className="rounded-lg bg-alelo-500 py-3 font-medium text-white hover:bg-alelo-600"
          >
            {modo === "mercado" ? "Ver meus produtos" : "Ver saldo"}
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg border border-alelo-200 py-3 font-medium text-alelo-700"
          >
            Registrar outro
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md p-4 pb-28">
      <h1 className="mb-4 text-lg font-semibold text-alelo-900">Registrar</h1>

      {erro && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      {/* ── o que é ─────────────────────────────────────────────────── */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        {(
          [
            ["mercado", "Compra de mercado", "com produtos"],
            ["fora", "Gasto fora", "só o valor"],
          ] as const
        ).map(([valor, titulo, sub]) => (
          <button
            key={valor}
            type="button"
            onClick={() => setModo(valor)}
            className={`rounded-xl border px-3 py-3 text-left transition-colors ${
              modo === valor
                ? "border-alelo-500 bg-alelo-50"
                : "border-alelo-100 bg-white hover:bg-alelo-50/40"
            }`}
          >
            <span
              className={`block text-sm font-medium ${
                modo === valor ? "text-alelo-800" : "text-neutral-700"
              }`}
            >
              {titulo}
            </span>
            <span className="text-xs text-neutral-500">{sub}</span>
          </button>
        ))}
      </div>

      {/* ── cabeçalho ───────────────────────────────────────────────── */}
      <div className="mb-5 space-y-3 rounded-xl border border-alelo-100 bg-white p-4">
        {modo === "fora" && (
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Tipo</label>
            <select
              value={categoriaFora}
              onChange={(e) => setCategoriaFora(e.target.value as CategoriaCompra)}
              className="w-full rounded-lg border border-alelo-200 px-3 py-2 outline-none focus:border-alelo-500"
            >
              {CATEGORIAS_SEM_ITENS.map((c) => (
                <option key={c} value={c}>
                  {ROTULO_CATEGORIA[c]}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">
            {modo === "mercado" ? "Mercado" : "Estabelecimento"}
          </label>
          <input
            list="lista-locais"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder={modo === "mercado" ? "Onde você comprou" : "Nome do lugar"}
            className="w-full rounded-lg border border-alelo-200 px-3 py-2 outline-none focus:border-alelo-500"
          />
          <datalist id="lista-locais">
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

        {/* ── carteira ──────────────────────────────────────────────── */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-neutral-600">Pago com</label>
          <div className="grid grid-cols-3 gap-2">
            {CARTEIRAS.map((c) => {
              const ativo = carteira === c;
              const saldo = saldos[c];
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCarteira(c)}
                  className={`rounded-lg border px-2 py-2 text-center transition-colors ${
                    ativo
                      ? "border-alelo-500 bg-alelo-500 text-white"
                      : "border-alelo-200 bg-white text-neutral-700 hover:bg-alelo-50"
                  }`}
                >
                  <span className="block text-xs font-medium">{ROTULO_CARTEIRA[c]}</span>
                  {saldo !== undefined && (
                    <span className={`block text-[10px] ${ativo ? "text-alelo-100" : "text-neutral-400"}`}>
                      {formatarMoeda(saldo)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {carteira === "outro" && (
            <p className="mt-1.5 text-xs text-neutral-400">
              Dinheiro, Pix ou cartão próprio — o gasto entra no histórico mas não debita vale.
            </p>
          )}
        </div>
      </div>

      {/* ── itens (só compra de mercado) ────────────────────────────── */}
      {modo === "mercado" ? (
        <>
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
                Só preencha se a nota teve desconto e o valor pago foi diferente da soma. É esse
                valor que sai do vale.
              </p>
            </div>

            <FotoOpcional onSelecionar={selecionarFoto} />
          </div>
        </>
      ) : (
        <div className="space-y-3 rounded-xl border border-alelo-100 bg-white p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Valor pago</label>
            <input
              inputMode="decimal"
              value={valorAvulso}
              onChange={(e) => setValorAvulso(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-lg border border-alelo-200 px-3 py-2 text-lg outline-none focus:border-alelo-500"
            />
          </div>
          <FotoOpcional onSelecionar={selecionarFoto} rotulo="Foto do comprovante (opcional)" />
        </div>
      )}

      <button
        onClick={salvar}
        disabled={!podeSalvar}
        className="mt-4 w-full rounded-lg bg-alelo-500 py-3 font-medium text-white transition-colors hover:bg-alelo-600 disabled:opacity-40"
      >
        {salvando ? "Salvando..." : "Salvar"}
      </button>
    </div>
  );
}

function FotoOpcional({
  onSelecionar,
  rotulo = "Foto da nota (opcional)",
}: {
  onSelecionar: (e: React.ChangeEvent<HTMLInputElement>) => void;
  rotulo?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-neutral-600">{rotulo}</label>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onSelecionar}
        className="block w-full text-sm text-neutral-500"
      />
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
