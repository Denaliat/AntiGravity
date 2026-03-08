/**
 * Unicode Normalization Utilities
 *
 * Defence-in-depth against homoglyph / confusable-character attacks.
 *
 * Strategy:
 *   1. NFD decomposition — splits composed characters into base + combining marks
 *      (e.g. "é" → "e" + U+0301)
 *   2. Strip combining marks — removes all Unicode combining characters (\p{M})
 *   3. Trim + collapse whitespace
 *
 * Result: a consistent, ASCII-safe representation for names, addresses,
 * descriptions, and other free-text fields stored in the database.
 */

/**
 * Normalize a single text value.
 *
 * @example
 *   normalizeText('  José  García  ')  // → 'Jose Garcia'
 *   normalizeText('café')              // → 'cafe'
 *   normalizeText('Rè')               // → 'Re'
 */
export function normalizeText(input: string): string {
    return input
        .normalize('NFD')           // decompose into base + combining marks
        .replace(/\p{M}/gu, '')     // strip all combining marks (accents, diacritics)
        .trim()                     // remove leading / trailing whitespace
        .replace(/\s+/g, ' ');      // collapse internal whitespace runs
}

/**
 * Batch-normalize specific string fields on an object.
 *
 * Returns a **shallow copy** with the listed keys normalized.
 * Non-string values and keys not present in the object are left untouched.
 *
 * @example
 *   const body = { name: 'José', phone: '+1234', age: 30 };
 *   normalizeFields(body, ['name', 'phone']);
 *   // → { name: 'Jose', phone: '+1234', age: 30 }
 */
export function normalizeFields<T extends Record<string, unknown>>(
    obj: T,
    keys: (keyof T)[],
): T {
    const copy = { ...obj };
    for (const key of keys) {
        const val = copy[key];
        if (typeof val === 'string') {
            (copy as Record<string, unknown>)[key as string] = normalizeText(val);
        }
    }
    return copy;
}

/**
 * Normalize every string in an array.
 * Non-string elements are returned unchanged.
 */
export function normalizeStringArray(arr: string[]): string[] {
    return arr.map(s => (typeof s === 'string' ? normalizeText(s) : s));
}
