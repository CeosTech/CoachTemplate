import jwt from "jsonwebtoken";

export type JwtPayload = { sub: string; role: "COACH" | "MEMBER" };

export function signAccessToken(payload: JwtPayload, secret: string, expiresIn: string) {
  return jwt.sign(payload, secret, { expiresIn });
}

export function verifyAccessToken(token: string, secret: string) {
  return jwt.verify(token, secret) as JwtPayload;
}
