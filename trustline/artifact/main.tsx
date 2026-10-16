"use client";

import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import { RouterProvider } from "./router";
import { DemoPanel } from "@/components/demo-panel";
import { useDemo } from "@/lib/store";
import { setMockFailRate } from "@/lib/api/mock-adapter";
import { useEffect } from "react";

import Landing from "@/app/page";
import DemoOverview from "@/app/demo/page";
import BorrowerLayout from "@/app/borrower/layout";
import Onboarding from "@/app/borrower/onboarding/page";
import ConnectSources from "@/app/borrower/connect/page";
import Analyzing from "@/app/borrower/analyzing/page";
import WorkChecker from "@/app/borrower/work/page";
import Profile from "@/app/borrower/profile/page";
import ShareWithLender from "@/app/borrower/share/page";
import Consents from "@/app/borrower/consents/page";
import LenderLayout from "@/app/lender/layout";
import Applicants from "@/app/lender/page";
import ApplicantDetail from "@/app/lender/applicants/[id]/page";
import PrintableReport from "@/app/lender/applicants/[id]/report/page";
import Monitoring from "@/app/lender/monitoring/page";
import ApiDocs from "@/app/lender/api/page";

type Route = { pattern: string; page: () => React.ReactNode; layout?: "borrower" | "lender" };

const ROUTES: Route[] = [
  { pattern: "/", page: () => <Landing /> },
  { pattern: "/demo", page: () => <DemoOverview /> },
  { pattern: "/borrower", page: () => <Profile />, layout: "borrower" },
  { pattern: "/borrower/onboarding", page: () => <Onboarding />, layout: "borrower" },
  { pattern: "/borrower/connect", page: () => <ConnectSources />, layout: "borrower" },
  { pattern: "/borrower/analyzing", page: () => <Analyzing />, layout: "borrower" },
  { pattern: "/borrower/work", page: () => <WorkChecker />, layout: "borrower" },
  { pattern: "/borrower/profile", page: () => <Profile />, layout: "borrower" },
  { pattern: "/borrower/share", page: () => <ShareWithLender />, layout: "borrower" },
  { pattern: "/borrower/consents", page: () => <Consents />, layout: "borrower" },
  { pattern: "/lender", page: () => <Applicants />, layout: "lender" },
  { pattern: "/lender/applicants/:id", page: () => <ApplicantDetail />, layout: "lender" },
  { pattern: "/lender/applicants/:id/report", page: () => <PrintableReport />, layout: "lender" },
  { pattern: "/lender/monitoring", page: () => <Monitoring />, layout: "lender" },
  { pattern: "/lender/api", page: () => <ApiDocs />, layout: "lender" },
];

function Sync() {
  const simulateErrors = useDemo((s) => s.simulateErrors);
  useEffect(() => {
    void useDemo.persist.rehydrate();
  }, []);
  useEffect(() => setMockFailRate(simulateErrors ? 0.35 : 0), [simulateErrors]);
  return null;
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <Sync />
      <RouterProvider patterns={ROUTES.map((r) => r.pattern)}>
        {(path) => {
          const route = ROUTES.find((r) => matchesPath(r.pattern, path)) ?? ROUTES[0];
          const page = route.page();
          const content = route.layout === "borrower" ? <BorrowerLayout>{page}</BorrowerLayout> : route.layout === "lender" ? <LenderLayout>{page}</LenderLayout> : page;
          return (
            <>
              <div key={path}>{content}</div>
              <DemoPanel />
            </>
          );
        }}
      </RouterProvider>
    </ThemeProvider>
  );
}

function matchesPath(pattern: string, path: string) {
  const a = pattern.split("/").filter(Boolean);
  const b = path.split("/").filter(Boolean);
  return a.length === b.length && a.every((seg, i) => seg.startsWith(":") || seg === b[i]);
}

const el = document.getElementById("root");
if (el) createRoot(el).render(<App />);
