import { SignJWT, jwtVerify } from "jose";
import { randomUUID } from "crypto";

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || "fallback-secret-for-dev-only-123",
);

export async function createToken(payload: any) {
  return await new SignJWT({ ...payload, jti: randomUUID() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h") // Token berlaku 24 jam
    .sign(secret);
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (error) {
    return null;
  }
}
