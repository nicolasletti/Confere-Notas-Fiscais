export function companyTaxRegimeGuidance(regime: string | null | undefined): string {
  if (regime === "lucro_presumido" || regime === "lucro_real") {
    return "Esse valor pode virar crédito de imposto. Confirme com seu contador.";
  }
  if (regime === "simples_nacional" || regime === "mei") {
    return "No Simples Nacional o aproveitamento de crédito é diferente. Fale com seu contador.";
  }
  return "Confirme com seu contador qual é o regime tributário da empresa antes de considerar possíveis créditos.";
}
