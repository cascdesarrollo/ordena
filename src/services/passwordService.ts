import * as Crypto from 'expo-crypto';
import { getParametro, updateParametroValor } from '../repositories/parametrosRepository';

export const SPECIAL_PASSWORD_CODE = 'SPECIAL_PASSWORD';

// Formato almacenado: sha256$<salt hex>$<hash hex>
const HASH_PREFIX = 'sha256$';

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

const digest = (salt: string, password: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}${password}`);

export const isPasswordHashed = (valor: string) => valor.startsWith(HASH_PREFIX);

const hashPassword = async (password: string) => {
  const salt = toHex(Crypto.getRandomBytes(16));
  const hash = await digest(salt, password);
  return `${HASH_PREFIX}${salt}$${hash}`;
};

const matches = async (stored: string, password: string) => {
  if (!isPasswordHashed(stored)) return stored === password;
  const [, salt, hash] = stored.split('$');
  return (await digest(salt, password)) === hash;
};

export const isSpecialPasswordSet = async () => {
  const parametro = await getParametro(SPECIAL_PASSWORD_CODE);
  return !!parametro?.valor;
};

// Sin clave configurada las operaciones especiales quedan bloqueadas.
export const verifySpecialPassword = async (password: string) => {
  const parametro = await getParametro(SPECIAL_PASSWORD_CODE);
  const stored = parametro?.valor ?? '';
  if (!stored) return false;
  return matches(stored, password.trim());
};

// Vacío desactiva las operaciones especiales.
export const setSpecialPassword = async (password: string) => {
  const plain = password.trim();
  await updateParametroValor(SPECIAL_PASSWORD_CODE, plain ? await hashPassword(plain) : '');
};

// Convierte una clave guardada en texto plano (versiones anteriores) a hash.
export const migrateSpecialPassword = async () => {
  const parametro = await getParametro(SPECIAL_PASSWORD_CODE);
  const stored = parametro?.valor ?? '';
  if (stored && !isPasswordHashed(stored)) {
    await setSpecialPassword(stored);
  }
};
