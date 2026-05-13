import { corsHeaders } from "./cors.ts";

function json(req: Request, body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

/**
 * Cross-tenant guard: verifies the x-studio-slug request header resolves to the
 * same studio_id that was derived from the requested resource (booking, membership,
 * class instance, etc.). Prevents stale-tab attribution bugs where a resource from
 * studio B is operated on while the client thinks it's on studio A.
 *
 * Returns a 400/403 Response on failure, or null on success.
 */
export async function validateStudioMatch(
  req: Request,
  client: any,
  studioId: string,
): Promise<Response | null> {
  const slugHeader = req.headers.get("x-studio-slug")?.trim();
  if (!slugHeader) {
    return json(req, { error: "x-studio-slug header is required" }, 400);
  }
  const { data: hdrStudio } = await client
    .from("studios")
    .select("id")
    .eq("slug", slugHeader)
    .maybeSingle();
  if (!hdrStudio || hdrStudio.id !== studioId) {
    return json(req, { error: "This item belongs to a different studio. Reload the page and try again." }, 403);
  }
  return null;
}
