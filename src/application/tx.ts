/**
 * PRAGMATIC DIP COMPROMISE — documented here per spec.
 *
 * The `Tx` type represents a Drizzle transaction handle. In a pure DIP world
 * the application layer would know nothing about Drizzle. However, the
 * SequencePort and IdempotencyStore MUST run inside the caller's transaction
 * (atomic sequence allocation + idempotency claim). Passing a transaction
 * handle whose type comes from Drizzle is the least-bad option.
 *
 * To minimise leakage:
 * - This file re-exports ONLY the type (type-only import — zero runtime cost).
 * - No Drizzle *values* or *functions* leak into the application layer.
 * - Ports depend on `Tx`, not on `Database` or any Drizzle builder.
 */
export type Tx = Parameters<Parameters<import("@/infrastructure/database").Database["transaction"]>[0]>[0];

export type Database = import("@/infrastructure/database").Database;
