"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Role = "borrower" | "lender";

interface DemoState {
  role: Role;
  personaId: string;
  panelOpen: boolean;
  simulateErrors: boolean;
  /** Bumped after every mutation so data hooks refetch. */
  version: number;
  setRole: (r: Role) => void;
  setPersona: (id: string) => void;
  setPanelOpen: (open: boolean) => void;
  setSimulateErrors: (on: boolean) => void;
  invalidate: () => void;
}

export const useDemo = create<DemoState>()(
  persist(
    (set) => ({
      role: "borrower",
      personaId: "giorgi",
      panelOpen: false,
      simulateErrors: false,
      version: 0,
      setRole: (role) => set({ role }),
      setPersona: (personaId) => set((s) => ({ personaId, version: s.version + 1 })),
      setPanelOpen: (panelOpen) => set({ panelOpen }),
      setSimulateErrors: (simulateErrors) => set((s) => ({ simulateErrors, version: s.version + 1 })),
      invalidate: () => set((s) => ({ version: s.version + 1 })),
    }),
    {
      name: "trustline-demo-ui",
      skipHydration: true,
      partialize: (s) => ({ role: s.role, personaId: s.personaId, simulateErrors: s.simulateErrors }),
    },
  ),
);
