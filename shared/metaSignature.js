const encoder = new TextEncoder();

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeTextEqual(left, right) {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

/** @param {string} rawBody @param {string} appSecret */
export async function createMetaSignature(rawBody, appSecret) {
  if (!appSecret) throw new Error("Meta app secret is required");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  return `sha256=${bytesToHex(new Uint8Array(digest))}`;
}

/** @param {string} rawBody @param {string | null} signatureHeader @param {string} appSecret */
export async function verifyMetaSignature(rawBody, signatureHeader, appSecret) {
  if (!signatureHeader || !/^sha256=[a-f0-9]{64}$/i.test(signatureHeader) || !appSecret) {
    return false;
  }
  const expected = await createMetaSignature(rawBody, appSecret);
  return constantTimeTextEqual(expected.toLowerCase(), signatureHeader.toLowerCase());
}
