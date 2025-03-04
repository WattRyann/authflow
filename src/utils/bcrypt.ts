import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12; // Increased to 12 for better security

/**
 * Hashes a plaintext password using bcrypt.
 * @param password The plaintext password to hash
 * @returns A promise resolving to the hashed password
 * @throws Error if hashing fails
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    return await bcrypt.hash(password, SALT_ROUNDS);
  } catch (error) {
    if (isError(error)) {
      throw new Error(`Password hashing failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Compares a plaintext password with a hashed password.
 * @param password The plaintext password to compare
 * @param hash The hashed password to compare against
 * @returns A promise resolving to true if they match, false otherwise
 * @throws Error if comparison fails
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    if (isError(error)) {
      throw new Error(`Password comparison failed: ${error.message}`);
    } else {
      throw error;
    }
  }
}

/**
 * Generates a salt using the specified number of rounds.
 * @returns A promise resolving to the generated salt
 * @throws Error if salt generation fails
 */
export async function generateSalt(): Promise<string> {
  try {
    return await bcrypt.genSalt(SALT_ROUNDS);
  } catch (error) {
    if (isError(error)) {
      throw new Error(`Salt generation failed: ${error.message}`);
    } else {
      throw error;
    }
  }
}

/**
 * Extracts the salt from a bcrypt hash.
 * @param hash The hashed password containing the salt
 * @returns The extracted salt
 * @throws Error if the hash format is invalid
 */
export function extractSalt(hash: string): string {
  const parts = hash.split('$');
  if (parts.length < 4) {
    throw new Error('Invalid hash format');
  }
  return `$${parts[1]}$${parts[2]}$${parts[3].slice(0, 22)}`;
}

/**
 * Retrieves the number of rounds used in a bcrypt hash.
 * @param hash The hashed password
 * @returns The number of rounds
 * @throws Error if the hash format is invalid
 */
export function getHashRounds(hash: string): number {
  const parts = hash.split('$');
  if (parts.length < 3) {
    throw new Error('Invalid hash format');
  }
  return parseInt(parts[2], 10);
}

/**
 * Validates the strength of a password.
 * @param password The password to validate
 * @returns True if the password meets strength criteria, false otherwise
 */
export function validatePasswordStrength(password: string): boolean {
  // Requires at least 8 characters, including uppercase, lowercase, and a digit
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  return regex.test(password);
}

function isError(error: unknown): error is Error {
  return error instanceof Error;
}
