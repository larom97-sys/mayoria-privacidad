// Inicia la suscripción de una CLÍNICA en Stripe Checkout (los pacientes nunca pagan).
// Inactiva hasta que se configure el secreto STRIPE_SECRET_KEY en el proyecto.
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
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) return json({ error: "payments_not_configured" }, 503);

  const url = Deno.env.get("SUPABASE_URL")!;
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  let body: { tier?: string; interval?: string; return_url?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const interval = body.interval === "year" ? "year" : "month";

  // La URL de vuelta debe pertenecer al sitio configurado (SITE_URL) o, si no hay, al origen de la petición.
  const allowedOrigin = Deno.env.get("SITE_URL") ?? req.headers.get("Origin") ?? "";
  let returnUrl: URL;
  try { returnUrl = new URL(body.return_url ?? ""); } catch { return json({ error: "bad_return_url" }, 400); }
  if (!allowedOrigin || returnUrl.origin !== new URL(allowedOrigin).origin) return json({ error: "bad_return_url" }, 400);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: staff } = await admin.from("staff").select("clinic_id,role").eq("user_id", user.id).maybeSingle();
  if (!staff || staff.role !== "admin") return json({ error: "only_clinic_admin" }, 403);
  const { data: clinic } = await admin.from("clinics").select("id,name,stripe_customer_id,stripe_subscription_id,subscription_status").eq("id", staff.clinic_id).single();
  if (clinic.stripe_subscription_id && ["active", "trialing", "past_due"].includes(clinic.subscription_status)) return json({ error: "already_subscribed" }, 409);
  const { data: plan } = await admin.from("plans").select("*").eq("tier", body.tier ?? "").maybeSingle();
  if (!plan) return json({ error: "unknown_plan" }, 400);

  const meta = { clinic_id: clinic.id, tier: plan.tier, interval };
  const form = new URLSearchParams({
    mode: "subscription",
    success_url: returnUrl.href,
    cancel_url: returnUrl.href,
    client_reference_id: clinic.id,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "eur",
    "line_items[0][price_data][unit_amount]": String(interval === "year" ? plan.yearly_cents : plan.monthly_cents),
    "line_items[0][price_data][recurring][interval]": interval,
    "line_items[0][price_data][product_data][name]": `Plan ${plan.name}`,
  });
  for (const [k, v] of Object.entries(meta)) { form.set(`metadata[${k}]`, v); form.set(`subscription_data[metadata][${k}]`, v); }
  if (clinic.stripe_customer_id) form.set("customer", clinic.stripe_customer_id);
  else if (user.email) form.set("customer_email", user.email);

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const session = await res.json();
  if (!res.ok) return json({ error: "stripe_error", detail: session?.error?.message }, 502);
  return json({ url: session.url });
});
