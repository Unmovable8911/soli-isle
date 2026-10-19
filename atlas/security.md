# security

- **Purpose**: Provides the Author's credential primitives — `hashPassword` produces an argon2id digest and `verifyPassword` checks a plaintext password against a stored digest without throwing.
- **Key Files**:
  - `src/security/password-hash.ts` (argon2id hash and verify)
- **Dependencies**: none
- **Dependents**: scripts, services
- **Exposes**:
  - `hashPassword(password: string): Promise<string>` — argon2id with `memoryCost: 19456`, `timeCost: 2`, `parallelism: 1`; used by `scripts/hash-password.ts` and `scripts/reset-password.ts` to mint `AUTHOR_PASSWORD_HASH`.
  - `verifyPassword(encodedHash: string, password: string): Promise<boolean>` — the only login-time check, called from `src/services/auth.ts`; a malformed digest returns `false` instead of throwing.
  - The module imports the `argon2` package only; it reaches no repository module, so callers own policy (throttling, session issuance, env storage).
