import { useId, useState } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

const EXPLANATION =
  "A partir de 2027, notas sem esses campos podem trazer problemas de crédito de imposto para quem compra.";

export default function IbsCbsSeal({ ready }: { ready: boolean }) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const label = ready
    ? "Pronto para a reforma tributária"
    : "Atenção: nota sem os campos de IBS/CBS";

  return (
    <span
      className="relative inline-flex max-w-full"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setOpen(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setOpen(false);
      }}
    >
      <button
        type="button"
        aria-describedby={tooltipId}
        aria-expanded={open}
        aria-label={`${label}. Toque ou foque para ver uma explicação.`}
        data-testid="status-ibs-cbs"
        onClick={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
        className={`inline-flex min-h-9 max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-left text-xs font-semibold leading-snug transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:text-sm ${
          ready
            ? "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
            : "border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100"
        }`}
      >
        {ready ? (
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        ) : (
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        )}
        <span>{label}</span>
        <Info className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
      </button>
      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-2.5rem))] rounded-lg bg-foreground px-3 py-2.5 text-left text-xs font-normal leading-relaxed text-background shadow-lg"
          data-testid="text-ibs-cbs-explanation"
        >
          {EXPLANATION}
        </span>
      )}
    </span>
  );
}
