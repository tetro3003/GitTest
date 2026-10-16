"use client";

import { useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { useDemo } from "@/lib/store";
import { API_MODE } from "@/lib/config";
import { setMockFailRate } from "@/lib/api/mock-adapter";

function DemoSync() {
  const simulateErrors = useDemo((s) => s.simulateErrors);
  useEffect(() => {
    void useDemo.persist.rehydrate();
  }, []);
  useEffect(() => {
    if (API_MODE === "mock") setMockFailRate(simulateErrors ? 0.35 : 0);
  }, [simulateErrors]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <DemoSync />
      {children}
    </ThemeProvider>
  );
}
