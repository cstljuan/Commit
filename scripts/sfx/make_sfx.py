#!/usr/bin/env python3
"""
Commit's sound effects, all synthesised from scratch, so there is nothing to license.
Run: python3 scripts/sfx/make_sfx.py    Writes assets/sfx/*.wav

Three voices, one for each mode:
  normal  wooden and warm, like a takoyaki stall: marimba tones
  women   glassy and sparkly: bell tones
  hack    8-bit: square waves and noise
Hachi has a small squeaky voice of its own in every mode.
"""
import math
import random
import struct
import wave
from pathlib import Path

RATE = 22050
OUT = Path(__file__).resolve().parents[2] / "assets" / "sfx"
random.seed(8)

NOTE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def hz(name):
    """'C5' or 'F#4' to a frequency."""
    step = NOTE[name[0]] + (1 if "#" in name else 0)
    octave = int(name[-1])
    return 440.0 * 2 ** ((step + 12 * (octave + 1) - 69) / 12)


def silence(seconds):
    return [0.0] * int(seconds * RATE)


def mix(*tracks):
    out = [0.0] * max(len(t) for t in tracks)
    for track in tracks:
        for i, v in enumerate(track):
            out[i] += v
    return out


def at(seconds, track):
    return silence(seconds) + list(track)


def gain(track, g):
    return [v * g for v in track]


def tone(freq, seconds, wave_fn=math.sin, decay=6.0, attack=0.003, sweep=None, vibrato=0.0):
    """One voice. freq glides to `sweep`. decay is how fast it dies away."""
    n = int(seconds * RATE)
    out = []
    phase = 0.0
    for i in range(n):
        t = i / RATE
        f = freq if sweep is None else freq * (sweep / freq) ** (i / max(1, n - 1))
        if vibrato:
            f *= 1 + vibrato * math.sin(2 * math.pi * 7 * t)
        phase += 2 * math.pi * f / RATE
        env = min(1.0, t / attack) * math.exp(-decay * t)
        out.append(wave_fn(phase) * env)
    return out


def square(phase):
    return 1.0 if math.sin(phase) >= 0 else -1.0


def triangle(phase):
    return 2 / math.pi * math.asin(math.sin(phase))


def noise(seconds, decay=8.0, attack=0.002, low=None, high=None):
    """Filtered noise. low and high are cutoff glides from start to end, in Hz."""
    n = int(seconds * RATE)
    out = []
    state = 0.0
    for i in range(n):
        t = i / RATE
        cut = 12000.0
        if low is not None:
            cut = low * ((high or low) / low) ** (i / max(1, n - 1))
        a = min(1.0, 2 * math.pi * cut / RATE)
        state += a * (random.uniform(-1, 1) - state)
        out.append(state * min(1.0, t / attack) * math.exp(-decay * t))
    return out


def marimba(freq, seconds=0.4):
    return mix(
        gain(tone(freq, seconds, decay=11), 0.75),
        gain(tone(freq * 4, seconds * 0.4, decay=34), 0.28),
        gain(noise(0.02, decay=180, low=3500), 0.25),
    )


def bell(freq, seconds=0.7):
    return mix(
        gain(tone(freq, seconds, decay=6), 0.5),
        gain(tone(freq * 2.76, seconds, decay=9), 0.28),
        gain(tone(freq * 5.4, seconds * 0.6, decay=15), 0.16),
    )


def chip(freq, seconds=0.12):
    return gain(tone(freq, seconds, wave_fn=square, decay=7), 0.4)


VOICE = {"normal": marimba, "women": bell, "hack": chip}


def notes(voice, names, gap, length=None):
    """A little phrase of notes, `gap` seconds apart."""
    fn = VOICE[voice]
    tracks = []
    for i, name in enumerate(names):
        one = fn(hz(name), length) if length else fn(hz(name))
        tracks.append(at(i * gap, one))
    return mix(*tracks)


def echo(track, delay=0.11, feedback=0.35, repeats=4):
    d = int(delay * RATE)
    out = list(track) + [0.0] * (d * repeats)
    for i in range(d, len(out)):
        out[i] += out[i - d] * feedback
    return out


def sparkle(count=7, seconds=0.5, start=1600.0):
    tracks = []
    for i in range(count):
        f = start * 2 ** (random.randint(0, 22) / 12)
        tracks.append(at(random.uniform(0, seconds), gain(tone(f, 0.16, decay=26), 0.16)))
    return mix(*tracks)


def whoosh(rising=True, seconds=0.24):
    low, high = (500, 6000) if rising else (6000, 400)
    n = noise(seconds, decay=2.5, attack=0.07, low=low, high=high)
    return [v * math.sin(math.pi * i / len(n)) for i, v in enumerate(n)]


