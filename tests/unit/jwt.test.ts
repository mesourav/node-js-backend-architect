import jwt from "jsonwebtoken";
import { afterEach, describe, expect, it, vi } from "vitest";
import { signAccessToken, verifyAccessToken } from "../../src/modules/auth/jwt";

// UNIT test: one function, no HTTP, no database. Fast and precise.
describe("access tokens", () => {
  const user = { id: "64b000000000000000000001", role: "customer" as const };

  afterEach(() => {
    vi.useRealTimers();
  });

  it("round-trips the user id and role", () => {
    const token = signAccessToken(user);
    expect(verifyAccessToken(token)).toEqual(user);
  });

  it("rejects a token whose payload was edited (role -> admin)", () => {
    const [header, payload, signature] = signAccessToken(user).split(".");
    const edited = JSON.parse(Buffer.from(payload, "base64url").toString()) as object;
    const forgedPayload = Buffer.from(JSON.stringify({ ...edited, role: "admin" })).toString(
      "base64url",
    );

    expect(() => verifyAccessToken(`${header}.${forgedPayload}.${signature}`)).toThrow(
      jwt.JsonWebTokenError,
    );
  });

  it("rejects a token signed with a different secret", () => {
    const token = jwt.sign({ role: "admin" }, "attacker-secret-attacker-secret-attacker", {
      subject: user.id,
      issuer: "shopapi",
    });
    expect(() => verifyAccessToken(token)).toThrow(jwt.JsonWebTokenError);
  });

  it('rejects an unsigned token ("alg: none" attack)', () => {
    function encode(obj: object) {
      return Buffer.from(JSON.stringify(obj)).toString("base64url");
    }
    const token = `${encode({ alg: "none", typ: "JWT" })}.${encode({ sub: user.id, role: "admin", iss: "shopapi" })}.`;
    expect(() => verifyAccessToken(token)).toThrow(jwt.JsonWebTokenError);
  });

  it("expires after 15 minutes", () => {
    // Fake timers let us "travel in time" instead of actually waiting 15 minutes.
    vi.useFakeTimers();
    const token = signAccessToken(user);

    vi.advanceTimersByTime(14 * 60 * 1000);
    expect(verifyAccessToken(token)).toEqual(user);

    vi.advanceTimersByTime(2 * 60 * 1000);
    expect(() => verifyAccessToken(token)).toThrow(jwt.TokenExpiredError);
  });
});
