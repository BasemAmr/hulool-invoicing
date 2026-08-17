import type { Clock } from "@/application/ports/clock";

/** Production clock — returns the real current time. */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
