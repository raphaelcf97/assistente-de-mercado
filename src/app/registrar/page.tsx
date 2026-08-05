"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CompraExtraida, CompraConfirmada, ItemExtraido } from "@/lib/types";

type ItemEmEdicao = ItemExtraido & {
  decisao: "confirmar" | "novo" | null;
  incerto: boolean;
};

type Etapa = "upload" | "extraindo" | "revisando" | "salvando" | "concluido";

export default function RegistrarPage() {
  const router = useRouter();
  const [etapa, setEtapa] = useState<Etapa>("upload");
  const [erro, setErro] = useState<string | null>(null);
  const [foto, setFoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [mercadoNome, setMercadoNome] = useState("");
  const [mercadoId, setMercadoId] = useState<string | null>(null);
  const [dataCompra, setDataCompra] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [pagoVale, setPagoVale] = useState(true);
  const [itens, setItens] = useState<ItemEmEdicao[]>([]);
  const [camposIncertos, setCamposIncertos] = useState<Set<string>>(new Set());

  function selecionarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setFoto(arquivo);
    setPreviewUrl(URL.createObjectURL(arquivo));
  }

  async function extrair() {
    if (!foto) return;
    setErro(null);
    setEtapa("extraindo");
    try {
      const fd = new FormData();
      fd.append("foto", foto);
      const res = await fetch("/api/compras/extrair", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErro(data.erro ?? "Não foi possível ler a nota.");
        setEtapa("upload");
        return;
      }
      const compra: CompraExtraida = data.compra;
      setMercadoNome(compra.mercado_nome ?? "");
      setMercadoId(compra.mercado_id);
      setDataCompra(compra.data_compra ?? "");
      setValorTotal(compra.valor_total != null ? String(compra.valor_total) : "");
      setFormaPagamento(compra.forma_pagamento_detectada ?? "");
      setCamposIncertos(new Set(compra.campos_incertos));
      setItens(
        compra.itens.map((item, i) => ({
          ...item,
          decisao: null,
          incerto: compra.campos_incertos.includes(`item_${i}`),
        }))
      );
      setEtapa("revisando");
    } catch {
      setErro("Falha de conexão ao extrair a nota.");
      setEtapa("upload");
    }
  }

  function atualizarItem(idx: number, campo: keyof ItemEmEdicao, valor: unknown) {
    setItens((prev) => prev.map((it, i) => (i === idx ? { ...it, [campo]: valor } : it)));
  }

  const pendencias = itens.some((it) => it.status === "match_parecido" && !it.decisao);
  const podeSalvar = Boolean(!pendencias && mercadoNome.trim() && dataCompra && valorTotal);

  async function salvar() {
    if (!foto || !podeSalvar) return;
    setErro(null);
    setEtapa("salvando");

    const payload: CompraConfirmada = {
      mercado_nome: mercadoNome.trim(),
      mercado_id: mercadoId,
      data_compra: dataCompra,
      valor_total: Number(valorTotal),
      forma_pagamento_detectada: formaPagamento.trim() || null,
      pago_vale_alimentacao: pagoVale,
      itens: itens.map((item) => {
        const produtoId =
          item.status === "match_exato"
            ? item.produto_id
            : item.status === "match_parecido" && item.decisao === "confirmar"
              ? item.sugestao_produto_id
              : null;
        return {
          nome_lido_na_nota: item.nome_lido_na_nota,
          quantidade: Number(item.quantidade),
          unidade: item.unidade || null,
          preco_unitario: item.preco_unitario != null ? Number(item.preco_unitario) : null,
          preco_total: Number(item.preco_total),
          produto_id: produtoId,
          novo_produto_nome: produtoId ? null : item.nome_lido_na_nota,
        };
      }),
    };

    try {
      const fd = new FormData();
      fd.append("foto", foto);
      fd.append("payload", JSON.stringify(payload));
      const res = await fetch("/api/compras", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErro(data.erro ?? "Não foi possível salvar a compra.");
        setEtapa("revisando");
        return;
      }
      setEtapa("concluido");
    } catch {
      setErro("Falha de conexão ao salvar.");
      setEtapa("revisando");
    }
  }

  function campoClasse(nome: string) {
    return camposIncertos.has(nome)
      ? "border-amber-400 bg-amber-50"
      : "border-neutral-300";
  }

  if (etapa === "concluido") {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <h1 className="mb-2 text-lg font-semibold">Compra registrada!</h1>
        <p className="mb-6 text-sm text-neutral-500">
          {pagoVale ? "O valor já foi debitado do seu vale alimentação." : "Compra salva com sucesso."}
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => router.push("/compras")}
            className="rounded-lg bg-neutral-900 py-3 font-medium text-white"
          >
            Ver histórico de compras
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg border border-neutral-300 py-3 font-medium"
          >
            Registrar outra compra
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md p-4 pb-24">
      <h1 className="mb-4 text-lg font-semibold">Registrar compra</h1>

      {erro && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
      )}

      {(etapa === "upload" || etapa === "extraindo") && (
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm text-neutral-600">Foto da nota fiscal</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={selecionarFoto}
              className="block w-full text-sm"
            />
          </label>
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Prévia da nota" className="w-full rounded-lg border border-neutral-200" />
          )}
          <button
            onClick={extrair}
            disabled={!foto || etapa === "extraindo"}
            className="w-full rounded-lg bg-neutral-900 py-3 font-medium text-white disabled:opacity-40"
          >
            {etapa === "extraindo" ? "Lendo nota..." : "Extrair dados"}
          </button>
        </div>
      )}

      {(etapa === "revisando" || etapa === "salvando") && (
        <div className="space-y-5">
          <div>
            <label className="mb-1 block text-sm text-neutral-600">Mercado</label>
            <input
              value={mercadoNome}
              onChange={(e) => setMercadoNome(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 ${campoClasse("mercado")}`}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-sm text-neutral-600">Data</label>
              <input
                type="date"
                value={dataCompra}
                onChange={(e) => setDataCompra(e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 ${campoClasse("data_compra")}`}
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm text-neutral-600">Valor total</label>
              <input
                type="number"
                step="0.01"
                value={valorTotal}
                onChange={(e) => setValorTotal(e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 ${campoClasse("valor_total")}`}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm text-neutral-600">Forma de pagamento (lida na nota)</label>
            <input
              value={formaPagamento}
              onChange={(e) => setFormaPagamento(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 ${campoClasse("forma_pagamento")}`}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={pagoVale}
              onChange={(e) => setPagoVale(e.target.checked)}
              className="h-4 w-4"
            />
            Pago com vale alimentação
          </label>

          <div>
            <h2 className="mb-2 text-sm font-medium text-neutral-700">Itens ({itens.length})</h2>
            <div className="space-y-3">
              {itens.map((item, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg border p-3 ${item.incerto ? "border-amber-400 bg-amber-50" : "border-neutral-200"}`}
                >
                  <input
                    value={item.nome_lido_na_nota}
                    onChange={(e) => atualizarItem(idx, "nome_lido_na_nota", e.target.value)}
                    className="mb-2 w-full rounded border border-neutral-300 px-2 py-1 text-sm font-medium"
                  />
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <input
                      type="number"
                      step="0.001"
                      value={item.quantidade}
                      onChange={(e) => atualizarItem(idx, "quantidade", e.target.value)}
                      placeholder="Qtd"
                      className="rounded border border-neutral-300 px-2 py-1"
                    />
                    <input
                      value={item.unidade ?? ""}
                      onChange={(e) => atualizarItem(idx, "unidade", e.target.value)}
                      placeholder="Un."
                      className="rounded border border-neutral-300 px-2 py-1"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={item.preco_total}
                      onChange={(e) => atualizarItem(idx, "preco_total", e.target.value)}
                      placeholder="Preço"
                      className="rounded border border-neutral-300 px-2 py-1"
                    />
                  </div>

                  {item.status === "match_parecido" && (
                    <div className="mt-2 rounded bg-blue-50 p-2 text-xs">
                      <p className="mb-1 text-blue-900">
                        Parece com <strong>{item.sugestao_produto_nome}</strong>, já no seu histórico. É o mesmo produto?
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => atualizarItem(idx, "decisao", "confirmar")}
                          className={`rounded px-2 py-1 ${item.decisao === "confirmar" ? "bg-blue-600 text-white" : "bg-white border border-blue-300"}`}
                        >
                          Mesmo produto
                        </button>
                        <button
                          type="button"
                          onClick={() => atualizarItem(idx, "decisao", "novo")}
                          className={`rounded px-2 py-1 ${item.decisao === "novo" ? "bg-blue-600 text-white" : "bg-white border border-blue-300"}`}
                        >
                          Produto diferente
                        </button>
                      </div>
                    </div>
                  )}
                  {item.status === "novo" && (
                    <p className="mt-2 text-xs text-neutral-500">Produto novo no seu histórico.</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={salvar}
            disabled={!podeSalvar || etapa === "salvando"}
            className="w-full rounded-lg bg-neutral-900 py-3 font-medium text-white disabled:opacity-40"
          >
            {etapa === "salvando" ? "Salvando..." : "Salvar compra"}
          </button>
        </div>
      )}
    </div>
  );
}
