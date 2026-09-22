import { describe, expect, it } from 'vitest';
import { createSessionToken, isHostPassword, isValidSessionToken } from './auth';

describe('sesión de anfitrión', () => {
  it('acepta su propio token y rechaza los manipulados', () => {
    const token = createSessionToken();
    expect(isValidSessionToken(token)).toBe(true);
    expect(isValidSessionToken(token + 'x')).toBe(false);
    expect(isValidSessionToken(token.replace(/^./, 'A'))).toBe(false);
    expect(isValidSessionToken('cualquier.cosa')).toBe(false);
    expect(isValidSessionToken(undefined)).toBe(false);
  });

  it('rechaza un token vencido', () => {
    const payload = Buffer.from(JSON.stringify({ exp: Date.now() - 1000 })).toString('base64url');
    expect(isValidSessionToken(`${payload}.firmafalsa`)).toBe(false);
  });

  it('compara la clave del anfitrión', () => {
    expect(isHostPassword('anfitrion')).toBe(true);
    expect(isHostPassword('otra')).toBe(false);
    expect(isHostPassword('')).toBe(false);
  });
});
