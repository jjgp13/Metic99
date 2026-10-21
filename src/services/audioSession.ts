import type Phaser from "phaser";

/**
 * Sound on iPhones. Two iOS rules would otherwise keep the game silent:
 *
 * 1. The ring/silent switch mutes web game audio (Web Audio), though not
 *    media playback (videos, music players). Most iPhones sit on silent, so
 *    the game asks iOS to treat its sound as media playback:
 *    `navigator.audioSession.type = "playback"` (iOS 17+), or on older
 *    iPhones a silent looping <audio> element started by the first tap,
 *    which puts the whole page in playback mode.
 * 2. Audio starts suspended and can only be resumed by a tap or key, and iOS
 *    suspends it again after a phone call or a trip to another app. Phaser
 *    resumes it once, on the very first touch; this also resumes it on every
 *    later tap while it isn't running (a cheap check).
 *
 * Everywhere else these are no-ops, so desktop and Android are unchanged.
 */
export function keepSoundOnIPhone(game: Phaser.Game): void {
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) {
    try {
      session.type = "playback";
    } catch {
      // Not allowed here: the silent switch keeps muting, nothing breaks.
    }
  }
  const needsSilentLoop = !session && isIPhoneOrIPad();
  const onGesture = (): void => {
    // Only Phaser's Web Audio manager has a context (not its HTML5 fallback).
    const context = (game.sound as { context?: AudioContext }).context;
    if (context && context.state !== "running") void context.resume().catch(() => {});
    if (needsSilentLoop) startSilentLoop();
  };
  // touchend, not touchstart: iOS only lets a tap that ends start audio.
  for (const type of ["touchend", "click", "keydown"]) document.addEventListener(type, onGesture, true);
}

let silentLoop: HTMLAudioElement | null = null;

/** A tenth of a second of silence on loop: never heard, but it keeps the
 * page in media playback while the game runs. */
function startSilentLoop(): void {
  if (silentLoop) return;
  silentLoop = new Audio(URL.createObjectURL(silentWav(800)));
  silentLoop.loop = true;
  silentLoop.setAttribute("playsinline", "");
  silentLoop.play().catch(() => {
    silentLoop = null; // not allowed by this tap: the next one tries again
  });
}

/** A mono 8-bit WAV of `samples` silent samples at 8 kHz. */
function silentWav(samples: number): Blob {
  const header = new DataView(new ArrayBuffer(44));
  const text = (at: number, s: string) => [...s].forEach((c, i) => header.setUint8(at + i, c.charCodeAt(0)));
  text(0, "RIFF");
  header.setUint32(4, 36 + samples, true);
  text(8, "WAVEfmt ");
  header.setUint32(16, 16, true); // format chunk size
  header.setUint16(20, 1, true); // PCM
  header.setUint16(22, 1, true); // mono
  header.setUint32(24, 8000, true); // sample rate
  header.setUint32(28, 8000, true); // bytes per second
  header.setUint16(32, 1, true); // bytes per sample
  header.setUint16(34, 8, true); // bits per sample
  text(36, "data");
  header.setUint32(40, samples, true);
  return new Blob([header.buffer, new Uint8Array(samples).fill(128)], { type: "audio/wav" });
}

/** iPhones and iPads (iPadOS says it's a Mac, but a Mac has no touch screen). */
export function isIPhoneOrIPad(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
