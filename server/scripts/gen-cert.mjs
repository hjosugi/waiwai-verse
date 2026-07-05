// Generate a self-signed ECDSA P-256 certificate for WebTransport.
//
// WebTransport's serverCertificateHashes requires:
//   - ECDSA (P-256)
//   - validity period <= ~14 days
//   - self-signed
// So re-run this script when the cert expires (every 10 days here).
//
// Outputs:
//   certs/cert.pem       server certificate (PEM)
//   certs/key.pem        private key (PKCS8 PEM)
//   certs/cert-hash.json sha-256 of the DER cert, base64 (for the client)

import { writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { Crypto } from "@peculiar/webcrypto";
import * as x509 from "@peculiar/x509";

const crypto = new Crypto();
x509.cryptoProvider.set(crypto);

const alg = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" };
const keys = await crypto.subtle.generateKey(alg, true, ["sign", "verify"]);

const now = Date.now();
const TEN_DAYS = 10 * 24 * 3600 * 1000;

const cert = await x509.X509CertificateGenerator.createSelfSigned({
  serialNumber: "01",
  name: "CN=localhost",
  notBefore: new Date(now - 60_000),
  notAfter: new Date(now + TEN_DAYS),
  keys,
  signingAlgorithm: alg,
  extensions: [
    new x509.BasicConstraintsExtension(false, undefined, true),
    new x509.KeyUsagesExtension(
      x509.KeyUsageFlags.digitalSignature | x509.KeyUsageFlags.keyEncipherment,
      true,
    ),
    new x509.SubjectAlternativeNameExtension([
      { type: "dns", value: "localhost" },
      { type: "ip", value: "127.0.0.1" },
    ]),
  ],
});

const certPem = cert.toString("pem");
const pkcs8 = await crypto.subtle.exportKey("pkcs8", keys.privateKey);
const keyPem = toPem(Buffer.from(pkcs8), "PRIVATE KEY");

const der = Buffer.from(cert.rawData);
const hashB64 = createHash("sha256").update(der).digest("base64");

const dir = new URL("../certs/", import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(new URL("cert.pem", dir), certPem);
writeFileSync(new URL("key.pem", dir), keyPem);
writeFileSync(
  new URL("cert-hash.json", dir),
  JSON.stringify(
    { algorithm: "sha-256", valueBase64: hashB64, expiresAt: new Date(now + TEN_DAYS).toISOString() },
    null,
    2,
  ),
);

console.log("cert generated.");
console.log("sha-256(DER) base64:", hashB64);
console.log("expires:", new Date(now + TEN_DAYS).toISOString());

function toPem(buf, label) {
  const b64 = buf.toString("base64").replace(/(.{64})/g, "$1\n");
  return `-----BEGIN ${label}-----\n${b64}\n-----END ${label}-----\n`;
}
