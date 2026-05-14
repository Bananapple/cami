import { corsHeaders, jsonWithCors } from "../_shared/cors.ts";
import { esc } from "../_shared/email.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  let name: string, studio: string, city: string, message: string;
  try {
    ({ name, studio, city, message } = await req.json());
    if (!name || !studio) throw new Error("missing fields");
  } catch {
    return jsonWithCors(req, { error: "Invalid request" }, 400);
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return jsonWithCors(req, { error: "Not configured" }, 500);

  const from = Deno.env.get("FROM_EMAIL") ?? "onboarding@resend.dev";

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1a1611;">
      <h2 style="margin:0 0 16px;font-size:18px;">New demo request</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#888;width:100px;">Name</td><td style="padding:6px 0;">${esc(name)}</td></tr>
        <tr><td style="padding:6px 0;color:#888;">Studio</td><td style="padding:6px 0;">${esc(studio)}</td></tr>
        <tr><td style="padding:6px 0;color:#888;">City</td><td style="padding:6px 0;">${esc(city || "—")}</td></tr>
      </table>
      ${message ? `<p style="margin:16px 0 0;padding-top:16px;border-top:1px solid #eee;">${esc(message).replace(/\n/g, "<br>")}</p>` : ""}
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `Cami Website <${from}>`,
      to: ["nico@heycami.studio"],
      reply_to: [],
      subject: `Demo request · ${esc(name)} @ ${esc(studio)}`,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("Resend error:", body);
    return jsonWithCors(req, { error: "Failed to send" }, 500);
  }

  return jsonWithCors(req, { ok: true });
});
