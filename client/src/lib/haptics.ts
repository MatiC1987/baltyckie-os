type HapticPattern = 'light' | 'medium' | 'success';

const patterns: Record<HapticPattern, number | number[]> = {
  light: 5,
  medium: 15,
  success: [5, 50, 10],
};

export function haptic(pattern: HapticPattern = 'light'): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(patterns[pattern]);
    } catch {}
  }
}
