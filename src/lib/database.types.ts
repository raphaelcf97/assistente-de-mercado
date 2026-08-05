export type Database = {
  public: {
    Tables: {
      mercados: {
        Row: { id: string; nome: string; apelido: string | null; created_at: string };
        Insert: { id?: string; nome: string; apelido?: string | null; created_at?: string };
        Update: { id?: string; nome?: string; apelido?: string | null; created_at?: string };
        Relationships: [];
      };
      produtos: {
        Row: { id: string; nome_canonico: string; unidade_padrao: string | null; created_at: string };
        Insert: { id?: string; nome_canonico: string; unidade_padrao?: string | null; created_at?: string };
        Update: { id?: string; nome_canonico?: string; unidade_padrao?: string | null; created_at?: string };
        Relationships: [];
      };
      produto_aliases: {
        Row: { id: string; produto_id: string; nome_alias: string; created_at: string };
        Insert: { id?: string; produto_id: string; nome_alias: string; created_at?: string };
        Update: { id?: string; produto_id?: string; nome_alias?: string; created_at?: string };
        Relationships: [
          {
            foreignKeyName: "produto_aliases_produto_id_fkey";
            columns: ["produto_id"];
            referencedRelation: "produtos";
            referencedColumns: ["id"];
          },
        ];
      };
      compras: {
        Row: {
          id: string;
          mercado_id: string;
          data_compra: string;
          valor_total: number;
          forma_pagamento_detectada: string | null;
          pago_vale_alimentacao: boolean;
          foto_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          mercado_id: string;
          data_compra: string;
          valor_total: number;
          forma_pagamento_detectada?: string | null;
          pago_vale_alimentacao?: boolean;
          foto_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          mercado_id?: string;
          data_compra?: string;
          valor_total?: number;
          forma_pagamento_detectada?: string | null;
          pago_vale_alimentacao?: boolean;
          foto_url?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "compras_mercado_id_fkey";
            columns: ["mercado_id"];
            referencedRelation: "mercados";
            referencedColumns: ["id"];
          },
        ];
      };
      itens_compra: {
        Row: {
          id: string;
          compra_id: string;
          produto_id: string;
          nome_lido_na_nota: string;
          quantidade: number;
          unidade: string | null;
          preco_unitario: number | null;
          preco_total: number;
        };
        Insert: {
          id?: string;
          compra_id: string;
          produto_id: string;
          nome_lido_na_nota: string;
          quantidade?: number;
          unidade?: string | null;
          preco_unitario?: number | null;
          preco_total: number;
        };
        Update: {
          id?: string;
          compra_id?: string;
          produto_id?: string;
          nome_lido_na_nota?: string;
          quantidade?: number;
          unidade?: string | null;
          preco_unitario?: number | null;
          preco_total?: number;
        };
        Relationships: [
          {
            foreignKeyName: "itens_compra_compra_id_fkey";
            columns: ["compra_id"];
            referencedRelation: "compras";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "itens_compra_produto_id_fkey";
            columns: ["produto_id"];
            referencedRelation: "produtos";
            referencedColumns: ["id"];
          },
        ];
      };
      vale_config: {
        Row: { id: 1; valor_recarga: number; dia_do_mes: number; ativo: boolean };
        Insert: { id?: 1; valor_recarga?: number; dia_do_mes?: number; ativo?: boolean };
        Update: { id?: 1; valor_recarga?: number; dia_do_mes?: number; ativo?: boolean };
        Relationships: [];
      };
      vale_transacoes: {
        Row: {
          id: string;
          tipo: "recarga" | "compra" | "ajuste";
          valor: number;
          data: string;
          compra_id: string | null;
          descricao: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tipo: "recarga" | "compra" | "ajuste";
          valor: number;
          data?: string;
          compra_id?: string | null;
          descricao?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tipo?: "recarga" | "compra" | "ajuste";
          valor?: number;
          data?: string;
          compra_id?: string | null;
          descricao?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vale_transacoes_compra_id_fkey";
            columns: ["compra_id"];
            referencedRelation: "compras";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      vale_saldo: {
        Row: { saldo: number };
        Relationships: [];
      };
      historico_precos: {
        Row: {
          produto_id: string;
          mercado_id: string;
          mercado_nome: string;
          preco_medio: number;
          quantidade_compras: number;
          ultima_compra: string;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: {
      vale_transacao_tipo: "recarga" | "compra" | "ajuste";
    };
    CompositeTypes: Record<string, never>;
  };
};
