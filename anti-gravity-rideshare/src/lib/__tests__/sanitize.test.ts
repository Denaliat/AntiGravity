/**
 * Unit tests for src/lib/sanitize.ts
 *
 * Run with: npx tsx src/lib/__tests__/sanitize.test.ts
 */

import { normalizeText, normalizeFields, normalizeStringArray } from '../sanitize';

// ─── Helpers ──────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(description: string, actual: unknown, expected: unknown) {
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);
    if (actualStr === expectedStr) {
        passed++;
        console.log(`  ✅ ${description}`);
    } else {
        failed++;
        console.error(`  ❌ ${description}`);
        console.error(`     Expected: ${expectedStr}`);
        console.error(`     Actual:   ${actualStr}`);
    }
}

// ─── normalizeText ────────────────────────────────────────────────────────────
console.log('\n── normalizeText ──');

assert('strips accents (é → e)', normalizeText('café'), 'cafe');
assert('strips tilde (ñ → n)', normalizeText('señor'), 'senor');
assert('strips multiple diacritics', normalizeText('José García'), 'Jose Garcia');
assert('trims whitespace', normalizeText('  hello  '), 'hello');
assert('collapses internal whitespace', normalizeText('hello   world'), 'hello world');
assert('handles combined scenarios', normalizeText('  café   latte  '), 'cafe latte');
assert('empty string stays empty', normalizeText(''), '');
assert('plain ASCII unchanged', normalizeText('hello world'), 'hello world');
assert('strips cedilla (ç → c)', normalizeText('façade'), 'facade');
assert('strips umlaut (ü → u)', normalizeText('über'), 'uber');
assert('strips circumflex (ê → e)', normalizeText('crêpe'), 'crepe');
assert('handles newlines as whitespace', normalizeText('line1\nline2'), 'line1 line2');
assert('handles tabs as whitespace', normalizeText('col1\tcol2'), 'col1 col2');

// ─── normalizeFields ─────────────────────────────────────────────────────────
console.log('\n── normalizeFields ──');

const obj = { name: 'José', phone: '+1234', age: 30 };
const result = normalizeFields(obj, ['name', 'phone']);
assert('normalizes listed string fields', result.name, 'Jose');
assert('leaves non-diacritic strings unchanged', result.phone, '+1234');
assert('leaves non-listed fields unchanged', result.age, 30);
assert('does not mutate original', obj.name, 'José');

const obj2 = { a: 'hello', b: 42 };
const result2 = normalizeFields(obj2, ['b' as keyof typeof obj2]);
assert('skips non-string fields gracefully', result2.b, 42);

// ─── normalizeStringArray ────────────────────────────────────────────────────
console.log('\n── normalizeStringArray ──');

const arr = ['café', 'über', 'plain'];
const normalized = normalizeStringArray(arr);
assert('normalizes all strings in array', normalized, ['cafe', 'uber', 'plain']);
assert('does not mutate original array', arr, ['café', 'über', 'plain']);
assert('handles empty array', normalizeStringArray([]), []);

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n── Results: ${passed} passed, ${failed} failed ──\n`);
process.exit(failed > 0 ? 1 : 0);
