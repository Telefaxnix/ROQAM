# Baut die Töne der Sondermodus-Ansicht (Easter Egg) als 16-bit-WAV (44,1 kHz, mono), rein synthetisch.
# eingabe.wav:          Rückfrage, Claude braucht eine Antwort (vier steigende Pieptöne)
# bereit.wav:           Antwort fertig, der nächste Schritt ist bei dir. Standard seit 14.10.2026 (Wahl Dominik,
#                       Vorschlag 4): fallende Quinte D6 → G5 (1175 → 784 Hz), weicher Einsatz (20 ms), Ausklang wie
#                       angeschlagen, nur ganzzahlige Obertöne, die schneller abklingen als der Grundton
# bereit-klassisch.wav: der frühere, hellere Bereit-Ton (1568 → 1175 Hz mit Oberton); per Geheimwort wählbar
# Aufruf: python klang-bauen.py <Ordner>
import math
import struct
import sys
import wave

RATE = 44100


def ton(freq, ms, laut=0.42):
    n = int(RATE * ms / 1000)
    an = int(RATE * 0.006)
    aus = int(RATE * 0.012)
    out = []
    for i in range(n):
        t = i / RATE
        # Grundton mit leiser Oktave: klingt nach Bordcomputer statt nach reinem Sinus
        v = math.sin(2 * math.pi * freq * t) + 0.18 * math.sin(2 * math.pi * 2 * freq * t)
        h = 1.0
        if i < an:
            h = i / an
        elif i > n - aus:
            h = max(0.0, (n - i) / aus)
        out.append(v * h * laut / 1.18)
    return out


# Angeschlagener Klang: 20 ms weicher Einsatz (Kosinus), danach exponentieller Ausklang (tau), die letzten 15 ms
# weich auf null; Obertöne 2 und 3 leise und mit tau/k schneller abklingend (weniger Schärfe)
def klang(freq, ms, tau_ms, laut=0.40, ober=(0.06, 0.02)):
    n = int(RATE * ms / 1000)
    an = 0.020
    tau = tau_ms / 1000
    aus = int(RATE * 0.015)
    out = []
    for i in range(n):
        t = i / RATE
        h = 0.5 - 0.5 * math.cos(math.pi * t / an) if t < an else math.exp(-(t - an) / tau)
        if i >= n - aus:
            h *= 1 - (i - (n - aus)) / (aus - 1)
        v = math.sin(2 * math.pi * freq * t)
        for k, a in enumerate(ober, start=2):
            v += a * math.exp(-t / (tau / k)) * math.sin(2 * math.pi * k * freq * t)
        out.append(laut * h * v / (1 + sum(ober)))
    return out


# Zwei angeschlagene Klänge, der zweite setzt nach `abstand` ms ein (leicht überlappend)
def folge(f1, f2, ms1=110, ms2=320, tau1=70, tau2=150, abstand=95, ober=(0.06, 0.02)):
    a = klang(f1, ms1, tau1, ober=ober)
    b = klang(f2, ms2, tau2, ober=ober)
    start = int(RATE * abstand / 1000)
    out = [0.0] * (max(len(a), start + len(b)) + int(RATE * 0.04))
    for i, v in enumerate(a):
        out[i] += v
    for i, v in enumerate(b):
        out[start + i] += v
    return out


def pause(ms):
    return [0.0] * int(RATE * ms / 1000)


def schreiben(pfad, werte):
    with wave.open(pfad, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, v)) * 32767)) for v in werte))


ziel = sys.argv[1]
eingabe = ton(1047, 70) + pause(28) + ton(1319, 70) + pause(28) + ton(1568, 70) + pause(28) + ton(2093, 150) + pause(40)
bereit = folge(1175, 784, ober=(0.10, 0.03))
klassisch = ton(1568, 75) + pause(30) + ton(1175, 130) + pause(40)
schreiben(ziel + '/eingabe.wav', eingabe)
schreiben(ziel + '/bereit.wav', bereit)
schreiben(ziel + '/bereit-klassisch.wav', klassisch)
print('eingabe', len(eingabe) / RATE, 's;', 'bereit', len(bereit) / RATE, 's;', 'bereit-klassisch', len(klassisch) / RATE, 's')
