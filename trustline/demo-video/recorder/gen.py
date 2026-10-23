import json, numpy as np, soundfile as sf
import os
from kokoro_onnx import Kokoro
from lines import L
M = os.environ.get("KOKORO_DIR", "models")
k = Kokoro(f"{M}/kokoro-v1.0.onnx", f"{M}/voices-v1.0.bin")
meta = {}
for i, (key, (cap, vo)) in enumerate(L.items()):
    a, sr = k.create(vo, voice="af_heart", speed=1.05, lang="en-us")
    nz = np.where(np.abs(a) > 0.01)[0]
    a = a[max(nz[0] - 800, 0): nz[-1] + 2400]
    sf.write(f"{key}.wav", a, sr)
    meta[key] = {"caption": cap, "dur": round(len(a) / sr, 2)}
json.dump(meta, open("lines.json", "w"), indent=1)
print(sum(m["dur"] for m in meta.values()), {k: v["dur"] for k, v in meta.items()})
