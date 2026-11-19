import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import AppHeader from '@/components/app-header';
import NotFound from '@/pages/not-found';
import Home from '@/pages/home';
import Landing from '@/pages/landing';
import Entrar from '@/pages/entrar';
import Cadastro from '@/pages/cadastro';
import Pedido from '@/pages/pedido';
import Conferencia from '@/pages/conferencia';
import Fornecedores from '@/pages/fornecedores';
import Painel from '@/pages/painel';
import Reposicao from '@/pages/reposicao';
import MinhaEmpresa from '@/pages/minha-empresa';
import { NfeProvider } from '@/lib/nfe-context';
import { AuthProvider, useAppAuth } from '@/lib/auth-context';
import { getGetAccountCompanyQueryKey, useGetAccountCompany } from '@workspace/api-client-react';
import LegacyDataImport, { UnsavedInvoiceNotice } from '@/components/legacy-data-import';
import {
  Redirect,
  Route,
  Switch,
  Router as WouterRouter,
  useLocation,
} from 'wouter';

const queryClient = new QueryClient();

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/entrar" component={Entrar} />
        <Route path="/cadastro" component={Cadastro} />
        <Route component={AuthenticatedRoutes} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

function AuthenticatedRoutes() {
  const { isLoading, isAuthenticated } = useAppAuth();
  const [location] = useLocation();
  const companyQuery = useGetAccountCompany({
    query: { enabled: isAuthenticated, queryKey: getGetAccountCompanyQueryKey() },
  });

  if (isLoading) {
    return (
      <main className="grid min-h-[60vh] place-items-center px-5" aria-busy="true">
        <p className="text-sm font-medium text-muted-foreground">Verificando seu acesso...</p>
      </main>
    );
  }

  if (!isAuthenticated) return <Redirect to="/entrar" />;
  if (companyQuery.isLoading && location !== "/minha-empresa") {
    return (
      <main className="grid min-h-[60vh] place-items-center px-5" aria-busy="true">
        <p className="text-sm font-medium text-muted-foreground">Carregando seu perfil de empresa...</p>
      </main>
    );
  }
  if (!companyQuery.data?.profile && location !== "/minha-empresa") {
    return <Redirect to="/minha-empresa" />;
  }

  return (
    <>
      <AppHeader />
      <LegacyDataImport />
      <UnsavedInvoiceNotice />
      <Switch>
        <Route path="/minha-empresa" component={MinhaEmpresa} />
        <Route path="/painel" component={Painel} />
        <Route path="/reposicao" component={Reposicao} />
        <Route path="/nota-fiscal" component={Home} />
        <Route path="/pedido" component={Pedido} />
        <Route path="/conferencia" component={Conferencia} />
        <Route path="/fornecedores" component={Fornecedores} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <AuthProvider>
              <NfeProvider>
                <Router />
              </NfeProvider>
            </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
