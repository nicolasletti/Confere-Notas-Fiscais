import { useEffect, useMemo, useState } from "react";
import {
  getGetAccountCompanyQueryKey,
  useGetAccountCompany,
  useRequestCompanyLogoUpload,
  useSaveAccountCompany,
} from "@workspace/api-client-react";
import type {
  CompanyLogoUploadInput,
  CompanyProfileInput,
} from "@workspace/api-client-react";
import { isValidCnpj, formatCnpj } from "@workspace/api-zod";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import type { FieldErrors, Resolver } from "react-hook-form";
import { useLocation } from "wouter";
import { z } from "zod";
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ImagePlus,
  LoaderCircle,
  MapPin,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const BUSINESS_TYPES = [
  { value: "mercado", label: "Mercado" },
  { value: "padaria", label: "Padaria" },
  { value: "restaurante", label: "Restaurante" },
  { value: "bar", label: "Bar" },
  { value: "outro", label: "Outro" },
] as const;

const TAX_REGIMES = [
  { value: "simples_nacional", label: "Simples Nacional" },
  { value: "lucro_presumido", label: "Lucro Presumido" },
  { value: "lucro_real", label: "Lucro Real" },
  { value: "mei", label: "MEI" },
  { value: "nao_sei", label: "Não sei" },
] as const;

const BRAZIL_UFS = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

const formSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do comércio.").max(500),
  cnpj: z
    .string()
    .trim()
    .min(1, "Informe o CNPJ.")
    .refine((value) => /^[A-Z0-9]{12}\d{2}$/.test(value), "Confira os 14 caracteres do CNPJ.")
    .refine((value) => isValidCnpj(value), "CNPJ inválido. Confira os caracteres e os dígitos verificadores."),
  businessType: z.enum(["mercado", "padaria", "restaurante", "bar", "outro"], {
    required_error: "Escolha o tipo de negócio.",
  }),
  city: z.string().trim().min(1, "Informe a cidade.").max(120),
  state: z.string().trim().length(2, "Informe a UF com duas letras.").regex(/^[A-Z]{2}$/, "Use a sigla da UF em maiúsculas.").refine((value) => BRAZIL_UFS.has(value), "Escolha uma UF brasileira válida."),
  whatsapp: z.string().trim().max(30).refine((value) => !value || (
    /^[+\d\s().-]+$/.test(value) &&
    value.replace(/\D/g, "").length >= 10 &&
    value.replace(/\D/g, "").length <= 13
  ), "Informe um WhatsApp com DDD válido."),
  taxRegime: z.enum(["simples_nacional", "lucro_presumido", "lucro_real", "mei", "nao_sei"], {
    required_error: "Escolha o regime tributário.",
  }),
  accountantEmail: z.string().trim().max(320).refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), "Informe um e-mail válido."),
});

type FormValues = z.infer<typeof formSchema>;

const emptyValues: FormValues = {
  name: "",
  cnpj: "",
  businessType: undefined as unknown as FormValues["businessType"],
  city: "",
  state: "",
  whatsapp: "",
  taxRegime: undefined as unknown as FormValues["taxRegime"],
  accountantEmail: "",
};

const contentTypes = ["image/png", "image/jpeg", "image/webp"] as const;
type LogoContentType = (typeof contentTypes)[number];
const maxLogoSize = 2 * 1024 * 1024;

function cleanCnpj(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 14);
}

function formatCompanyCnpj(value: string) {
  const cleaned = cleanCnpj(value);
  if (!/[A-Z]/.test(cleaned)) return formatCnpj(cleaned);
  return [...cleaned].map((char, index) => {
    const separator = index === 2 || index === 5 ? "." : index === 8 ? "/" : index === 12 ? "-" : "";
    return `${separator}${char}`;
  }).join("");
}

const companyResolver: Resolver<FormValues> = async (values) => {
  const result = formSchema.safeParse(values);
  if (result.success) return { values: result.data, errors: {} };
  const errors = result.error.issues.reduce((all, issue) => {
    const field = issue.path[0] as keyof FormValues | undefined;
    if (field && !all[field]) all[field] = { type: "validation", message: issue.message };
    return all;
  }, {} as FieldErrors<FormValues>);
  return { values: {}, errors };
};

