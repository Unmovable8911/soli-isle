import bcrypt from 'bcrypt';

let hashedPassword: string | null = null;

export async function initPassword(plaintext: string): Promise<void> {
  hashedPassword = await bcrypt.hash(plaintext, 10);
}

export async function verifyPassword(plaintext: string): Promise<boolean> {
  if (!hashedPassword) throw new Error('Password not initialized');
  return bcrypt.compare(plaintext, hashedPassword);
}
