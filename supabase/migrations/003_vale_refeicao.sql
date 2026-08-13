-- Duas carteiras: vale alimentação e vale refeição.
--
-- O app nasceu assumindo uma carteira só ("pago_vale_alimentacao boolean").
-- Na prática o hortifruti aceita refeição, o atacadão aceita alimentação, e
-- restaurante/bar sai do refeição — então a carteira precisa ser escolhida
-- por lançamento, e cada uma tem saldo e recarga próprios.
--
-- Também generaliza "compra" para "lançamento": restaurante é uma compra sem
-- itens. Assim o extrato, o saldo e a futura análise de gastos rodam todos
-- sobre a mesma tabela.

-- ── 1. carteira nas transações do vale ──────────────────────────────────
alter table vale_transacoes
  add column if not exists carteira text not null default 'alimentacao';
create index if not exists vale_transacoes_carteira_idx on vale_transacoes(carteira);

-- ── 2. compras: qual carteira pagou e que tipo de gasto é ───────────────
alter table compras add column if not exists carteira text not null default 'alimentacao';
alter table compras add column if not exists categoria text not null default 'mercado';
create index if not exists compras_categoria_idx on compras(categoria);

-- migra o booleano antigo antes de removê-lo: quem não era vale alimentação
-- virou "outro" (dinheiro, cartão próprio), que é o que o booleano false
-- significava na prática
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'compras' and column_name = 'pago_vale_alimentacao'
  ) then
    update compras
      set carteira = case when pago_vale_alimentacao then 'alimentacao' else 'outro' end;
    alter table compras drop column pago_vale_alimentacao;
  end if;
end $$;

-- ── 3. vale_config: uma linha por carteira ──────────────────────────────
-- era singleton travado em id = 1
alter table vale_config drop constraint if exists vale_config_id_check;
alter table vale_config add column if not exists carteira text;
update vale_config set carteira = 'alimentacao' where carteira is null;
create unique index if not exists vale_config_carteira_idx on vale_config(carteira);

insert into vale_config (id, carteira, valor_recarga, dia_do_mes, ativo)
  select 2, 'refeicao', 0, 1, true
  where not exists (select 1 from vale_config where carteira = 'refeicao');

-- ── 4. saldo por carteira ───────────────────────────────────────────────
-- a subquery (em vez de group by) garante que uma carteira sem nenhuma
-- movimentação ainda apareça, com saldo zero
drop view if exists vale_saldo;
create view vale_saldo as
  select
    c.carteira,
    coalesce(
      (select sum(t.valor) from vale_transacoes t where t.carteira = c.carteira),
      0
    )::numeric(10,2) as saldo
  from (select 'alimentacao' as carteira union all select 'refeicao') c;
