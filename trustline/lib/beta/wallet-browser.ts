"use client";

import type { ChainFamily } from "./types";

/**
 * Finds wallet apps installed in this browser and asks them to sign.
 * EVM wallets announce themselves through EIP-6963, so MetaMask, Phantom,
 * Rabby, Coinbase Wallet, Trust… all show up side by side. Solana and Tron
 * wallets expose a known object on window.
 */
export interface BrowserWallet {
  id: string;
  name: string;
  icon: string | null;
  family: ChainFamily;
  /** Asks the wallet for its address (opens the wallet's own popup). */
  connect(): Promise<string>;
  /** Asks the wallet to sign a text message; returns the signature as text. */
  sign(message: string, address: string): Promise<string>;
}

interface Eip1193 {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}
interface SolanaProvider {
  connect(): Promise<{ publicKey: { toString(): string } } | void>;
  publicKey?: { toString(): string } | null;
  signMessage(msg: Uint8Array, display?: string): Promise<{ signature: Uint8Array } | Uint8Array>;
}
interface W {
  ethereum?: Eip1193 & { isMetaMask?: boolean };
  phantom?: { solana?: SolanaProvider };
  solflare?: SolanaProvider;
  backpack?: SolanaProvider;
  tronLink?: Eip1193;
  tronWeb?: { defaultAddress?: { base58?: string }; trx: { signMessageV2(msg: string): Promise<string> } };
}

const toHex = (s: string) => "0x" + Array.from(new TextEncoder().encode(s), (b) => b.toString(16).padStart(2, "0")).join("");
const toBase64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));

function evmWallet(id: string, name: string, icon: string | null, p: Eip1193): BrowserWallet {
  return {
    id,
    name,
    icon,
    family: "evm",
    async connect() {
      const accts = (await p.request({ method: "eth_requestAccounts" })) as string[];
      if (!accts?.[0]) throw new Error("The wallet didn't share an address");
      return accts[0];
    },
    async sign(message, address) {
      return (await p.request({ method: "personal_sign", params: [toHex(message), address] })) as string;
    },
  };
}

function solanaWallet(id: string, name: string, p: SolanaProvider): BrowserWallet {
  return {
    id,
    name,
    icon: null,
    family: "solana",
    async connect() {
      const r = await p.connect();
      const key = (r && "publicKey" in r ? r.publicKey : p.publicKey)?.toString();
      if (!key) throw new Error("The wallet didn't share an address");
      return key;
    },
    async sign(message) {
      const r = await p.signMessage(new TextEncoder().encode(message), "utf8");
      return toBase64(r instanceof Uint8Array ? r : r.signature);
    },
  };
}

export function discoverWallets(timeoutMs = 400): Promise<BrowserWallet[]> {
  if (typeof window === "undefined") return Promise.resolve([]);
  const w = window as unknown as W;
  const found: BrowserWallet[] = [];
  const onAnnounce = (e: Event) => {
    const d = (e as CustomEvent<{ info: { uuid: string; name: string; icon: string; rdns: string }; provider: Eip1193 }>).detail;
    if (d && !found.some((x) => x.id === d.info.rdns)) found.push(evmWallet(d.info.rdns, d.info.name, d.info.icon, d.provider));
  };
  window.addEventListener("eip6963:announceProvider", onAnnounce);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  return new Promise((resolve) => {
    setTimeout(() => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
      if (!found.some((x) => x.family === "evm") && w.ethereum) found.push(evmWallet("injected", w.ethereum.isMetaMask ? "MetaMask" : "Browser wallet", null, w.ethereum));
      if (w.phantom?.solana) found.push(solanaWallet("phantom-sol", "Phantom (Solana)", w.phantom.solana));
      if (w.solflare) found.push(solanaWallet("solflare", "Solflare", w.solflare));
      if (w.backpack) found.push(solanaWallet("backpack", "Backpack", w.backpack));
      if (w.tronLink) {
        const link = w.tronLink;
        found.push({
          id: "tronlink",
          name: "TronLink",
          icon: null,
          family: "tron",
          async connect() {
            await link.request({ method: "tron_requestAccounts" });
            const a = (window as unknown as W).tronWeb?.defaultAddress?.base58;
            if (!a) throw new Error("Unlock TronLink and try again");
            return a;
          },
          async sign(message) {
            const tw = (window as unknown as W).tronWeb;
            if (!tw) throw new Error("TronLink isn't ready");
            return tw.trx.signMessageV2(message);
          },
        });
      }
      resolve(found);
    }, timeoutMs);
  });
}
