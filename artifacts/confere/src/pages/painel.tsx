import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PainelMensal from "@/components/painel-mensal";
import PainelSemanal from "@/components/painel-semanal";

export default function Painel() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-5 sm:py-10">
      <Tabs defaultValue="mensal">
        <TabsList aria-label="Período do painel" className="mb-5 h-10 rounded-lg border bg-card p-1">
          <TabsTrigger value="mensal" data-testid="tab-mensal" className="px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Mensal</TabsTrigger>
          <TabsTrigger value="semanal" data-testid="tab-semanal" className="px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Semanal</TabsTrigger>
        </TabsList>
        <TabsContent value="mensal" className="mt-0"><PainelMensal /></TabsContent>
        <TabsContent value="semanal" className="mt-0"><PainelSemanal /></TabsContent>
      </Tabs>
    </main>
  );
}
