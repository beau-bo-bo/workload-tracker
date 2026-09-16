import { SignJWT, jwtVerify } from "jose";

export type Role = "admin" | "owner" | "inspector";

export type SessionUser = {
  id: string;
  username: string;
  displayName: string;
  roles: Role[];
};

export const COOKIE_NAME = "session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Missing SESSION_SECRET environment variable");
  return new TextEncoder().encode(secret);
}

export async function signSession(user: SessionUser) {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return {
      id: payload.id as string,
      username: payload.username as string,
      displayName: payload.displayName as string,
      roles: payload.roles as Role[],
    };
  } catch {
    return null;
  }
}
