import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  FileText,
  Filter,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import "./resumo-ibs-cbs.css";

type TaxInvoice = {
  supplier: string;
  date: string;
  number: string;
  total: string;
  ibs: string;
  cbs: string;
  complete: boolean;
  initials: string;
  tint: string;
  detail: string;
};

const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const periods = [
  { month: 3, year: 2025, ibs: "R$ 284,73", cbs: "R$ 1.138,92", ready: 18, count: 23, invoices: "R$ 38.421,60" },
  { month: 4, year: 2025, ibs: "R$ 326,18", cbs: "R$ 1.304,71", ready: 21, count: 26, invoices: "R$ 42.186,30" },
  { month: 5, year: 2025, ibs: "R$ 291,42", cbs: "R$ 1.165,68", ready: 17, count: 22, invoices: "R$ 36.904,85" },
];

const invoices: TaxInvoice[] = [
  { supplier: "Distribuidora Horizonte", date: "28 mai", number: "NF-e 008.421", total: "R$ 8.246,90", ibs: "R$ 65,98", cbs: "R$ 263,90", complete: true, initials: "DH", tint: "blue", detail: "Campos de IBS e CBS identificados nos itens da nota. XML conferido em 28/05." },
  { supplier: "Alimentos Serra Alta", date: "26 mai", number: "NF-e 003.109", total: "R$ 6.718,40", ibs: "R$ 53,75", cbs: "R$ 214,99", complete: false, initials: "SA", tint: "gold", detail: "O XML não informou os campos de IBS/CBS. Peça uma versão atualizada ao fornecedor." },
  { supplier: "Atacado Bom Vizinho", date: "23 mai", number: "NF-e 021.882", total: "R$ 5.306,15", ibs: "R$ 42,45", cbs: "R$ 169,80", complete: true, initials: "BV", tint: "green", detail: "Campos de IBS e CBS identificados nos itens da nota. XML conferido em 23/05." },
  { supplier: "Laticínios Campo Novo", date: "20 mai", number: "NF-e 000.764", total: "R$ 4.982,00", ibs: "R$ 39,86", cbs: "R$ 159,42", complete: false, initials: "CN", tint: "rose", detail: "Nota sem detalhamento de IBS/CBS. O documento permanece na soma de compras." },
  { supplier: "Comercial Santa Luzia", date: "17 mai", number: "NF-e 014.057", total: "R$ 3.601,80", ibs: "R$ 28,81", cbs: "R$ 115,26", complete: true, initials: "SL", tint: "violet", detail: "Campos de IBS e CBS identificados nos itens da nota. XML conferido em 17/05." },
];

type ViewFilter = "all" | "pending" | "ready";

