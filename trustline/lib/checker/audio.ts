"use client";

import type { LessonRecordingSample } from "../api/client";

/**
 * Measures a lesson recording in the browser: total length and how much of it
 * contains speech (short-frame energy above an adaptive noise floor). The audio
 * never leaves the device — only these two numbers are sent.
 */
export async function analyzeLessonAudio(file: File): Promise<LessonRecordingSample> {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) throw new Error("This browser can't analyse audio. Try Chrome, Edge or Safari.");
  const ctx = new Ctx();
  try {
    const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
    const data = buffer.getChannelData(0);
    const frame = Math.max(1, Math.floor(buffer.sampleRate * 0.05)); // 50 ms
    const energies: number[] = [];
    for (let i = 0; i + frame <= data.length; i += frame) {
      let sum = 0;
      for (let j = i; j < i + frame; j++) sum += data[j] * data[j];
      energies.push(Math.sqrt(sum / frame));
    }
    const sorted = [...energies].sort((a, b) => a - b);
    const floor = sorted[Math.floor(sorted.length * 0.2)] ?? 0;
    const threshold = Math.max(floor * 3, 0.01);
    const speechFrames = energies.filter((e) => e > threshold).length;
    const minutes = buffer.duration / 60;
    return {
      name: file.name.replace(/\.[^.]+$/, ""),
      recordedMinutes: Math.round(minutes * 10) / 10,
      speechMinutes: Math.round((energies.length ? (speechFrames / energies.length) * minutes : 0) * 10) / 10,
    };
  } catch (e) {
    throw new Error(e instanceof Error && e.message.includes("browser") ? e.message : "We couldn't read this file. Upload an MP3, M4A, WAV or OGG recording.");
  } finally {
    void ctx.close();
  }
}
