export function haptic(pattern = 30) {
  navigator.vibrate?.(pattern);
}
