/**
 * Shared server-action result shape.
 * Expected errors are RETURN VALUES (Next 16 convention), never throws.
 */
export type ActionState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "error"; message: string };

export const idleState: ActionState = { status: "idle" };
