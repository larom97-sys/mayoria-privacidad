// Crea una sesión de Stripe Checkout: pago único de un infoproducto o suscripción mensual de acceso total.
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
  const auth = req.headers.get("Authorization") ?? "";
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  let body: { kind?: string; product_id?: string; return_url?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const kind = body.kind === "subscription" ? "subscription" : "product";

  // La URL de vuelta debe pertenecer al sitio configurado (SITE_URL) o, si no hay, al origen de la petición.
  const allowedOrigin = Deno.env.get("SITE_URL") ?? req.headers.get("Origin") ?? "";
  let returnUrl: URL;
  try { returnUrl = new URL(body.return_url ?? ""); } catch { return json({ error: "bad_return_url" }, 400); }
  if (!allowedOrigin || returnUrl.origin !== new URL(allowedOrigin).origin) return json({ error: "bad_return_url" }, 400);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: patient } = await admin.from("patients").select("id").eq("user_id", user.id).maybeSingle();
  if (!patient) return json({ error: "no_patient_profile" }, 400);
  const { data: sub } = await admin.from("subscriptions").select("status,stripe_customer_id,current_period_end").eq("patient_id", patient.id).maybeSingle();

  const form = new URLSearchParams({
    success_url: returnUrl.href,
    cancel_url: returnUrl.href,
    client_reference_id: patient.id,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "eur",
    "metadata[patient_id]": patient.id,
    "metadata[kind]": kind,
  });
  if (sub?.stripe_customer_id) form.set("customer", sub.stripe_customer_id);
  else if (user.email) form.set("customer_email", user.email);

  let amount = 0, productId: string | null = null;
  if (kind === "subscription") {
    const live = sub && ["active", "trialing"].includes(sub.status) && (!sub.current_period_end || new Date(sub.current_period_end) > new Date());
    if (live) return json({ error: "already_subscribed" }, 409);
    const { data: settings } = await admin.from("settings").select("subscription_name,subscription_price_cents").single();
    amount = settings!.subscription_price_cents;
    form.set("mode", "subscription");
    form.set("line_items[0][price_data][unit_amount]", String(amount));
    form.set("line_items[0][price_data][recurring][interval]", "month");
    form.set("line_items[0][price_data][product_data][name]", settings!.subscription_name);
    form.set("subscription_data[metadata][patient_id]", patient.id);
  } else {
    const { data: product } = await admin.from("infoproducts").select("id,title,price_cents,status").eq("id", body.product_id ?? "").maybeSingle();
    if (!product || product.status !== "published" || product.price_cents <= 0) return json({ error: "product_unavailable" }, 400);
    const { data: owned } = await admin.from("accesses").select("id").eq("patient_id", patient.id).eq("product_id", product.id).maybeSingle();
    if (owned) return json({ error: "already_owned" }, 409);
    amount = product.price_cents; productId = product.id;
    form.set("mode", "payment");
    form.set("line_items[0][price_data][unit_amount]", String(amount));
    form.set("line_items[0][price_data][product_data][name]", product.title);
    form.set("metadata[product_id]", product.id);
  }

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const session = await res.json();
  if (!res.ok) return json({ error: "stripe_error", detail: session?.error?.message }, 502);

  await admin.from("purchases").insert({
    patient_id: patient.id, product_id: productId, kind, amount_cents: amount, status: "pending", stripe_session_id: session.id,
  });
  return json({ url: session.url });
});
