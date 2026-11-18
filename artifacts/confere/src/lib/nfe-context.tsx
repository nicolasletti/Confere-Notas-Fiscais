import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { NfeInvoice } from "@/lib/nfe";

interface LoadedInvoiceState {
  invoice: NfeInvoice | null;
  version: number;
}

interface NfeContextValue extends LoadedInvoiceState {
  setInvoice: (invoice: NfeInvoice | null) => void;
}

const NfeContext = createContext<NfeContextValue | null>(null);

export function NfeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LoadedInvoiceState>({
    invoice: null,
    version: 0,
  });

  const setInvoice = useCallback((invoice: NfeInvoice | null) => {
    setState((current) => ({ invoice, version: current.version + 1 }));
  }, []);

  return (
    <NfeContext.Provider value={{ ...state, setInvoice }}>
      {children}
    </NfeContext.Provider>
  );
}

export function useNfe() {
  const context = useContext(NfeContext);
  if (!context) {
    throw new Error("useNfe precisa ser usado dentro de NfeProvider.");
  }
  return context;
}
