import assert from 'node:assert/strict';
import { PasswordResetService } from './passwordReset';

const user = { email: 'developer@example.com', id: 'developer-id' } as any;
const validToken = {
  id: 'token-id',
  email: user.email,
  token: 'existing-valid-token',
  expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  createdAt: new Date(),
};

let createCalls = 0;
const reuseService = new PasswordResetService({
  getUserByEmail: async () => user,
  getValidPasswordResetToken: async () => validToken,
  createPasswordResetToken: async (data: any) => {
    createCalls++;
    return { ...validToken, ...data };
  },
  getPasswordResetToken: async () => undefined,
  deletePasswordResetToken: async () => {},
  updateUserPassword: async () => {},
} as any);

assert.equal(
  await reuseService.generateForcedResetToken(user.email),
  validToken.token,
);
assert.equal(createCalls, 0);

let generatedToken: any;
const freshService = new PasswordResetService({
  getUserByEmail: async () => user,
  getValidPasswordResetToken: async () => undefined,
  createPasswordResetToken: async (data: any) => {
    generatedToken = data;
    return { ...validToken, ...data };
  },
  getPasswordResetToken: async () => undefined,
  deletePasswordResetToken: async () => {},
  updateUserPassword: async () => {},
} as any);

const freshToken = await freshService.generateForcedResetToken(user.email);
assert.equal(typeof freshToken, 'string');
assert.notEqual(freshToken, validToken.token);
assert.equal(generatedToken.email, user.email);
assert.equal(generatedToken.token, freshToken);
assert.ok(generatedToken.expiresAt > new Date());

let updatedPasswordHash: string | undefined;
let deletedToken: string | undefined;
const resetService = new PasswordResetService({
  getUserByEmail: async (email: string) => email === user.email ? user : undefined,
  getValidPasswordResetToken: async () => undefined,
  createPasswordResetToken: async () => validToken,
  getPasswordResetToken: async (token: string) => token === validToken.token ? validToken : undefined,
  deletePasswordResetToken: async (token: string) => {
    deletedToken = token;
  },
  updateUserPassword: async (userId: string, passwordHash: string) => {
    assert.equal(userId, user.id);
    updatedPasswordHash = passwordHash;
  },
} as any);

assert.equal(
  await resetService.resetPassword(validToken.token, 'NewSecurePassword!'),
  user.email,
);
assert.ok(updatedPasswordHash);
assert.notEqual(updatedPasswordHash, 'NewSecurePassword!');
assert.equal(deletedToken, validToken.token);

const invalidTokenService = new PasswordResetService({
  getPasswordResetToken: async () => undefined,
  deletePasswordResetToken: async () => {},
} as any);
assert.equal(await invalidTokenService.resetPassword('expired-token', 'NewSecurePassword!'), null);

console.log('passwordReset assertions passed');