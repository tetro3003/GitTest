import json, re, subprocess, glob, numpy as np, soundfile as sf
f = glob.glob("video/*.webm")[0]
subprocess.run(["ffmpeg","-v","error","-y","-i",f,"-vf","fps=4,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=yavg.log","-f","null","-"],check=True)
vals = re.findall(r"pts_time:([\d.]+)\s+lavfi.signalstats.YAVG=([\d.]+)", open("yavg.log").read())
segs, start = [], None
for t, y in vals:
    t, d = float(t), float(y) < 60
    if d and start is None: start = t
    if not d and start is not None: segs.append((start, t)); start = None
assert len(segs) == 6, segs
L = json.load(open("lines.json"))
cue = {m.group(1): float(m.group(2)) for m in re.finditer(r"CUE (\w+) ([\d.]+)", open("rec.log").read())}
anch = [(cue["title"], segs[0][0]), (cue["input"], segs[2][0]), (cue["evidence"], segs[3][0]), (cue["impact"], segs[4][0]), (cue["close"] + L["close"]["dur"] + 0.5, segs[5][1])]
def tov(t):
    for (a, va), (b, vb) in zip(anch, anch[1:]):
        if t <= b or (b, vb) == anch[-1]: return va + (t - a) * (vb - va) / (b - a)
V0, VE = segs[0][0] - 0.1, segs[5][1] + 0.05
K = (anch[-1][1] - anch[0][1]) / (anch[-1][0] - anch[0][0])
real = (VE - V0) / K; S = max(1.0, real / 179.4)
print("anchors", anch, "K", round(K, 4), "real", round(real, 1), "S", round(S, 4))
sr = 24000; track = np.zeros(int((real + 1) * sr), dtype=np.float32)
for key, t in cue.items():
    a, _ = sf.read(f"{key}.wav", dtype="float32")
    i = int(((tov(t) - V0) / K + 0.15) * sr); track[i:i + len(a)] += a[:len(track) - i]
sf.write("vo.wav", track, sr)
F = K * S
subprocess.run(["ffmpeg","-v","error","-y","-ss",str(V0),"-to",str(VE),"-i",f,"-i","vo.wav","-filter_complex",
  f"[0:v]setpts=(PTS-STARTPTS)/{F},fps=30,format=yuv420p[v];[1:a]atempo={S},highpass=f=70,acompressor=threshold=-20dB:ratio=3:attack=5:release=120,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[a]",
  "-map","[v]","-map","[a]","-c:v","libx264","-preset","slow","-crf","20","-c:a","aac","-b:a","160k","-shortest","-movflags","+faststart","../trustline-demo-voice.mp4"],check=True)
subprocess.run(["ffmpeg","-v","error","-y","-i","../trustline-demo-voice.mp4","-c:v","copy","-an","../trustline-demo.mp4"],check=True)
print(subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0","../trustline-demo-voice.mp4"],capture_output=True,text=True).stdout)
