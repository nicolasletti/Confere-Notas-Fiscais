import { useRef, useState, type DragEvent } from "react";
import { FileUp, FileText, RefreshCw, X, AlertCircle } from "lucide-react";
import { readNfeFile, type NfeInvoice } from "@/lib/nfe";

type State =
  | { kind: "empty" }
  | { kind: "loading"; fileName: string }
  | { kind: "error"; fileName: string; message: string }
  | { kind: "ready"; fileName: string; invoice: NfeInvoice };

function fmtDecimal(raw: string, minDecimals = 0): string {
  const s = (raw ?? "").trim();
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) return s || "—";
  const [, sign, int, dec = ""] = m;
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  let d = dec;
  if (minDecimals) {
    d = d.replace(/0+$/, "");
    if (d.length < minDecimals) d = d.padEnd(minDecimals, "0");
  }
  return sign + grouped + (d ? "," + d : "");
}
const fmtMoney = (raw: string, keepAll = false) => {
  const v = keepAll ? fmtDecimal(raw, 2) : fmtDecimal(raw);
  return v === "—" ? v : "R$ " + v;
};
function fmtDate(raw: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((raw ?? "").trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : raw || "—";
}

export default function Home() {
  const [state, setState] = useState<State>({ kind: "empty" });
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const reqId = useRef(0);

  const openPicker = () => inputRef.current?.click();
  const reset = () => { reqId.current++; setState({ kind: "empty" }); };

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const id = ++reqId.current;
    setState({ kind: "loading", fileName: file.name });
    try {
      const invoice = await readNfeFile(file);
      if (id === reqId.current) setState({ kind: "ready", fileName: file.name, invoice });
    } catch (e) {
      if (id === reqId.current)
        setState({ kind: "error", fileName: file.name, message: e instanceof Error ? e.message : "Não foi possível ler este arquivo." });
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const onDrop = (e: DragEvent) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]); };
  const dragProps = {
    onDragOver: (e: DragEvent) => { e.preventDefault(); setDragging(true); },
    onDragLeave: () => setDragging(false),
    onDrop,
  };

  return (
    <div className="min-h-[100dvh] bg-background" {...(state.kind !== "empty" ? dragProps : {})}>
      <input ref={inputRef} type="file" accept=".xml,text/xml,application/xml" className="sr-only" tabIndex={-1} aria-hidden="true"
        onChange={(e) => handleFile(e.target.files?.[0])} data-testid="input-file" />

      <main className="mx-auto max-w-5xl px-5 py-8 sm:py-12">
        {state.kind === "empty" && (
          <section className="rise">
            <h1 className="font-display font-bold text-3xl sm:text-5xl tracking-tight max-w-2xl leading-[1.05]">
              Confira a nota do fornecedor antes de guardar a mercadoria.
            </h1>
            <p className="mt-4 text-muted-foreground max-w-xl text-base sm:text-lg">
              Abra o XML da NF-e e veja emitente, número, data de emissão e todos os itens em uma tabela simples.
            </p>
            <button type="button" onClick={openPicker} {...dragProps} data-testid="button-dropzone"
              className={`mt-8 w-full rounded-2xl border-2 border-dashed px-6 py-14 sm:py-20 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${dragging ? "border-primary bg-accent" : "border-input bg-card hover:border-primary/60 hover:bg-accent/40"}`}>
              <FileUp className={`mx-auto h-10 w-10 text-primary transition-transform ${dragging ? "-translate-y-1" : ""}`} aria-hidden />
              <span className="mt-4 block font-display font-bold text-xl">{dragging ? "Pode soltar o arquivo" : "Arraste o XML da NF-e para cá"}</span>
              <span className="mt-1 block text-muted-foreground">ou <span className="text-primary font-medium underline underline-offset-4">clique para escolher o arquivo</span> (.xml)</span>
            </button>
            <ol className="mt-8 grid gap-4 sm:grid-cols-[1fr_1fr_1.3fr] text-sm">
              {[
                ["1", "Pegue o XML", "Ele chega por e-mail do fornecedor ou fica no portal da Sefaz."],
                ["2", "Abra aqui", "Nada é enviado: a leitura acontece no próprio computador."],
                ["3", "Confira", "Compare quantidades e preços com o que chegou na loja."],
              ].map(([n, t, d]) => (
                <li key={n} className="flex gap-3">
                  <span className="font-mono text-primary font-medium">{n}.</span>
                  <span><strong className="font-semibold">{t}</strong> <span className="text-muted-foreground">{d}</span></span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {state.kind !== "empty" && (
          <section aria-live="polite" className="rise">
            <div className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors ${dragging ? "border-primary bg-accent" : "bg-card"}`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate font-mono text-sm" data-testid="text-filename">{state.fileName}</span>
                {dragging && <span className="text-sm text-primary font-medium">Solte para substituir</span>}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={openPicker} disabled={state.kind === "loading"} data-testid="button-replace"
                  className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <RefreshCw className="h-4 w-4" aria-hidden /> Trocar arquivo
                </button>
                <button type="button" onClick={reset} data-testid="button-remove"
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <X className="h-4 w-4" aria-hidden /> Remover
                </button>
              </div>
            </div>

            {state.kind === "loading" && (
              <div aria-busy="true" className="space-y-4">
                <span className="sr-only">Lendo o arquivo…</span>
                <div className="skel h-10 w-2/3" /><div className="skel h-5 w-1/3" />
                <div className="skel h-64 w-full mt-6" />
              </div>
            )}

            {state.kind === "error" && (
              <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 sm:p-8" data-testid="status-error">
                <div className="flex gap-3">
                  <AlertCircle className="h-6 w-6 shrink-0 text-destructive" aria-hidden />
                  <div>
                    <h2 className="font-display font-bold text-xl">Não deu para ler esta nota</h2>
                    <p className="mt-1 text-foreground/80">{state.message}</p>
                    <p className="mt-3 text-sm text-muted-foreground">Confira se é o XML da NF-e (não o PDF da DANFE) e tente outro arquivo.</p>
                    <button type="button" onClick={openPicker} data-testid="button-retry"
                      className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                      <FileUp className="h-4 w-4" aria-hidden /> Escolher outro XML
                    </button>
                  </div>
                </div>
              </div>
            )}

            {state.kind === "ready" && <InvoiceView invoice={state.invoice} />}
          </section>
        )}
      </main>
    </div>
  );
}

function InvoiceView({ invoice }: { invoice: NfeInvoice }) {
  const n = invoice.items.length;
  return (
    <article>
      <div className="relative rounded-2xl border bg-card p-6 sm:p-8 overflow-hidden">
        <span aria-hidden className="stamp absolute right-5 top-5 hidden sm:block rounded-md border-2 border-primary/70 px-3 py-1 font-display font-bold uppercase tracking-widest text-primary/80 text-sm">Lida</span>
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground font-medium">Emitente</p>
        <h1 className="mt-1 font-display font-bold text-2xl sm:text-4xl tracking-tight pr-0 sm:pr-24 break-words" data-testid="text-issuer">{invoice.issuer || "—"}</h1>
        <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-4">
          <div><dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground font-medium">Número</dt>
            <dd className="mt-0.5 font-mono text-lg" data-testid="text-number">{invoice.number || "—"}</dd></div>
          <div><dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground font-medium">Emissão</dt>
            <dd className="mt-0.5 font-mono text-lg" data-testid="text-date">{fmtDate(invoice.issuedAt)}</dd></div>
          <div><dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground font-medium">Itens</dt>
            <dd className="mt-0.5 font-mono text-lg" data-testid="text-count">{n}</dd></div>
        </dl>
      </div>

      <div className="mt-6 rounded-2xl border bg-card">
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Itens da nota (role para os lados se necessário)">
          <table className="w-full min-w-[680px] text-sm">
            <caption className="text-left px-5 pt-5 pb-3 font-display font-bold text-lg">
              Itens da nota <span className="font-sans font-normal text-muted-foreground text-sm">({n} {n === 1 ? "item" : "itens"})</span>
            </caption>
            <thead>
              <tr className="border-y bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="text-left font-medium px-5 py-2.5">Descrição</th>
                <th scope="col" className="text-right font-medium px-4 py-2.5">Quantidade</th>
                <th scope="col" className="text-left font-medium px-4 py-2.5">Unidade</th>
                <th scope="col" className="text-right font-medium px-4 py-2.5">Preço unitário</th>
                <th scope="col" className="text-right font-medium px-5 py-2.5">Total</th>
              </tr>
            </thead>
            <tbody>
              {n === 0 && (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">Esta nota não traz itens.</td></tr>
              )}
              {invoice.items.map((it, i) => (
                <tr key={i} className="border-b last:border-b-0 hover:bg-accent/40 transition-colors" data-testid={`row-item-${i}`}>
                  <td className="px-5 py-3 font-medium">{it.description || "—"}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">{fmtDecimal(it.quantity)}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground uppercase">{it.unit || "—"}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">{fmtMoney(it.unitPrice, true)}</td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums whitespace-nowrap font-medium">{fmtMoney(it.total, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Quantidades e preços aparecem com todas as casas decimais do XML.</p>
    </article>
  );
}
