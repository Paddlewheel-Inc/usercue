import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@fontsource-variable/geist";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { Pwa } from "./components/Pwa";
import { ToastProvider } from "./components/ui";
import { applyTheme, getTheme } from "./lib/theme";
import "./styles.css";

applyTheme(getTheme());

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: false, refetchOnWindowFocus: false } },
});

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <App />
        <Pwa />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
