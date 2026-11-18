export interface PasswordStrength {
  bits: number;
  label: 'weak' | 'fair' | 'strong';
}

const COMMON = new Set([
  'password', 'password1', '123456', '12345678', '123456789', '1234567890',
  'qwerty', 'qwerty123', 'abc123', 'letmein', 'iloveyou', 'admin', 'welcome',
  'monkey', 'dragon', '111111', '000000', '123123', '1q2w3e4r', 'asdfgh',
]);

/** Lightweight entropy estimate (bits) — dependency-free. */
export function passwordStrength(pw: string): PasswordStrength {
  if (!pw) return { bits: 0, label: 'weak' };

  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/[0-9]/.test(pw)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(pw)) pool += 33;

  let bits = pw.length * Math.log2(pool || 1);

  // Penalties for predictable patterns.
  if (pool <= 26) bits *= 0.7; // single character class
  if (/^(.)\1+$/.test(pw)) bits *= 0.3; // one repeated character
  if (/^(0123|1234|abcd|qwerty|asdf)/i.test(pw)) bits *= 0.5; // obvious sequence
  if (COMMON.has(pw.toLowerCase())) bits = Math.min(bits, 8);

  bits = Math.min(Math.round(bits), 200);

  const label: PasswordStrength['label'] = bits < 40 ? 'weak' : bits < 60 ? 'fair' : 'strong';
  return { bits, label };
}

/** Minimum entropy required to create/change a vault password. */
export const MIN_PASSWORD_BITS = 40;
