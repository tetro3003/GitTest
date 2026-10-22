import { createHash, createPublicKey, verify as edVerify } from "node:crypto";
import { keccak256, recoverAddress, toBytes, verifyMessage, type Hex } from "viem";
import type { ChainFamily } from "@/lib/beta/types";
import type { NewPayment, Run } from "../store";
import { ProviderError } from "./figma";

/**
 * Crypto wallets. A wallet app (MetaMask, Phantom, TronLink…) is just a key
 * holder; what we verify and read is the ADDRESS on a blockchain.
 *  1. Ownership: the designer signs a one-time message. Only the owner of the
 *     address can produce that signature, so nobody can claim someone else's wallet.
 *  2. Payments: stablecoin transfers into the address, read from public
 *     blockchain explorers. Only real USDT/USDC contracts count, so look-alike
 *     scam tokens are ignored.
 * One EVM address works on every EVM chain, so it is read on all of them.
 */

type Fetch = typeof fetch;

/* ---------- base58 (Solana and Tron addresses) ---------- */

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function base58Decode(s: string): Uint8Array | null {
  let n = BigInt(0);
  for (const ch of s) {
    const i = B58.indexOf(ch);
    if (i < 0) return null;
    n = n * BigInt(58) + BigInt(i);
  }
  const bytes: number[] = [];
  while (n > BigInt(0)) {
    bytes.unshift(Number(n % BigInt(256)));
    n /= BigInt(256);
  }
  for (const ch of s) {
    if (ch !== "1") break;
    bytes.unshift(0);
  }
  return Uint8Array.from(bytes);
}

export function base58Encode(bytes: Uint8Array): string {
  let n = BigInt(0);
  for (const b of bytes) n = n * BigInt(256) + BigInt(b);
  let out = "";
  while (n > BigInt(0)) {
    out = B58[Number(n % BigInt(58))] + out;
    n /= BigInt(58);
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = "1" + out;
  }
  return out;
}

const sha = (b: Uint8Array) => createHash("sha256").update(b).digest();

export function tronFromEvmHex(hex: string): string {
  const payload = Buffer.concat([Buffer.from([0x41]), Buffer.from(hex.slice(2), "hex")]);
  return base58Encode(Buffer.concat([payload, sha(sha(payload)).subarray(0, 4)]));
}

/** Validates an address for its family and returns its canonical form, or null. */
export function normalizeAddress(family: ChainFamily, raw: string): string | null {
  const a = raw.trim();
  if (family === "evm") return /^0x[0-9a-fA-F]{40}$/.test(a) ? a.toLowerCase() : null;
  if (family === "solana") return base58Decode(a)?.length === 32 ? a : null;
  const b = base58Decode(a);
  if (!b || b.length !== 25 || b[0] !== 0x41) return null;
  return sha(sha(b.subarray(0, 21))).subarray(0, 4).equals(Buffer.from(b.subarray(21))) ? a : null;
}

export function walletChallengeMessage(address: string, code: string, issuedAt: string): string {
  return ["Trustline wallet check", "I confirm that I own this wallet.", `Address: ${address}`, `Code: ${code}`, `Issued: ${issuedAt}`, "Signing moves no money and costs no fee."].join("\n");
}

function decodeSignatureBytes(sig: string): Uint8Array | null {
  const s = sig.trim();
  if (/^(0x)?[0-9a-fA-F]+$/.test(s) && s.replace(/^0x/, "").length % 2 === 0) return Buffer.from(s.replace(/^0x/, ""), "hex");
  const b58 = base58Decode(s);
  if (b58 && b58.length === 64) return b58;
  try {
    const b = Buffer.from(s, "base64");
    return b.length ? b : null;
  } catch {
    return null;
  }
}

