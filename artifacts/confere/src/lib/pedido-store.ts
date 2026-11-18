import { z } from "zod";

export const PEDIDO_STORAGE_KEY = "confere-pedido-v1";

export interface PedidoItem {
  id: string;
  descricao: string;
  quantidade: string;
  unidade: string;
  precoUnitario: string;
}

const savedItemSchema = z.object({
  id: z.string().min(1),
  descricao: z.string(),
  quantidade: z.string(),
  unidade: z.string(),
  precoUnitario: z.string(),
});

export function readPedido(): { items: PedidoItem[]; warning: string | null } {
  try {
    const stored = window.localStorage.getItem(PEDIDO_STORAGE_KEY);
    if (!stored) return { items: [], warning: null };
    const parsed: unknown = JSON.parse(stored);
    const result = z.array(savedItemSchema).safeParse(parsed);
    if (!result.success) {
      return {
        items: [],
        warning: "Os dados salvos não puderam ser reconhecidos. Você pode criar um novo pedido.",
      };
    }
    return { items: result.data, warning: null };
  } catch {
    return {
      items: [],
      warning: "Não foi possível acessar o armazenamento local neste navegador.",
    };
  }
}

export function savePedido(items: PedidoItem[]): boolean {
  try {
    window.localStorage.setItem(PEDIDO_STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}
