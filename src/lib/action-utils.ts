import { z } from "zod";
import { assertWritable, PermissionError, requireActionUser } from "@/lib/permissions";

export type Failure = { ok: false; error: string };
export type Result<T = object> = ({ ok: true } & T) | Failure;

export async function run<T extends object>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, ...(await fn()) };
  } catch (e) {
    if (e instanceof PermissionError || e instanceof z.ZodError) {
      return {
        ok: false,
        error: e instanceof z.ZodError ? (e.issues[0]?.message ?? "Données invalides.") : e.message,
      };
    }
    console.error(e);
    return { ok: false, error: "Une erreur inattendue est survenue." };
  }
}

export async function requireWriter() {
  const data = await requireActionUser();
  await assertWritable();
  return data.user;
}
