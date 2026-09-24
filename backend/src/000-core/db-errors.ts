// Postgres error code for a UNIQUE constraint violation (e.g. the same email signing up twice).
const UNIQUE_VIOLATION = "23505";

export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === UNIQUE_VIOLATION
  );
}
