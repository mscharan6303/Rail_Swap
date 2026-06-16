import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet, createRootRouteWithContext, useRouter,
} from "@tanstack/react-router";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { I18nProvider } from "@/lib/i18n";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center animate-fade-in">
        <h1 className="text-7xl font-bold bg-gradient-hero bg-clip-text text-transparent">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Off the rails</h2>
        <p className="mt-2 text-sm text-muted-foreground">This page doesn't exist.</p>
        <a href="/" className="mt-6 inline-flex rounded-md bg-gradient-accent text-accent-foreground px-4 py-2 text-sm font-medium">Back home</a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button onClick={() => { router.invalidate(); reset(); }} className="mt-6 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm">Retry</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#1a2742" },
      { title: "RailSwap — Swap train seats safely" },
      { name: "description", content: "Find compatible passengers and swap your Indian train seat with confidence. Free, secure, mobile-first." },
      { property: "og:title", content: "RailSwap — Swap train seats safely" },
      { property: "og:description", content: "Find compatible passengers and swap your Indian train seat with confidence. Free, secure, mobile-first." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "RailSwap — Swap train seats safely" },
      { name: "twitter:description", content: "Find compatible passengers and swap your Indian train seat with confidence. Free, secure, mobile-first." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f61a42ef-7a3c-450c-bd2b-d0a0a752cb07/id-preview-98990d3c--0225709d-6fcd-4b06-b872-fadcb0b29787.lovable.app-1778645979091.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f61a42ef-7a3c-450c-bd2b-d0a0a752cb07/id-preview-98990d3c--0225709d-6fcd-4b06-b872-fadcb0b29787.lovable.app-1778645979091.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/icon.svg" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider>
            <Outlet />
            <Toaster position="top-center" richColors closeButton />
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
