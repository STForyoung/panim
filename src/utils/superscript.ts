const SUPERSCRIPT_DIGITS = ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"];

// Converts a verse number to raised numerals, e.g. 16 → "¹⁶"
export function toSuperscript(n: number): string {
  return String(n)
    .split("")
    .map((d) => SUPERSCRIPT_DIGITS[Number(d)] ?? d)
    .join("");
}
