/**
 * Decoding for Java-serialized (java.io.Serializable) Redis values.
 *
 * Some values in this app are written by Java services using native object
 * serialization rather than JSON (e.g. `pegaCache_*` holds an ArrayList of
 * GetNbaResponseDto). Those bytes are binary and render as garbage in the GUI,
 * so we decode them server-side into plain JSON-safe data.
 *
 * This is a one-way, read-only decode. We never re-encode JSON back into the
 * Java format — writing a key whose stored bytes are Java-serialized would
 * corrupt it for the Java consumers (see the guard in app/api/redis/set).
 *
 * Note: `java-deserialization` is a *format parser* — it walks the byte stream
 * and never instantiates classes or invokes readObject(), so the classic Java
 * deserialization gadget-chain RCE does not apply. The residual risks are
 * parser errors and oversized payloads, handled by the try/catch and size cap.
 */

/** STREAM_MAGIC (0xACED) + STREAM_VERSION (0x0005) begin every Java stream. */
const JAVA_STREAM_MAGIC = [0xac, 0xed, 0x00, 0x05]

/** Base64 of the magic — some producers store the stream base64-encoded. */
const JAVA_BASE64_PREFIX = "rO0AB"

/** Refuse to decode absurdly large blobs (parser is recursive). */
const MAX_DECODE_BYTES = 8 * 1024 * 1024

/** Guard against pathological nesting while walking the object graph. */
const MAX_DEPTH = 64

export type JavaDecodeResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string }

/** True if the buffer starts with the Java serialization stream header. */
export function looksLikeJavaSerialized(buf: Buffer): boolean {
  if (buf.length < JAVA_STREAM_MAGIC.length) return false
  return JAVA_STREAM_MAGIC.every((byte, i) => buf[i] === byte)
}

/**
 * True if the text is a base64-encoded Java stream. Producers that store
 * through a String-typed template sometimes base64 the bytes first.
 */
export function looksLikeBase64Java(text: string): boolean {
  return text.startsWith(JAVA_BASE64_PREFIX)
}

/**
 * Decode Java-serialized bytes into JSON-safe data.
 * Never throws — parse failures come back as { ok: false }.
 */
export async function decodeJavaValue(buf: Buffer): Promise<JavaDecodeResult> {
  if (buf.length > MAX_DECODE_BYTES) {
    return {
      ok: false,
      error: `Value is too large to decode (${buf.length} bytes, limit ${MAX_DECODE_BYTES})`,
    }
  }

  try {
    // Dynamic import: the package is CommonJS with no bundled types, and this
    // matches how lib/redis-client.ts loads ioredis.
    const mod = await import("java-deserialization")
    const javaDeserialization = ((mod as unknown as { default?: unknown }).default ??
      mod) as { parse: (b: Buffer) => unknown[] }
    const parsed = javaDeserialization.parse(buf)

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return { ok: false, error: "No objects found in Java stream" }
    }

    // parse() returns every top-level object in the stream. A single stored
    // value is normally one object — unwrap it rather than shipping a
    // 1-element array to the viewer.
    const root = parsed.length === 1 ? parsed[0] : parsed
    return { ok: true, value: normalizeJavaObject(root) }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to parse Java-serialized value",
    }
  }
}

/** Boxed primitives carry their payload in a `value` field; unwrap them. */
const BOXED_PRIMITIVES = new Set([
  "java.lang.Integer",
  "java.lang.Long",
  "java.lang.Short",
  "java.lang.Byte",
  "java.lang.Double",
  "java.lang.Float",
  "java.lang.Boolean",
  "java.lang.Character",
  "java.math.BigInteger",
  "java.math.BigDecimal",
])

/** Collection types whose useful payload the parser hoists into `list`. */
const LIST_CLASSES = new Set(["java.util.ArrayList", "java.util.ArrayDeque"])

interface JavaObjectLike {
  class?: { name?: string }
  [key: string]: unknown
}

function getClassName(value: JavaObjectLike): string | undefined {
  return value?.class?.name
}

/** long.js instances expose low/high bits rather than a usable number. */
function isLongInstance(value: unknown): boolean {
  const candidate = value as { low?: unknown; high?: unknown; toNumber?: unknown }
  return (
    typeof candidate?.low === "number" &&
    typeof candidate?.high === "number" &&
    typeof candidate?.toNumber === "function"
  )
}

