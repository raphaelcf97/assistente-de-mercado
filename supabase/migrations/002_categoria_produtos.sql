-- Migration 002 — categoria dos produtos
--
-- COMO RODAR: no painel do Supabase, vá em SQL Editor → New query,
-- cole este arquivo inteiro e clique em Run. Só precisa rodar uma vez.
-- (O schema.sql original é o estado inicial do banco e não deve ser editado;
-- alterações posteriores entram como migrations numeradas aqui.)
--
-- Por quê: a aba "Produtos" agrupa os produtos por seção do mercado
-- (Padaria, Limpeza, Carnes, etc). Como o OCR da nota não tem como saber
-- a seção, a categoria é preenchida manualmente pelo usuário no app.

alter table produtos add column if not exists categoria text;

create index if not exists produtos_categoria_idx on produtos(categoria);