/** Checks the signature mathematically. No network call. */
export async function verifyWalletSignature(family: ChainFamily, address: string, message: string, signature: string): Promise<boolean> {
  try {
    if (family === "evm") {
      return await verifyMessage({ address: address as Hex, message, signature: signature.trim() as Hex });
    }
    if (family === "solana") {
      const sig = decodeSignatureBytes(signature);
      const pub = base58Decode(address);
      if (!sig || sig.length !== 64 || !pub || pub.length !== 32) return false;
      const key = createPublicKey({ key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(pub)]), format: "der", type: "spki" });
      return edVerify(null, Buffer.from(message, "utf8"), key, Buffer.from(sig));
    }
    // Tron (TronLink signMessageV2): keccak256("\x19TRON Signed Message:\n" + length + message)
    const bytes = toBytes(message);
    const hash = keccak256(Buffer.concat([Buffer.from(`\x19TRON Signed Message:\n${bytes.length}`), Buffer.from(bytes)]));
    const sig = signature.trim().startsWith("0x") ? signature.trim() : `0x${signature.trim()}`;
    const recovered = await recoverAddress({ hash, signature: sig as Hex });
    return tronFromEvmHex(recovered) === address;
  } catch {
    return false;
  }
}

/* ---------- reading payments ---------- */

interface EvmChain {
  id: string;
  name: string;
  explorerApi: string;
  txUrl: string;
  /** Real stablecoin contracts (lowercase) → symbol. */
  tokens: Record<string, string>;
}