/**
 * Convert a long to a number, falling back to a string beyond the safe integer
 * range so large IDs and timestamps keep their exact value.
 */
function normalizeLong(value: {
  toNumber: () => number
  toString: () => string
}): number | string {
  const asNumber = value.toNumber()
  return Number.isSafeInteger(asNumber) ? asNumber : value.toString()
}

/**
 * Walk a parsed Java object graph and produce plain JSON-serializable data.
 *
 * Handles the things that would otherwise render as garbage or crash
 * JSON.stringify: boxed primitives, longs, Map/Set, hoisted collections, and
 * circular references (Java streams use back-references freely).
 */
export function normalizeJavaObject(input: unknown): unknown {
  return walk(input, new WeakSet<object>(), 0)
}

function walk(value: unknown, seen: WeakSet<object>, depth: number): unknown {
  if (value === null || value === undefined) return null

  const primitive = typeof value
  if (primitive === "string" || primitive === "boolean") return value
  if (primitive === "number") {
    // JSON has no NaN/Infinity — represent them as strings rather than null.
    return Number.isFinite(value as number) ? value : String(value)
  }
  if (primitive === "bigint") {
    const asBigInt = value as bigint
    return asBigInt >= BigInt(Number.MIN_SAFE_INTEGER) &&
      asBigInt <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(asBigInt)
      : asBigInt.toString()
  }
  if (primitive === "function") return undefined
  if (primitive !== "object") return String(value)

  if (depth > MAX_DEPTH) return "[Max depth exceeded]"

  const asObject = value as object

  // Java streams reference earlier objects by handle, so graphs can be cyclic.
  // JSON.stringify throws on those; emit a marker instead.
  if (seen.has(asObject)) return "[Circular]"
  seen.add(asObject)

  try {
    if (isLongInstance(value)) {
      return normalizeLong(value as { toNumber: () => number; toString: () => string })
    }

    if (Buffer.isBuffer(value)) {
      return { __type: "bytes", length: value.length, base64: value.toString("base64") }
    }

    if (value instanceof Date) return value.toISOString()

    if (value instanceof Map) {
      const result: Record<string, unknown> = {}
      for (const [mapKey, mapValue] of value) {
        result[String(walk(mapKey, seen, depth + 1))] = walk(mapValue, seen, depth + 1)
      }
      return result
    }

    if (value instanceof Set) {
      return Array.from(value, (item) => walk(item, seen, depth + 1))
    }

    if (Array.isArray(value)) {
      return value.map((item) => walk(item, seen, depth + 1))
    }

    const javaObject = value as JavaObjectLike
    const className = getClassName(javaObject)

    // Integer/Long/... serialize as { value: N }; surface the number itself.
    if (className && BOXED_PRIMITIVES.has(className) && "value" in javaObject) {
      return walk(javaObject.value, seen, depth + 1)
    }

    // ArrayList/ArrayDeque hold their elements in `list`; `{list:[...]}` is noise.
    if (className && LIST_CLASSES.has(className) && Array.isArray(javaObject.list)) {
      return javaObject.list.map((item) => walk(item, seen, depth + 1))
    }

    // HashMap/Hashtable/EnumMap expose an ES Map in `map`.
    if (javaObject.map instanceof Map) {
      return walk(javaObject.map, seen, depth + 1)
    }

    // HashSet exposes an ES Set in `set`.
    if (javaObject.set instanceof Set) {
      return walk(javaObject.set, seen, depth + 1)
    }

    // Plain DTO: copy its declared fields. `class`/`extends` are
    // non-enumerable so they are skipped automatically; `@` holds raw
    // custom-serialization blocks that would only add noise.
    const result: Record<string, unknown> = {}
    for (const [fieldName, fieldValue] of Object.entries(javaObject)) {
      if (fieldName === "@") continue
      const normalized = walk(fieldValue, seen, depth + 1)
      if (normalized !== undefined) result[fieldName] = normalized
    }
    return result
  } finally {
    // Only guard against true ancestor cycles — a node repeated in sibling
    // branches should still render in full.
    seen.delete(asObject)
  }
}