function fieldClassName() {
  return "h-12 rounded-xl border-border/90 bg-background/75 px-3.5 shadow-none transition focus-visible:ring-2 focus-visible:ring-primary/20";
}

export default function MinhaEmpresa() {
  const companyQuery = useGetAccountCompany();
  const saveCompany = useSaveAccountCompany();
  const requestLogoUpload = useRequestCompanyLogoUpload();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [formError, setFormError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [logoError, setLogoError] = useState("");
  const profile = companyQuery.data?.profile ?? null;
  const isEditing = Boolean(profile);

  const persistedLogoSrc = useMemo(() => {
    if (!profile?.hasLogo || removeLogo || logoFile) return null;
    const base = import.meta.env.BASE_URL;
    return `${base}api/account/company/logo?updated=${encodeURIComponent(profile.updatedAt)}`;
  }, [logoFile, profile, removeLogo]);

  const form = useForm<FormValues>({
    resolver: companyResolver,
    defaultValues: emptyValues,
    mode: "onBlur",
  });

  useEffect(() => {
    if (profile && !form.formState.isDirty) {
      form.reset({
        name: profile.name,
        cnpj: profile.cnpj,
        businessType: profile.businessType,
        city: profile.city,
        state: profile.state,
        whatsapp: profile.whatsapp,
        taxRegime: profile.taxRegime,
        accountantEmail: profile.accountantEmail,
      });
    }
  }, [profile, form, form.formState.isDirty]);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(logoFile);
    setLogoPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [logoFile]);

  function chooseLogo(file?: File) {
    if (!file) return;
    setLogoError("");
    setSavedMessage("");
    if (!contentTypes.includes(file.type as LogoContentType)) {
      setLogoError("Use uma imagem PNG, JPG ou WebP.");
      return;
    }
    if (file.size > maxLogoSize) {
      setLogoError("A imagem deve ter no máximo 2 MB.");
      return;
    }
    if (file.size === 0) {
      setLogoError("Este arquivo está vazio. Escolha outra imagem.");
      return;
    }
    setLogoFile(file);
    setRemoveLogo(false);
  }

  function clearLogo() {
    setLogoFile(null);
    setLogoPreview(null);
    setLogoError("");
    if (profile?.hasLogo) setRemoveLogo(true);
  }

  async function onSubmit(values: FormValues) {
    setFormError("");
    setLogoError("");
    setSavedMessage("");
    let logoUploadId: string | undefined;

    if (logoFile) {
      try {
        const contentType = logoFile.type as LogoContentType;
        const uploadInput: CompanyLogoUploadInput = {
          name: logoFile.name,
          size: logoFile.size,
          contentType,
        };
        const { uploadId, uploadURL } = await requestLogoUpload.mutateAsync({ data: uploadInput });
        const uploadResponse = await fetch(uploadURL, {
          method: "PUT",
          headers: { "Content-Type": logoFile.type },
          body: logoFile,
        });
        if (!uploadResponse.ok) throw new Error("Não foi possível enviar a imagem.");
        logoUploadId = uploadId;
      } catch {
        setLogoError("Não foi possível enviar o logo. Seus outros dados continuam preenchidos; tente novamente.");
        return;
      }
    }

    const data: CompanyProfileInput = {
      name: values.name.trim(),
      cnpj: cleanCnpj(values.cnpj),
      businessType: values.businessType,
      city: values.city.trim(),
      state: values.state.trim().toUpperCase(),
      whatsapp: values.whatsapp.trim(),
      taxRegime: values.taxRegime,
      accountantEmail: values.accountantEmail.trim(),
      ...(logoUploadId ? { logoUploadId } : {}),
      ...(removeLogo && !logoUploadId ? { removeLogo: true } : {}),
    };

    try {
      const saved = await saveCompany.mutateAsync({ data });
      queryClient.setQueryData(getGetAccountCompanyQueryKey(), saved);
      await queryClient.invalidateQueries({ queryKey: getGetAccountCompanyQueryKey() });
      if (saved.profile) {
        form.reset({
          name: saved.profile.name,
          cnpj: saved.profile.cnpj,
          businessType: saved.profile.businessType,
          city: saved.profile.city,
          state: saved.profile.state,
          whatsapp: saved.profile.whatsapp,
          taxRegime: saved.profile.taxRegime,
          accountantEmail: saved.profile.accountantEmail,
        });
      }
      setLogoFile(null);
      setRemoveLogo(false);
      if (!isEditing) {
        setLocation("/painel");
        return;
      }
      setSavedMessage("Alterações salvas com segurança.");
    } catch {
      setFormError("Não foi possível salvar os dados agora. Confira sua conexão e tente novamente.");
    }
  }

  const isSaving = saveCompany.isPending || requestLogoUpload.isPending;

  if (companyQuery.isLoading) {
    return (
      <main className="mx-auto min-h-[70dvh] max-w-5xl px-4 py-8 sm:px-6 sm:py-12" aria-busy="true">
        <div className="mb-8 max-w-xl">
          <div className="skel h-3 w-28" />
          <div className="skel mt-4 h-10 w-72 max-w-full" />
          <div className="skel mt-3 h-4 w-full max-w-md" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="space-y-4 rounded-2xl border bg-card p-5 sm:p-8">
            <div className="skel h-5 w-40" />
            <div className="grid gap-5 sm:grid-cols-2">
              {Array.from({ length: 8 }).map((_, index) => <div key={index} className="skel h-12" />)}
            </div>
          </div>
          <div className="skel min-h-48 rounded-2xl" />
        </div>
        <span className="sr-only" data-testid="status-company-loading">Carregando os dados do comércio…</span>
      </main>
    );
  }

  if (companyQuery.isError) {
    return (
      <main className="mx-auto min-h-[70dvh] max-w-5xl px-4 py-10 sm:px-6">
        <section className="max-w-xl rounded-2xl border border-destructive/25 bg-destructive/[0.04] p-6 sm:p-8" role="alert">
          <h1 className="font-display text-2xl font-bold">Não foi possível abrir os dados da empresa</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Confira sua conexão e tente carregar novamente.</p>
          <Button className="mt-5" onClick={() => void companyQuery.refetch()} data-testid="button-retry-company">
            Tentar novamente
          </Button>
        </section>
      </main>
    );
  }

  const imageSrc = logoPreview ?? persistedLogoSrc;

  return (
    <main className="mx-auto min-h-[calc(100dvh-5rem)] max-w-5xl px-4 pb-12 pt-7 sm:px-6 sm:pb-16 sm:pt-11">
      <div className="rise">
        <div className="mb-7 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10"><Building2 className="h-4 w-4" aria-hidden="true" /></span>
          Perfil do comércio
        </div>

        <div className="mb-8 max-w-2xl">
          <h1 className="font-display text-3xl font-bold leading-[1.08] tracking-[-0.04em] sm:text-[2.7rem]" data-testid="text-company-title">
            {isEditing ? "Minha empresa" : "Vamos conhecer seu negócio"}
          </h1>
          <p className="mt-3 max-w-xl text-[0.98rem] leading-7 text-muted-foreground" data-testid="text-company-intro">
            {isEditing
              ? "Mantenha seus dados atualizados. Eles ajudam o coNFere a preparar os próximos passos para o seu comércio."
              : "Conte um pouco sobre o seu comércio. Usaremos essas informações para deixar os próximos fluxos do coNFere mais úteis para você."}
          </p>
        </div>

        {formError && (
          <p role="alert" className="mb-5 rounded-xl border border-destructive/25 bg-destructive/[0.05] px-4 py-3 text-sm text-destructive" data-testid="status-company-error">
            {formError}
          </p>
        )}
        {savedMessage && (
          <p role="status" className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-800/15 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900" data-testid="status-company-saved">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" /> {savedMessage}
          </p>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_18.5rem]">
              <section className="rounded-2xl border border-border/80 bg-card p-5 shadow-[0_12px_35px_-28px_hsl(var(--foreground)/.25)] sm:p-8" aria-labelledby="company-data-heading">
                <div className="mb-6 flex items-start justify-between gap-4 border-b border-border/70 pb-5">
                  <div>
                    <h2 id="company-data-heading" className="font-display text-xl font-bold tracking-tight">Dados do comércio</h2>
                    <p className="mt-1.5 text-sm text-muted-foreground">Preencha os campos para configurar sua conta.</p>
                  </div>
                  <span className="hidden rounded-full border border-primary/15 bg-primary/[0.06] px-3 py-1.5 text-xs font-semibold text-primary sm:inline-flex sm:items-center sm:gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Dados protegidos
                  </span>
                </div>

                <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Nome do comércio</FormLabel>
                        <FormControl><Input {...field} className={fieldClassName()} placeholder="Ex.: Mercearia da Praça" autoComplete="organization" data-testid="input-company-name" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cnpj"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CNPJ</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={formatCompanyCnpj(field.value || "")}
                            onChange={(event) => {
                              field.onChange(cleanCnpj(event.target.value));
                              setSavedMessage("");
                            }}
                            className={`${fieldClassName()} font-mono text-[0.92rem] tracking-wide`}
                            placeholder="00.000.000/0000-00"
                            inputMode="text"
                            autoComplete="off"
                            aria-describedby="cnpj-help"
                            data-testid="input-company-cnpj"
                          />
                        </FormControl>
                        <p id="cnpj-help" className="text-xs leading-5 text-muted-foreground">Aceita o formato numérico e o alfanumérico atual. Os dígitos verificadores são conferidos.</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="businessType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de negócio</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className={fieldClassName()} data-testid="select-business-type" aria-label="Tipo de negócio">
                              <SelectValue placeholder="Selecione uma opção" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {BUSINESS_TYPES.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cidade</FormLabel>
                        <FormControl><Input {...field} className={fieldClassName()} placeholder="Ex.: Campinas" autoComplete="address-level2" data-testid="input-company-city" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>UF</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value || ""}
                            onChange={(event) => field.onChange(event.target.value.replace(/[^a-z]/gi, "").toUpperCase().slice(0, 2))}
                            className={`${fieldClassName()} font-mono uppercase tracking-widest`}
                            placeholder="SP"
                            autoComplete="address-level1"
                            maxLength={2}
                            data-testid="input-company-state"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="whatsapp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>WhatsApp <span className="font-normal text-muted-foreground">(opcional)</span></FormLabel>
                        <FormControl><Input {...field} className={fieldClassName()} placeholder="(11) 99999-9999" inputMode="tel" autoComplete="tel" data-testid="input-company-whatsapp" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="taxRegime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Regime tributário</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className={fieldClassName()} data-testid="select-tax-regime" aria-label="Regime tributário">
                              <SelectValue placeholder="Selecione uma opção" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {TAX_REGIMES.map((regime) => <SelectItem key={regime.value} value={regime.value}>{regime.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="accountantEmail"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>E-mail do contador <span className="font-normal text-muted-foreground">(opcional)</span></FormLabel>
                        <FormControl><Input {...field} className={fieldClassName()} placeholder="contador@escritorio.com.br" type="email" autoComplete="email" data-testid="input-accountant-email" /></FormControl>
                        <p className="text-xs leading-5 text-muted-foreground">Usado para manter as informações fiscais alinhadas.</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </section>

              <aside className="space-y-4">
                <section className="rounded-2xl border border-border/80 bg-card p-5 shadow-[0_12px_35px_-28px_hsl(var(--foreground)/.25)] sm:p-6" aria-labelledby="logo-heading">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary"><ImagePlus className="h-5 w-5" aria-hidden="true" /></span>
                    <div>
                      <h2 id="logo-heading" className="font-display text-lg font-bold">Logo do comércio</h2>
                      <p className="text-xs text-muted-foreground">Opcional</p>
                    </div>
                  </div>

                  <div className="mt-5">
                    {imageSrc ? (
                      <div className="relative grid aspect-[1.55/1] place-items-center overflow-hidden rounded-xl border border-border/70 bg-muted/35 p-4">
                        <img src={imageSrc} alt="Prévia do logo do comércio" className="max-h-full max-w-full object-contain" data-testid="img-company-logo-preview" />
                        {logoPreview && <span className="absolute bottom-2 left-2 rounded-full bg-foreground/80 px-2.5 py-1 text-[0.65rem] font-semibold text-background">Prévia local</span>}
                      </div>
                    ) : (
                      <div className="grid aspect-[1.55/1] place-items-center rounded-xl border border-dashed border-border bg-muted/25 px-5 text-center">
                        <div>
                          <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-background text-muted-foreground shadow-sm"><ImagePlus className="h-5 w-5" aria-hidden="true" /></span>
                          <p className="mt-3 text-sm font-semibold">Sem logo por enquanto</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">Adicione uma imagem para identificar seu comércio.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <input
                    id="company-logo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(event) => {
                      chooseLogo(event.target.files?.[0]);
                      event.currentTarget.value = "";
                    }}
                    aria-label="Selecionar logo do comércio"
                    data-testid="input-company-logo"
                  />
                  <div className="mt-4 grid gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full rounded-xl"
                      onClick={() => document.getElementById("company-logo")?.click()}
                      disabled={isSaving}
                      data-testid="button-select-company-logo"
                    >
                      <Upload className="h-4 w-4" aria-hidden="true" />
                      {logoFile ? "Escolher outra imagem" : "Selecionar imagem"}
                    </Button>
                    {(logoFile || (profile?.hasLogo && !removeLogo)) && (
                      <Button type="button" variant="ghost" className="w-full rounded-xl text-muted-foreground hover:text-destructive" onClick={clearLogo} disabled={isSaving} data-testid="button-remove-company-logo">
                        <Trash2 className="h-4 w-4" aria-hidden="true" /> Remover logo
                      </Button>
                    )}
                  </div>
                  <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">PNG, JPG ou WebP, até 2 MB.</p>
                  {logoError && <p role="alert" className="mt-3 rounded-lg bg-destructive/[0.06] px-3 py-2 text-xs leading-5 text-destructive" data-testid="status-logo-error">{logoError}</p>}
                  {(requestLogoUpload.isPending || (logoFile && saveCompany.isPending)) && (
                    <p role="status" className="mt-3 flex items-center gap-2 text-xs font-medium text-primary" data-testid="status-logo-uploading">
                      <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> Enviando logo…
                    </p>
                  )}
                </section>

                <div className="rounded-2xl border border-primary/10 bg-primary/[0.045] p-5">
                  <div className="flex gap-3">
                    <span className="mt-0.5 text-primary"><MapPin className="h-4 w-4" aria-hidden="true" /></span>
                    <div>
                      <p className="text-sm font-semibold">Feito para o seu dia a dia</p>
                      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">Se não souber seu regime tributário, escolha “Não sei”. Você pode atualizar esses dados depois.</p>
                    </div>
                  </div>
                </div>
              </aside>
            </div>

            <div className="mt-6 flex flex-col-reverse items-stretch justify-between gap-4 border-t border-border/70 pt-5 sm:flex-row sm:items-center">
              <p className="flex items-center gap-2 text-xs leading-5 text-muted-foreground" data-testid="status-company-privacy">
                <ShieldCheck className="h-4 w-4 shrink-0 text-primary/80" aria-hidden="true" />
                Seus dados ficam protegidos e podem ser atualizados a qualquer momento.
              </p>
              <Button type="submit" size="lg" className="min-h-12 rounded-xl px-6 shadow-sm" disabled={isSaving} data-testid="button-save-company">
                {isSaving ? (
                  <><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> Salvando…</>
                ) : isEditing ? (
                  <><Check className="h-4 w-4" aria-hidden="true" /> Salvar alterações</>
                ) : (
                  <>Salvar e continuar <ArrowRight className="h-4 w-4" aria-hidden="true" /></>
                )}
              </Button>
            </div>
            {isSaving && <span className="sr-only" role="status" data-testid="status-company-saving">Salvando os dados do comércio…</span>}
          </form>
        </Form>
      </div>
    </main>
  );
}
