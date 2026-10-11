/**
 * Client-safe wrappers around data/birdNameAliases (CJS).
 * Next/webpack can import the CommonJS module from app code.
 */
import birdNameAliases from '../data/birdNameAliases';

const {
  BIRD_NAME_ALIASES,
  canonicalizeBirdName: canonicalize,
  aliasKeysForCanonical: aliasKeys,
} = birdNameAliases;

export { BIRD_NAME_ALIASES };

export function canonicalizeBirdName(name) {
  return canonicalize(name);
}

export function aliasKeysForCanonical(canonicalName) {
  return aliasKeys(canonicalName);
}
