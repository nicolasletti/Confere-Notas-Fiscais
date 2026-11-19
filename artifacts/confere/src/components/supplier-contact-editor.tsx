import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListGeneratedOrdersQueryKey,
  getListSupplierContactsQueryKey,
  useSaveSupplierContact,
} from "@workspace/api-client-react";
import { ExternalLink, Phone, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function whatsappUrl(phone: string, message: string): string {
  return `https://wa.me/${digitsOnly(phone)}?text=${encodeURIComponent(message)}`;
}

interface Props {
  supplierKey: string;
  supplierName: string;
  savedWhatsapp: string;
  message?: string;
  testIdSuffix: string;
}

export default function SupplierContactEditor({ supplierKey, supplierName, savedWhatsapp, message, testIdSuffix }: Props) {
  const queryClient = useQueryClient();
  const save = useSaveSupplierContact();
  const [value, setValue] = useState(savedWhatsapp);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => { setValue(savedWhatsapp); }, [savedWhatsapp]);

  const dirty = digitsOnly(value) !== savedWhatsapp;
  const canSend = !!savedWhatsapp && !dirty && message !== undefined;
  const inputId = `whatsapp-${testIdSuffix}`;

  async function onSave() {
    setError("");
    setNotice("");
    try {
      const saved = await save.mutateAsync({ data: { key: supplierKey, whatsapp: value.trim() } });
      setValue(saved.whatsapp);
      setNotice(saved.whatsapp ? "Telefone salvo." : "Contato removido.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListSupplierContactsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getListGeneratedOrdersQueryKey() }),
      ]);
    } catch {
      setError("Não foi possível salvar o telefone. Confira o número e tente de novo.");
    }
  }

  return (
    <div className="rounded-xl border border-dashed bg-background/60 p-3" data-testid={`contact-editor-${testIdSuffix}`}>
      <label htmlFor={inputId} className="flex items-center gap-1.5 text-sm font-semibold">
        <Phone className="h-3.5 w-3.5 text-primary" aria-hidden /> WhatsApp de {supplierName}
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <Input
          id={inputId}
          value={value}
          onChange={(e) => { setValue(e.target.value); setNotice(""); setError(""); }}
          inputMode="tel"
          placeholder="Ex.: 11 98765-4321"
          maxLength={40}
          disabled={save.isPending}
          className="font-mono"
          data-testid={`input-whatsapp-${testIdSuffix}`}
        />
        <Button
          type="button"
          variant="outline"
          onClick={onSave}
          disabled={save.isPending || !dirty}
          aria-label={`Salvar WhatsApp de ${supplierName}`}
          data-testid={`button-save-whatsapp-${testIdSuffix}`}
        >
          <Save aria-hidden /> {save.isPending ? "Salvando..." : "Salvar"}
        </Button>
        {message !== undefined && (
          canSend ? (
            <Button asChild className="bg-emerald-700 text-white hover:bg-emerald-800">
              <a
                href={whatsappUrl(savedWhatsapp, message)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Enviar pelo WhatsApp para ${supplierName}`}
                data-testid={`link-whatsapp-${testIdSuffix}`}
              >
                <ExternalLink aria-hidden /> Enviar pelo WhatsApp
              </a>
            </Button>
          ) : (
            <Button type="button" disabled aria-label="WhatsApp indisponível: salve um telefone primeiro" data-testid={`link-whatsapp-${testIdSuffix}`}>
              <ExternalLink aria-hidden /> Enviar pelo WhatsApp
            </Button>
          )
        )}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        DDD + número (o 55 do Brasil é adicionado) ou +DDI internacional. Deixe em branco e salve para remover.
        {message !== undefined && " O WhatsApp só abre a conversa com o texto; você confere e envia."}
      </p>
      {dirty && savedWhatsapp && <p className="mt-1 text-xs text-amber-800">Salve o novo número para usar o WhatsApp.</p>}
      {notice && <p role="status" className="mt-1 text-xs text-emerald-800" data-testid={`status-whatsapp-${testIdSuffix}`}>{notice}</p>}
      {error && <p role="alert" className="mt-1 text-xs text-destructive" data-testid={`error-whatsapp-${testIdSuffix}`}>{error}</p>}
    </div>
  );
}