def write(name, track, peak=0.82):
    top = max(1e-6, max(abs(v) for v in track))
    fade = int(0.008 * RATE)
    data = []
    for i, v in enumerate(track):
        end = min(1.0, (len(track) - 1 - i) / fade)
        data.append(struct.pack("<h", int(max(-1, min(1, v / top * peak * end)) * 32767)))
    with wave.open(str(OUT / f"{name}.wav"), "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(RATE)
        f.writeframes(b"".join(data))
    print(f"{name:18} {len(track) / RATE:5.2f}s")


def build():
    OUT.mkdir(parents=True, exist_ok=True)

    # Swipes share a whoosh, and the mode's voice lands on top.
    like = {"normal": ["G4", "D5"], "women": ["E5", "B5"], "hack": ["C5", "G5"]}
    passed = {"normal": ["A3", "E3"], "women": ["A4", "E4"], "hack": ["E4", "A3"]}
    match = {
        "normal": ["C4", "E4", "G4", "C5", "E5", "G5"],
        "women": ["G4", "C5", "E5", "G5", "C6", "E6"],
        "hack": ["C4", "E4", "G4", "C5", "G4", "C5", "E5", "G5"],
    }
    chord = {
        "normal": ["C4", "G4", "C5", "E5"],
        "women": ["C5", "G5", "C6", "E6"],
        "hack": ["C4", "G4", "C5", "G5"],
    }
    for mode in VOICE:
        write(f"like_{mode}", mix(gain(whoosh(True), 0.45), at(0.04, notes(mode, like[mode], 0.07))))
        write(f"pass_{mode}", mix(gain(whoosh(False), 0.5), at(0.03, gain(notes(mode, passed[mode], 0.08), 0.7))))
        write(f"tap_{mode}", VOICE[mode](hz({"normal": "C5", "women": "E6", "hack": "C6"}[mode]), 0.07))

        phrase = notes(mode, match[mode], 0.085)
        extra = [sparkle(14, 0.9)] if mode != "hack" else [at(0.5, gain(noise(0.4, decay=7, low=8000), 0.12))]
        write(f"match_{mode}", echo(mix(phrase, *extra), 0.13, 0.28))

        # The commit lands hard: a thud under a full chord, then it rings.
        thud = gain(tone(150, 0.3, decay=13, sweep=52), 0.9)
        ring = [at(i * 0.012, VOICE[mode](hz(n), 0.6)) for i, n in enumerate(chord[mode])]
        write(f"commit_{mode}", echo(mix(thud, *ring), 0.12, 0.25, 3))

    write("super", echo(mix(gain(whoosh(True, 0.35), 0.5), gain(tone(350, 0.45, decay=3, sweep=1800), 0.35), at(0.22, sparkle(12, 0.45))), 0.1, 0.25))
    write("undo", mix(gain(whoosh(False, 0.16), 0.4), gain(tone(880, 0.14, decay=10, sweep=440, wave_fn=triangle), 0.5)))
    write("tick", gain(tone(1500, 0.03, decay=90), 0.5))
    write("toggle", gain(tone(900, 0.06, decay=40, sweep=1300, wave_fn=triangle), 0.7))
    write("mode", mix(gain(whoosh(True, 0.42), 0.55), gain(tone(260, 0.45, decay=3.5, sweep=880), 0.3)))

    # Holding to commit: rises for as long as the ring takes to fill.
    n = int(1.0 * RATE)
    rise = []
    phase = 0.0
    for i in range(n):
        p = i / n
        phase += 2 * math.pi * (110 * 2 ** (p * 3)) / RATE
        rise.append((math.sin(phase) + 0.4 * math.sin(phase * 2)) * (0.15 + 0.85 * p))
    write("hold", mix(rise, [v * 0.15 for v in noise(1.0, decay=0.01, attack=0.5, low=800, high=7000)]))

    write("msg_out", gain(tone(620, 0.1, decay=24, sweep=980), 0.8))
    write("msg_in", mix(gain(tone(880, 0.13, decay=20), 0.6), at(0.08, gain(tone(1320, 0.18, decay=16), 0.6))))
    write("error", mix(gain(tone(170, 0.18, decay=14, sweep=120, wave_fn=triangle), 0.9), at(0.14, gain(tone(130, 0.24, decay=12, sweep=90, wave_fn=triangle), 0.9))))
    write("ink", mix(gain(noise(0.35, decay=9, low=2400, high=250), 0.9), gain(tone(190, 0.26, decay=11, sweep=60), 0.7), at(0.12, gain(noise(0.18, decay=20, low=1500), 0.4))))

    # Hachi's voice: small, squeaky, and always sliding between notes.
    chirp = lambda a, b, s=0.14, d=11: gain(tone(a, s, wave_fn=triangle, decay=d, sweep=b, vibrato=0.012), 0.8)
    write("h_happy", mix(chirp(700, 1250), at(0.11, chirp(950, 1650, 0.16))))
    write("h_wink", chirp(1100, 1700, 0.1, 18))
    write("h_poke", chirp(1800, 1100, 0.09, 20))
    write("h_bonk", mix(gain(tone(700, 0.3, decay=9, sweep=170, vibrato=0.05), 0.8), gain(noise(0.02, decay=180, low=2600), 0.5)))
    write("h_giggle", mix(*[at(i * 0.075, chirp(980 + 170 * (i % 2) + 40 * i, 1250 + 170 * (i % 2) + 40 * i, 0.07, 22)) for i in range(7)]))
    write("h_purr", gain(tone(170, 0.8, wave_fn=triangle, decay=2, attack=0.08, vibrato=0.09), 0.9))
    write("h_jump", gain(tone(280, 0.28, decay=6, sweep=1800, wave_fn=triangle), 0.8))
    write("h_flip", mix(gain(tone(350, 0.45, decay=3, sweep=1500, wave_fn=triangle, vibrato=0.02), 0.7), at(0.36, chirp(1250, 1800, 0.12))))
    write("h_dizzy", gain(tone(1300, 0.8, decay=2.2, sweep=220, wave_fn=triangle, vibrato=0.16), 0.8))
    write("h_sad", gain(tone(620, 0.4, decay=4, sweep=260, wave_fn=triangle, vibrato=0.02), 0.8))
    write("h_wake", gain(tone(280, 0.5, decay=3, sweep=760, wave_fn=triangle, vibrato=0.03, attack=0.06), 0.8))
    write("h_squeeze", mix(gain(tone(420, 0.3, decay=3, sweep=1700, wave_fn=triangle), 0.8)))


if __name__ == "__main__":
    build()
