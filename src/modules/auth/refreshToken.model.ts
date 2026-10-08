import { InferSchemaType, Schema, model } from "mongoose";

// One document per refresh token ever issued. Unlike JWTs, these live in the database,
// so the server can revoke them: that's what makes logout and theft detection possible.
const refreshTokenSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Only a SHA-256 hash of the token: a database leak doesn't hand out working tokens.
    tokenHash: { type: String, required: true, unique: true },
    // All tokens created by rotating from one login share a family (= one device session).
    familyId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    // Set when the token is used (rotated) or the session is logged out.
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// TTL index: MongoDB itself deletes each document once expiresAt has passed,
// so the collection never grows forever and we need no cleanup job.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RefreshToken = InferSchemaType<typeof refreshTokenSchema>;
export const RefreshTokenModel = model("RefreshToken", refreshTokenSchema);