export const EVM_CHAINS: EvmChain[] = [
  { id: "ethereum", name: "Ethereum", explorerApi: "https://eth.blockscout.com", txUrl: "https://etherscan.io/tx/", tokens: { "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "USDC", "0xdac17f958d2ee523a2206206994597c13d831ec7": "USDT" } },
  { id: "base", name: "Base", explorerApi: "https://base.blockscout.com", txUrl: "https://basescan.org/tx/", tokens: { "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": "USDC" } },
  { id: "polygon", name: "Polygon", explorerApi: "https://polygon.blockscout.com", txUrl: "https://polygonscan.com/tx/", tokens: { "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359": "USDC", "0xc2132d05d31c914a87c6611c10748aeb04b58e8f": "USDT" } },
  { id: "arbitrum", name: "Arbitrum", explorerApi: "https://arbitrum.blockscout.com", txUrl: "https://arbiscan.io/tx/", tokens: { "0xaf88d065e77c8cc2239327c5edb3a432268e5831": "USDC", "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9": "USDT" } },
  { id: "optimism", name: "Optimism", explorerApi: "https://optimism.blockscout.com", txUrl: "https://optimistic.etherscan.io/tx/", tokens: { "0x0b2c639c533813f4aa9d7837caf62653d097ff85": "USDC", "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58": "USDT" } },
];

export const TRON_USDT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
export const SOLANA_STABLES: Record<string, string> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "USDT",
};

const EXCHANGES = /binance|coinbase|kraken|okx|bybit|kucoin|bitget|gate\.io|htx|huobi|crypto\.com|mexc|bitfinex|bitstamp/i;
/** Below this a transfer is dust or "address poisoning" spam, never income. */
export const DUST_USD = 1;

export type RawPayment = Omit<NewPayment, "status" | "note">;

async function getJson<T>(f: Fetch, url: string, init?: RequestInit): Promise<T> {
  const res = await f(url, init);
  if (res.status === 429) throw new ProviderError("The blockchain reader asked us to slow down. The robot will try again later.", 429);
  if (!res.ok) throw new ProviderError(`Blockchain reader returned ${res.status}`, 502);
  return (await res.json()) as T;
}

interface BlockscoutTransfer {
  from: { hash: string; name?: string | null; metadata?: { tags?: { name: string }[] } | null };
  to: { hash: string };
  token: { address?: string; address_hash?: string; symbol?: string };
  total: { value: string; decimals: string | number | null };
  timestamp: string;
  tx_hash?: string;
  transaction_hash?: string;
  log_index?: number | string;
}

export async function readEvmPayments(address: string, run: Run, f: Fetch = fetch): Promise<RawPayment[]> {
  const out: RawPayment[] = [];
  for (const chain of EVM_CHAINS) {
    run.step("trustline", `Reading incoming USDT/USDC on ${chain.name}`, `GET ${chain.explorerApi}/api/v2/addresses/${address}/token-transfers?type=ERC-20&filter=to`);
    let fake = 0;
    let found = 0;
    let params = "";
    for (let page = 0; page < 5; page++) {
      let r: { items: BlockscoutTransfer[]; next_page_params?: Record<string, string | number> | null };
      try {
        r = await getJson(f, `${chain.explorerApi}/api/v2/addresses/${address}/token-transfers?type=ERC-20&filter=to${params}`);
      } catch (e) {
        run.warn("blockchain", `${chain.name} reader is unavailable right now (${(e as Error).message}). Skipped; the robot will retry.`);
        break;
      }
      for (const t of r.items) {
        if (t.to.hash.toLowerCase() !== address) continue;
        const token = (t.token.address_hash ?? t.token.address ?? "").toLowerCase();
        const symbol = chain.tokens[token];
        if (!symbol) {
          if (/usd/i.test(t.token.symbol ?? "")) fake++;
          continue;
        }
        const decimals = Number(t.total.decimals ?? 6);
        const amount = Number(t.total.value) / 10 ** decimals;
        const tx = t.transaction_hash ?? t.tx_hash ?? "";
        const label = t.from.name ?? t.from.metadata?.tags?.[0]?.name ?? null;
        out.push({ source: "wallet", extId: `${chain.id}:${tx}:${t.log_index ?? 0}`, at: t.timestamp, amountUsd: amount, asset: symbol, chain: chain.name, payer: t.from.hash.toLowerCase(), payerLabel: label, proof: chain.txUrl + tx });
        found++;
      }
      if (!r.next_page_params) break;
      params = "&" + new URLSearchParams(Object.entries(r.next_page_params).map(([k, v]) => [k, String(v)])).toString();
    }
    run.ok("blockchain", `${chain.name}: ${found} incoming stablecoin transfer${found === 1 ? "" : "s"}`);
    if (fake) run.warn("trustline", `${chain.name}: ignored ${fake} fake token${fake === 1 ? "" : "s"} pretending to be USD coins`, "Only the official USDT/USDC contracts count");
  }
  return out;
}

export async function readTronPayments(address: string, run: Run, f: Fetch = fetch): Promise<RawPayment[]> {
  const headers: Record<string, string> = process.env.TRONGRID_API_KEY ? { "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY } : {};
  const base = `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20?only_to=true&limit=200&contract_address=${TRON_USDT}`;
  run.step("trustline", "Reading incoming USDT on Tron", `GET ${base}`);
  const out: RawPayment[] = [];
  let fingerprint = "";
  for (let page = 0; page < 5; page++) {
    const r = await getJson<{ data: { transaction_id: string; block_timestamp: number; from: string; to: string; value: string; token_info: { address: string; decimals: number } }[]; meta?: { fingerprint?: string } }>(f, base + (fingerprint ? `&fingerprint=${fingerprint}` : ""), { headers });
    for (const t of r.data) {
      if (t.to !== address || t.token_info.address !== TRON_USDT) continue;
      out.push({ source: "wallet", extId: `tron:${t.transaction_id}`, at: new Date(t.block_timestamp).toISOString(), amountUsd: Number(t.value) / 10 ** t.token_info.decimals, asset: "USDT", chain: "Tron", payer: t.from, payerLabel: null, proof: `https://tronscan.org/#/transaction/${t.transaction_id}` });
    }
    fingerprint = r.meta?.fingerprint ?? "";
    if (!fingerprint) break;
  }
  run.ok("blockchain", `Tron: ${out.length} incoming USDT transfer${out.length === 1 ? "" : "s"}`);
  return out;
}

interface TokenBalance {
  accountIndex: number;
  mint: string;
  owner?: string;
  uiTokenAmount: { uiAmount: number | null };
}

export async function readSolanaPayments(address: string, run: Run, f: Fetch = fetch, maxTx = 60): Promise<RawPayment[]> {
  const url = process.env.SOLANA_RPC_URL?.trim() || "https://api.mainnet-beta.solana.com";
  let rpcId = 0;
  const rpc = async <T>(method: string, params: unknown[]): Promise<T> => {
    const r = await getJson<{ result?: T; error?: { message: string } }>(f, url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }) });
    if (r.error) throw new ProviderError(`Solana reader: ${r.error.message}`, 502);
    return r.result as T;
  };
  const out: RawPayment[] = [];
  for (const [mint, symbol] of Object.entries(SOLANA_STABLES)) {
    run.step("trustline", `Finding your ${symbol} account on Solana`, `RPC getTokenAccountsByOwner(${address}, mint ${mint.slice(0, 6)}…)`);
    const accts = await rpc<{ value: { pubkey: string }[] }>("getTokenAccountsByOwner", [address, { mint }, { encoding: "jsonParsed" }]);
    for (const { pubkey } of accts.value) {
      run.step("trustline", `Listing ${symbol} transactions`, `RPC getSignaturesForAddress(${pubkey.slice(0, 6)}…, limit ${maxTx})`);
      const sigs = await rpc<{ signature: string; err: unknown }[]>("getSignaturesForAddress", [pubkey, { limit: maxTx }]);
      for (const s of sigs) {
        if (s.err) continue;
        const tx = await rpc<{ blockTime: number; meta: { preTokenBalances: TokenBalance[]; postTokenBalances: TokenBalance[] } } | null>("getTransaction", [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]);
        if (!tx?.meta) continue;
        const bal = (list: TokenBalance[], owner: string) => list.filter((b) => b.mint === mint && b.owner === owner).reduce((a, b) => a + (b.uiTokenAmount.uiAmount ?? 0), 0);
        const delta = bal(tx.meta.postTokenBalances, address) - bal(tx.meta.preTokenBalances, address);
        if (delta <= 0) continue;
        const sender = tx.meta.preTokenBalances.find((b) => b.mint === mint && b.owner && b.owner !== address && (b.uiTokenAmount.uiAmount ?? 0) > bal(tx.meta.postTokenBalances, b.owner!));
        out.push({ source: "wallet", extId: `sol:${s.signature}:${symbol}`, at: new Date(tx.blockTime * 1000).toISOString(), amountUsd: delta, asset: symbol, chain: "Solana", payer: sender?.owner ?? "unknown", payerLabel: null, proof: `https://solscan.io/tx/${s.signature}` });
      }
    }
  }
  run.ok("blockchain", `Solana: ${out.length} incoming stablecoin transfer${out.length === 1 ? "" : "s"}`);
  return out;
}

export function readWalletPayments(family: ChainFamily, address: string, run: Run, f: Fetch = fetch): Promise<RawPayment[]> {
  if (family === "evm") return readEvmPayments(address, run, f);
  if (family === "tron") return readTronPayments(address, run, f);
  return readSolanaPayments(address, run, f);
}

/** Decides whether a payment is income. `ownAddresses` are all wallets this person has proven they own. */
export function classifyPayment(p: Pick<RawPayment, "amountUsd" | "payer" | "payerLabel">, ownAddresses: ReadonlySet<string>): { status: NewPayment["status"]; note: string | null } {
  if (p.amountUsd < DUST_USD) return { status: "ignored", note: "Tiny transfer: dust or address-poisoning spam" };
  if (ownAddresses.has(p.payer.toLowerCase())) return { status: "own_transfer", note: "From another wallet you own, so it isn't new income" };
  if (p.payerLabel && EXCHANGES.test(p.payerLabel)) return { status: "unclear", note: `From an exchange (${p.payerLabel}): could be your own money, so it isn't counted yet` };
  return { status: "income", note: null };
}
