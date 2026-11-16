// Webhook de Stripe: mantiene al día la suscripción de cada clínica.
// URL: https://<proyecto>.supabase.co/functions/v1/stripe-webhook
// Eventos a activar en Stripe: checkout.session.completed, customer.subscription.updated,
// customer.subscription.deleted e invoice.payment_failed.
// Inactivo hasta configurar STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET. Sin JWT: la autenticidad la da la firma.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function validSignature(payload: string, header: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || !parts.v1 || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${parts.t}.${payload}`)));
  if (expected.length !== parts.v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ parts.v1.charCodeAt(i);
  return diff === 0;
}

const STATUS: Record<string, string> = { active: "active", trialing: "trialing", past_due: "past_due", canceled: "canceled", unpaid: "unpaid" };

Deno.serve(async (req: Request) => {
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET"), stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!secret || !stripeKey) return new Response("payments not configured", { status: 503 });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  const payload = await req.text();
  if (!(await validSignature(payload, req.headers.get("Stripe-Signature") ?? "", secret))) return new Response("invalid signature", { status: 400 });

  const event = JSON.parse(payload), obj = event.data.object;
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: plans } = await admin.from("plans").select("*");
  const fail = (msg: string) => new Response(msg, { status: 500 });

  // Campos de la clínica a partir de una suscripción de Stripe. El plan se deduce del importe y el periodo
  // (así también se detectan los cambios hechos desde el portal de cliente); si no casa, se usa el metadato.
  // deno-lint-ignore no-explicit-any
  const fromSubscription = (s: any) => {
    const item = s.items?.data?.[0], interval = item?.price?.recurring?.interval === "year" ? "year" : "month";
    const amount = item?.price?.unit_amount;
    const plan = (plans ?? []).find((p) => (interval === "year" ? p.yearly_cents : p.monthly_cents) === amount) ?? (plans ?? []).find((p) => p.tier === s.metadata?.tier);
    const end = s.current_period_end ?? item?.current_period_end;
    return {
      stripe_customer_id: typeof s.customer === "string" ? s.customer : s.customer?.id,
      stripe_subscription_id: s.id,
      subscription_status: STATUS[s.status] ?? "unpaid",
      current_period_end: end ? new Date(end * 1000).toISOString() : null,
      cancel_at_period_end: !!s.cancel_at_period_end,
      billing_interval: interval,
      ...(plan ? { plan_tier: plan.tier, max_therapists: plan.max_therapists, max_active_patients: plan.max_active_patients } : {}),
    };
  };

  if (event.type === "checkout.session.completed" && obj.mode === "subscription" && obj.subscription) {
    const clinicId = obj.metadata?.clinic_id ?? obj.client_reference_id;
    const res = await fetch(`https://api.stripe.com/v1/subscriptions/${obj.subscription}`, { headers: { Authorization: `Bearer ${stripeKey}` } });
    if (!res.ok || !clinicId) return fail("could not load subscription");
    const { error } = await admin.from("clinics").update(fromSubscription(await res.json())).eq("id", clinicId);
    if (error) return fail("could not save subscription");
  }

  if (event.type === "customer.subscription.updated") {
    const { error } = await admin.from("clinics").update(fromSubscription(obj)).eq("stripe_subscription_id", obj.id);
    if (error) return fail("could not update subscription");
  }

  if (event.type === "customer.subscription.deleted") {
    const { error } = await admin.from("clinics").update({ subscription_status: "canceled", cancel_at_period_end: false }).eq("stripe_subscription_id", obj.id);
    if (error) return fail("could not cancel subscription");
  }

  if (event.type === "invoice.payment_failed") {
    const subId = obj.subscription ?? obj.parent?.subscription_details?.subscription;
    if (subId) await admin.from("clinics").update({ subscription_status: "past_due" }).eq("stripe_subscription_id", subId);
  }

  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});
