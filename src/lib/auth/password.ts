import { hash, verify } from "@node-rs/argon2";

const options = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(password: string) {
  return hash(password, options);
}

export async function verifyPassword(password: string, passwordHash: string) {
  try {
    return await verify(passwordHash, password, options);
  } catch {
    return false;
  }
}
