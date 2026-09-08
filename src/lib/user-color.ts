// One color per person, stable across reloads and pages — hashed from the
// user id rather than assignment order, so it never shifts as the roster
// changes. Hues are the validated categorical set (CVD-safe, ordered so
// adjacent hues stay distinguishable); with ~20 people some hues repeat, so
// initials (not color alone) still carry identity.
const CATEGORICAL = [
  { hex: "#2a78d6", text: "#ffffff" }, // blue
  { hex: "#eb6834", text: "#ffffff" }, // orange
  { hex: "#1baf7a", text: "#ffffff" }, // aqua
  { hex: "#eda100", text: "#1c1400" }, // yellow
  { hex: "#e87ba4", text: "#3a0416" }, // magenta
  { hex: "#008300", text: "#ffffff" }, // green
  { hex: "#4a3aa7", text: "#ffffff" }, // violet
  { hex: "#e34948", text: "#ffffff" }, // red
] as const;

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function colorForUser(userId: string) {
  return CATEGORICAL[hashString(userId) % CATEGORICAL.length];
}

export function initialsFor(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
