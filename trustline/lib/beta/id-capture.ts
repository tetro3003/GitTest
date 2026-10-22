"use client";

import { mrzFromOcr } from "./mrz";

/**
 * In-browser ID check helpers. Everything runs on the person's device:
 * photos never leave it, only the results are sent to the server.
 *  - OCR of the ID's machine-readable code: tesseract.js
 *  - face detection, face embedding, blink / head-turn and real-face scores: Human (@vladmandic/human)
 * Both download their models from a public CDN on first use (~10–20 MB, cached afterwards).
 */

type HumanT = import("@vladmandic/human").Human;
let humanP: Promise<HumanT> | null = null;

export function loadHuman(): Promise<HumanT> {
  humanP ??= (async () => {
    const { Human } = await import("@vladmandic/human");
    const h = new Human({
      modelBasePath: "https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/models/",
      backend: "webgl",
      debug: false,
      face: {
        enabled: true,
        detector: { rotation: true, maxDetected: 1 },
        mesh: { enabled: true },
        iris: { enabled: true },
        description: { enabled: true },
        emotion: { enabled: false },
        antispoof: { enabled: true },
        liveness: { enabled: true },
      },
      body: { enabled: false },
      hand: { enabled: false },
      object: { enabled: false },
      segmentation: { enabled: false },
      gesture: { enabled: true },
    });
    await h.load();
    if (!h.models.loaded().some((m) => m.includes("faceres"))) throw new Error("Face models couldn't be downloaded. Check your internet connection.");
    return h;
  })();
  humanP.catch(() => (humanP = null)); // allow a retry after a failed download
  return humanP;
}

export interface FaceRead {
  embedding: number[] | null;
  real: number | null;
  live: number | null;
  yaw: number;
  gestures: string[];
}

export async function readFace(input: HTMLVideoElement | HTMLCanvasElement): Promise<FaceRead | null> {
  const h = await loadHuman();
  const r = await h.detect(input);
  const f = r.face[0];
  if (!f) return null;
  return {
    embedding: f.embedding?.length ? Array.from(f.embedding) : null,
    real: typeof f.real === "number" ? f.real : null,
    live: typeof f.live === "number" ? f.live : null,
    yaw: f.rotation?.angle?.yaw ?? 0,
    gestures: r.gesture.filter((g) => "face" in g).map((g) => String(g.gesture)),
  };
}

export async function faceSimilarity(a: number[], b: number[]): Promise<number> {
  const h = await loadHuman();
  return h.match.similarity(a, b);
}

/** Reads the machine-readable lines from a photo of the ID's back (or a passport's photo page). */
export async function ocrMrz(canvas: HTMLCanvasElement, onProgress?: (p: number) => void): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, { logger: (m: { status: string; progress: number }) => m.status === "recognizing text" && onProgress?.(m.progress) });
  try {
    await worker.setParameters({ tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<" });
    // MRZ sits at the bottom: read the lower half, upscaled and in high contrast.
    const crop = document.createElement("canvas");
    const h = Math.round(canvas.height * 0.5);
    crop.width = canvas.width * 2;
    crop.height = h * 2;
    const ctx = crop.getContext("2d")!;
    ctx.filter = "grayscale(1) contrast(1.6)";
    ctx.drawImage(canvas, 0, canvas.height - h, canvas.width, h, 0, 0, crop.width, crop.height);
    const { data } = await worker.recognize(crop);
    return mrzFromOcr(data.text);
  } finally {
    await worker.terminate();
  }
}

export async function startCamera(video: HTMLVideoElement, facing: "user" | "environment"): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
  video.srcObject = stream;
  await video.play();
  return stream;
}

export function stopCamera(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

export function snapshot(video: HTMLVideoElement): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = video.videoWidth;
  c.height = video.videoHeight;
  c.getContext("2d")!.drawImage(video, 0, 0);
  return c;
}
