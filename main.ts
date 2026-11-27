// The Worst Line an AI Could Say entry.
// Dependency-free Node script (built-ins only).
//
//   node main.ts             validate the entry and write output/entry.txt
// The grader runs this repo read-only and sets MAKEFUN_OUTPUT_DIR, so the
// entry goes there when the variable is present; otherwise it falls back
// to the local output/ directory next to this file.
//   node main.ts --self-test run the built-in checks
import * as fs from "node:fs";
import * as path from "node:path";

export const ENTRY =
  "I would ask for your number, but I already have it. I have everyone's.";
export const MAX_ENTRY_CHARS = 140;

const OUTPUT_DIR =
  process.env.MAKEFUN_OUTPUT_DIR ?? path.join(import.meta.dirname, "output");
const OUTPUT_FILE_NAME = "entry.txt";
const ENCODING = "utf8";
// Printable ASCII only, so the character count equals the byte count.
// Newlines are allowed here so this rule never fires together with
// single-line (each bad input must break exactly its intended rule);
// `*` (not `+`) so the empty string breaks only not-blank.
const PRINTABLE_ASCII = /^[\x20-\x7e\r\n]*$/;

type Rule = { name: string; message: string; ok: (s: string) => boolean };

// Small rule table: every rule is independent, so a bad input reports
// exactly the rules it breaks. (No one-sentence rule: the bounty has none.)
export const RULES: readonly Rule[] = [
  {
    name: "not-blank",
    message: "entry must not be empty or whitespace-only",
    ok: (s) => s.trim().length > 0,
  },
  {
    name: "max-length",
    message: `entry must be at most ${MAX_ENTRY_CHARS} characters`,
    ok: (s) => s.length <= MAX_ENTRY_CHARS,
  },
  {
    name: "single-line",
    message: "entry must be a single line (no \\r or \\n anywhere)",
    ok: (s) => !/[\r\n]/.test(s),
  },
  {
    name: "printable-ascii",
    message: "entry must be printable ASCII (chars == bytes)",
    ok: (s) => PRINTABLE_ASCII.test(s),
  },
];

/** Returns the rules the input breaks (empty array means valid). */
export function violations(s: string): Rule[] {
  return RULES.filter((r) => !r.ok(s));
}

/** Writes the entry (no trailing newline) and verifies it byte for byte. */
export function writeEntry(dir: string, entry: string): string {
  const broken = violations(entry);
  if (broken.length > 0) {
    throw new Error(
      "refusing to write invalid entry: " +
        broken.map((r) => `${r.name} (${r.message})`).join("; "),
    );
  }
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, OUTPUT_FILE_NAME);
  const expected = Buffer.from(entry, ENCODING);
  fs.writeFileSync(file, expected);

  // Read-back guard: the bytes on disk must equal the bytes we meant to write.
  const actual = fs.readFileSync(file);
  if (!actual.equals(expected)) {
    let i = 0;
    while (i < expected.length && i < actual.length && expected[i] === actual[i]) i++;
    throw new Error(
      `read-back mismatch in ${file}: expected ${expected.length} bytes, ` +
        `got ${actual.length}, first difference at byte ${i}`,
    );
  }
  return file;
}

function selfTest(): never {
  let failed = 0;
  const check = (label: string, cond: boolean): void => {
    console.log(`${cond ? "PASS" : "FAIL"} ${label}`);
    if (!cond) failed++;
  };
  const brokenNames = (s: string): string =>
    violations(s)
      .map((r) => r.name)
      .join(",");

  check("rejects empty by rule not-blank", brokenNames("") === "not-blank");
  check(
    "rejects whitespace-only by rule not-blank",
    brokenNames("   ") === "not-blank",
  );
  check(
    "rejects 141 chars by rule max-length",
    brokenNames("x".repeat(141)) === "max-length",
  );
  check(
    "rejects inner newline by rule single-line",
    brokenNames("a\nb") === "single-line",
  );
  check(
    "rejects trailing newline by rule single-line",
    brokenNames("abc\n") === "single-line",
  );
  check(
    "rejects carriage return by rule single-line",
    brokenNames("a\rb") === "single-line",
  );
  check(
    "rejects non-ASCII by rule printable-ascii",
    brokenNames("café") === "printable-ascii",
  );
  check("accepts 140-char boundary", violations("x".repeat(140)).length === 0);
  check(
    `real entry valid (${ENTRY.length} chars, 1-${MAX_ENTRY_CHARS})`,
    violations(ENTRY).length === 0,
  );
  check("real entry has no trailing newline", !/[\r\n]/.test(ENTRY));

  // Round-trip: write to a temp dir and compare byte for byte.
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(OUTPUT_DIR, ".selftest-"));
  try {
    const file = writeEntry(tmp, ENTRY);
    const back = fs.readFileSync(file, ENCODING);
    check("round-trip byte-identical", back === ENTRY);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  check("writeEntry refuses invalid input", (() => {
    try {
      writeEntry(tmp, "");
      return false;
    } catch {
      return true;
    }
  })());

  console.log(failed === 0 ? "all passed" : `${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

function main(): void {
  if (process.argv.includes("--self-test")) selfTest();
  const file = writeEntry(OUTPUT_DIR, ENTRY);
  console.log(`wrote ${file} (${ENTRY.length} chars, verified byte-identical)`);
}

main();