export default function ResumoIBSCBS() {
  const [periodIndex, setPeriodIndex] = useState(2);
  const [filter, setFilter] = useState<ViewFilter>("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [exported, setExported] = useState(false);
  const period = periods[periodIndex];
  const visibleInvoices = useMemo(() => invoices.filter((invoice) => {
    const matchesFilter = filter === "all" || (filter === "ready" ? invoice.complete : !invoice.complete);
    return matchesFilter && invoice.supplier.toLowerCase().includes(search.toLowerCase());
  }), [filter, search]);

  const changePeriod = (direction: number) => {
    setPeriodIndex((index) => Math.max(0, Math.min(periods.length - 1, index + direction)));
    setExpanded(null);
    setExported(false);
  };

  const exportSummary = () => {
    const rows = [
      ["Competência", "Total de compras", "IBS informado", "CBS informado", "Notas prontas", "Notas no mês"],
      [`${months[period.month - 1]} ${period.year}`, period.invoices, period.ibs, period.cbs, String(period.ready), String(period.count)],
    ].map((row) => row.join(";")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\uFEFF" + rows], { type: "text/csv;charset=utf-8" }));
    link.download = `resumo-ibs-cbs-${period.year}-${String(period.month).padStart(2, "0")}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    setExported(true);
  };

  return (
    <main className="tax-page">
      <div className="tax-topline">
        <div className="tax-brand"><span className="tax-brand-mark">c</span><span>coNFere</span><i /> <span className="tax-brand-section">painel mensal</span></div>
        <div className="tax-top-note"><span className="tax-live-dot" /> Visão fiscal da sua empresa</div>
      </div>

      <header className="tax-heading">
        <div>
          <div className="tax-eyebrow"><span>REFORMA TRIBUTÁRIA</span><span className="tax-eyebrow-line" /></div>
          <h1>IBS e CBS <span>em foco.</span></h1>
          <p>Veja o que veio informado nas notas de compra — e o que ainda precisa de atenção.</p>
        </div>
        <div className="tax-period">
          <span className="tax-period-caption">COMPETÊNCIA</span>
          <div className="tax-period-picker">
            <button aria-label="Mês anterior" disabled={periodIndex === 0} onClick={() => changePeriod(-1)}><ArrowLeft size={16} /></button>
            <span>{months[period.month - 1]} <b>{period.year}</b></span>
            <button aria-label="Próximo mês" disabled={periodIndex === periods.length - 1} onClick={() => changePeriod(1)}><ArrowRight size={16} /></button>
          </div>
        </div>
      </header>

      <section className="tax-summary" aria-label="Resumo de IBS e CBS">
        <div className="tax-summary-main">
          <div className="tax-summary-label"><span className="tax-summary-icon"><FileText size={16} /></span> VALORES INFORMADOS NAS NOTAS</div>
          <div className="tax-combined">{period.ibs.replace("R$ ", "")}<span> + </span>{period.cbs.replace("R$ ", "")}</div>
          <div className="tax-combined-caption">IBS estimado <b>{period.ibs}</b><span className="tax-caption-divider">/</span> CBS estimada <b>{period.cbs}</b></div>
          <p className="tax-footnote">Soma dos campos encontrados nos XMLs. Não é uma guia de imposto a pagar.</p>
        </div>
        <div className="tax-summary-progress">
          <div className="tax-progress-head">
            <div><span className="tax-small-label">NOTAS COM IBS/CBS</span><div className="tax-progress-count"><strong>{period.ready}</strong><span>de {period.count} notas</span></div></div>
            <div className="tax-progress-ring" style={{ "--progress": `${Math.round(period.ready / period.count * 100)}%` } as CSSProperties}>
              <span>{Math.round(period.ready / period.count * 100)}<small>%</small></span>
            </div>
          </div>
          <div className="tax-progress-track"><span style={{ width: `${period.ready / period.count * 100}%` }} /></div>
          <button className="tax-review-link" onClick={() => setFilter(filter === "pending" ? "all" : "pending")}>
            <AlertCircle size={15} /> {period.count - period.ready} notas precisam de atenção <ArrowRight size={14} />
          </button>
        </div>
        <div className="tax-summary-total">
          <span className="tax-small-label">COMPRAS NO PERÍODO</span>
          <strong>{period.invoices}</strong>
          <span className="tax-total-note">em {period.count} notas fiscais</span>
          <button className="tax-help" onClick={() => setShowHelp(!showHelp)} aria-expanded={showHelp}><CircleHelp size={15} /> Como ler este resumo</button>
          {showHelp && <div className="tax-help-popover">Os valores refletem os campos que constam nos XMLs recebidos. A presença dos campos não representa validação de cálculo ou crédito tributário.</div>}
        </div>
      </section>

      <section className="tax-ledger">
        <div className="tax-ledger-head">
          <div>
            <span className="tax-ledger-kicker">RASTREIO POR DOCUMENTO</span>
            <h2>Notas do mês <span>{period.count}</span></h2>
            <p>Confira a origem de cada valor e encontre notas sem os novos campos.</p>
          </div>
          <button className="tax-export" onClick={exportSummary}><ArrowDownToLine size={16} /> {exported ? "Resumo exportado" : "Exportar resumo"}</button>
        </div>
        <div className="tax-ledger-tools">
          <div className="tax-filter-tabs" aria-label="Filtrar notas">
            <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Todas <span>{period.count}</span></button>
            <button className={filter === "pending" ? "active" : ""} onClick={() => setFilter("pending")}><AlertCircle size={14} /> Atenção <span>{period.count - period.ready}</span></button>
            <button className={filter === "ready" ? "active" : ""} onClick={() => setFilter("ready")}><ShieldCheck size={14} /> Com campos <span>{period.ready}</span></button>
          </div>
          <label className="tax-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar fornecedor" aria-label="Buscar fornecedor" />{search && <button onClick={() => setSearch("")} aria-label="Limpar busca">×</button>}</label>
        </div>
        <div className="tax-table-wrap">
          <div className="tax-table tax-table-labels"><span>FORNECEDOR / NOTA</span><span>VALOR DA NOTA</span><span>IBS</span><span>CBS</span><span>SITUAÇÃO</span><span /></div>
          {visibleInvoices.length ? visibleInvoices.map((invoice) => (
            <div key={invoice.number} className={`tax-invoice ${expanded === invoice.number ? "expanded" : ""}`}>
              <button className="tax-table tax-invoice-row" onClick={() => setExpanded(expanded === invoice.number ? null : invoice.number)} aria-expanded={expanded === invoice.number}>
                <span className="tax-supplier-cell"><span className={`tax-avatar ${invoice.tint}`}>{invoice.initials}</span><span><b>{invoice.supplier}</b><small>{invoice.number} <i>·</i> {invoice.date}</small></span></span>
                <span className="tax-money">{invoice.total}</span><span className="tax-money">{invoice.ibs}</span><span className="tax-money">{invoice.cbs}</span>
                <span className={`tax-status ${invoice.complete ? "ok" : "missing"}`}>{invoice.complete ? <><Check size={13} /> Campos encontrados</> : <><AlertCircle size={13} /> Sem campos</>}</span>
                <ChevronDown className="tax-chevron" size={16} />
              </button>
              {expanded === invoice.number && <div className="tax-invoice-detail"><span className={invoice.complete ? "detail-check" : "detail-alert"}>{invoice.complete ? <ShieldCheck size={16} /> : <AlertCircle size={16} />}</span><p>{invoice.detail}</p><span className="tax-detail-source">XML da nota fiscal</span></div>}
            </div>
          )) : <div className="tax-empty"><Filter size={20} /><strong>Nenhuma nota encontrada</strong><span>Ajuste a busca ou escolha outro filtro.</span><button onClick={() => { setSearch(""); setFilter("all"); }}>Limpar filtros</button></div>}
        </div>
        <div className="tax-ledger-foot"><span>Exibindo {visibleInvoices.length} de {period.count} notas</span><span><SlidersHorizontal size={14} /> Atualizado com os XMLs conferidos</span></div>
      </section>
      <footer className="tax-footer"><span>coNFere <i>·</i> Organização fiscal, nota por nota.</span><span>Os dados exibidos dependem das informações presentes no XML do fornecedor.</span></footer>
    </main>
  );
}
