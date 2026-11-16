// Abre el portal de cliente de Stripe para que la clínica cambie de plan, actualice la tarjeta,
// cancele o descargue sus facturas. Solo el administrador de la clínica.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) return json({ error: "payments_not_configured" }, 503);

  const url = Deno.env.get("SUPABASE_URL")!;
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  let body: { return_url?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const allowedOrigin = Deno.env.get("SITE_URL") ?? req.headers.get("Origin") ?? "";
  let returnUrl: URL;
  try { returnUrl = new URL(body.return_url ?? ""); } catch { return json({ error: "bad_return_url" }, 400); }
  if (!allowedOrigin || returnUrl.origin !== new URL(allowedOrigin).origin) return json({ error: "bad_return_url" }, 400);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: staff } = await admin.from("staff").select("clinic_id,role").eq("user_id", user.id).maybeSingle();
  if (!staff || staff.role !== "admin") return json({ error: "only_clinic_admin" }, 403);
  const { data: clinic } = await admin.from("clinics").select("stripe_customer_id").eq("id", staff.clinic_id).single();
  if (!clinic.stripe_customer_id) return json({ error: "no_subscription" }, 404);

  const res = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ customer: clinic.stripe_customer_id, return_url: returnUrl.href }),
  });
  const session = await res.json();
  if (!res.ok) return json({ error: "stripe_error", detail: session?.error?.message }, 502);
  return json({ url: session.url });
});
