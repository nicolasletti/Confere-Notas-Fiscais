import { useState } from "react";
import {
  getGetAccountOrderQueryKey,
  getGetMonthlyDashboardQueryKey,
  getListAccountConferencesQueryKey,
  useImportLegacyAccountData,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  CONFERENCE_HISTORY_STORAGE_KEY,
  readConferenceHistory,
} from "@/lib/conference-history";
import { useNfe } from "@/lib/nfe-context";
import { PEDIDO_STORAGE_KEY, readPedido } from "@/lib/pedido-store";

function readLegacyData() {
  const order = readPedido();
  const history = readConferenceHistory();
  return {
    orderItems: order.items,
    conferences: history.records.map((record) => ({
      supplierName: record.supplierName,
      invoiceNumber: record.invoiceNumber,
      issuedAt: record.issuedAt,
      totalExtraChargeCents: record.totalExtraChargeCents,
      hasCompleteIbsCbs: record.hasCompleteIbsCbs,
      savedAt: record.savedAt,
    })),
    warnings: [order.warning, history.warning].filter(
      (warning): warning is string => Boolean(warning),
    ),
  };
}

export default function LegacyDataImport() {
  const [legacy, setLegacy] = useState(readLegacyData);
  const [expanded, setExpanded] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const importMutation = useImportLegacyAccountData();
  const queryClient = useQueryClient();

  const hasLegacyData = legacy.orderItems.length > 0 || legacy.conferences.length > 0;
  if (!hasLegacyData && legacy.warnings.length === 0) {
    return message ? (
      <p
        className="mx-auto mt-3 max-w-5xl rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        role="status"
        data-testid="status-legacy-import"
      >
        {message}
      </p>
    ) : null;
  }

  async function importData() {
    setError("");
    setMessage("");
    try {
      const result = await importMutation.mutateAsync({
        data: {
          orderItems: legacy.orderItems,
          conferences: legacy.conferences,
        },
      });
      window.localStorage.removeItem(PEDIDO_STORAGE_KEY);
      window.localStorage.removeItem(CONFERENCE_HISTORY_STORAGE_KEY);
      setLegacy({ orderItems: [], conferences: [], warnings: [] });
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetAccountOrderQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getListAccountConferencesQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetMonthlyDashboardQueryKey() }),
      ]).catch(() => undefined);
      setMessage(
        `Importação concluída: ${result.importedOrderItems} itens de pedido e ${result.importedConferences} conferências adicionados.`,
      );
    } catch {
      setError("Não foi possível importar agora. Os dados antigos continuam salvos neste navegador.");
    }
  }

  if (legacy.warnings.length > 0) {
    return (
      <div className="mx-auto mt-3 max-w-5xl rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <p className="font-semibold">Não foi possível ler todos os dados locais.</p>
        <p className="mt-1">{legacy.warnings.join(" ")}</p>
        <p className="mt-1">Eles continuam no navegador e não foram apagados.</p>
      </div>
    );
  }

  if (!expanded) {
    return (
      <div className="mx-auto mt-3 max-w-5xl">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setExpanded(true)}
          data-testid="button-reopen-legacy-import"
        >
          Importar dados antigos deste navegador
        </Button>
      </div>
    );
  }

  return (
    <aside
      className="mx-auto mt-3 max-w-5xl rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-4 text-sm text-amber-950 sm:px-5"
      aria-labelledby="legacy-import-title"
      data-testid="panel-legacy-import"
    >
      <h2 id="legacy-import-title" className="font-semibold">
        Há dados antigos neste navegador
      </h2>
      <p className="mt-1 leading-relaxed">
        Encontramos {legacy.orderItems.length} itens de pedido e {legacy.conferences.length} conferências.
        Eles ainda não estão associados a uma conta. Importe somente se esses dados forem seus.
      </p>
      {error && <p className="mt-2 text-sm font-medium text-red-800" role="alert">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={importData}
          disabled={importMutation.isPending}
          data-testid="button-import-legacy-data"
        >
          {importMutation.isPending ? "Importando..." : "Importar para minha conta"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setExpanded(false)}
          data-testid="button-skip-legacy-import"
        >
          Agora não
        </Button>
      </div>
      {message && <p className="mt-2 text-sm font-medium text-emerald-900" role="status">{message}</p>}
    </aside>
  );
}

export function UnsavedInvoiceNotice() {
  const { invoice } = useNfe();
  if (!invoice || invoice.id !== undefined) return null;

  return (
    <p
      className="mx-auto mt-3 max-w-5xl rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950"
      role="status"
      data-testid="notice-unsaved-invoice"
    >
      A nota que estava aberta antes desta atualização ainda não foi salva na sua conta. Como a versão anterior não guardava o XML original, volte à tela Nota fiscal e envie esse arquivo novamente para salvar a nota completa.
    </p>
  );
}
