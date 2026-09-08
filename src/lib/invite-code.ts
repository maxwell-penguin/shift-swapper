// Excludes visually-confusable characters (0/O, 1/I/L) since people type
// these in by hand to join a group.
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateInviteCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}
