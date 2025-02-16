export async function validateWebhookSignature(
  signature: unknown,
  rawBody: string,
  hmacKey: string
): Promise<void> {
  if (!signature || typeof signature !== "string") {
    throw new Error("Missing 'X-ToDesktop-HMAC-SHA256' signature header");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(hmacKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const hash = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody)
  );
  const derivedSignature = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (signature === derivedSignature) {
    console.log("Signature is valid");
  } else {
    throw new Error("Invalid 'X-ToDesktop-HMAC-SHA256' signature");
  }
}
