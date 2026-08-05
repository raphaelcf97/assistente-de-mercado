-- Assistente de Mercado — schema do banco
-- Rode este arquivo inteiro no SQL Editor do Supabase, em um projeto novo.
-- Só é acessado pela chave service_role (server-side) — por isso RLS fica
-- ligado em todas as tabelas sem nenhuma policy: anon/authenticated não
-- enxergam nada, service_role ignora RLS normalmente.

create extension if not exists pgcrypto;

-- ── Mercados ────────────────────────────────────────────────────────────
create table mercados (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  apelido text,
  created_at timestamptz not null default now()
);
alter table mercados enable row level security;

-- ── Produtos ────────────────────────────────────────────────────────────
create table produtos (
  id uuid primary key default gen_random_uuid(),
  nome_canonico text not null,
  unidade_padrao text,
  created_at timestamptz not null default now()
);
alter table produtos enable row level security;

-- nomes alternativos já confirmados pelo usuário como o mesmo produto
create table produto_aliases (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references produtos(id) on delete cascade,
  nome_alias text not null,
  created_at timestamptz not null default now()
);
alter table produto_aliases enable row level security;

-- ── Compras ─────────────────────────────────────────────────────────────
create table compras (
  id uuid primary key default gen_random_uuid(),
  mercado_id uuid not null references mercados(id),
  data_compra date not null,
  valor_total numeric(10,2) not null,
  forma_pagamento_detectada text,       -- texto livre lido na nota (informativo)
  pago_vale_alimentacao boolean not null default true,
  foto_url text,
  created_at timestamptz not null default now()
);
create index compras_mercado_idx on compras(mercado_id);
create index compras_data_idx on compras(data_compra);
alter table compras enable row level security;

create table itens_compra (
  id uuid primary key default gen_random_uuid(),
  compra_id uuid not null references compras(id) on delete cascade,
  produto_id uuid not null references produtos(id),
  nome_lido_na_nota text not null,
  quantidade numeric(10,3) not null default 1,
  unidade text,
  preco_unitario numeric(10,2),
  preco_total numeric(10,2) not null
);
create index itens_compra_compra_idx on itens_compra(compra_id);
create index itens_compra_produto_idx on itens_compra(produto_id);
alter table itens_compra enable row level security;

-- ── Vale alimentação ────────────────────────────────────────────────────
-- linha única (singleton) com a configuração de recarga mensal
create table vale_config (
  id int primary key default 1 check (id = 1),
  valor_recarga numeric(10,2) not null default 0,
  dia_do_mes int not null default 1 check (dia_do_mes between 1 and 28),
  ativo boolean not null default true
);
insert into vale_config (id, valor_recarga, dia_do_mes, ativo) values (1, 0, 1, true);
alter table vale_config enable row level security;

create type vale_transacao_tipo as enum ('recarga', 'compra', 'ajuste');

-- extrato: valor positivo = crédito, negativo = débito; saldo = soma(valor)
create table vale_transacoes (
  id uuid primary key default gen_random_uuid(),
  tipo vale_transacao_tipo not null,
  valor numeric(10,2) not null,
  data date not null default current_date,
  compra_id uuid references compras(id) on delete set null,
  descricao text,
  created_at timestamptz not null default now()
);
create index vale_transacoes_data_idx on vale_transacoes(data);
alter table vale_transacoes enable row level security;

-- ── Views auxiliares ────────────────────────────────────────────────────
create view vale_saldo as
  select coalesce(sum(valor), 0)::numeric(10,2) as saldo from vale_transacoes;

create view historico_precos as
  select
    ic.produto_id,
    c.mercado_id,
    m.nome as mercado_nome,
    avg(ic.preco_unitario)::numeric(10,2) as preco_medio,
    count(*) as quantidade_compras,
    max(c.data_compra) as ultima_compra
  from itens_compra ic
  join compras c on c.id = ic.compra_id
  join mercados m on m.id = c.mercado_id
  where ic.preco_unitario is not null
  group by ic.produto_id, c.mercado_id, m.nome;
