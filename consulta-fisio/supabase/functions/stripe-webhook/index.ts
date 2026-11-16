// Recibe los avisos de Stripe y mantiene al día compras, accesos y suscripciones.
// Inactiva hasta que se configuren STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET.
// Se despliega sin verificación de JWT: la autenticidad la da la firma de Stripe.
// Eventos que hay que activar en Stripe: checkout.session.completed, customer.subscription.updated,
// customer.subscription.deleted e invoice.paid.
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

const KNOWN = ["active", "trialing", "past_due", "canceled", "incomplete", "unpaid"];
// deno-lint-ignore no-explicit-any
const subFields = (s: any) => {
  const end = s.current_period_end ?? s.items?.data?.[0]?.current_period_end;
  return {
    status: KNOWN.includes(s.status) ? s.status : "canceled",
    stripe_customer_id: typeof s.customer === "string" ? s.customer : s.customer?.id,
    stripe_subscription_id: s.id,
    current_period_end: end ? new Date(end * 1000).toISOString() : null,
    cancel_at_period_end: !!s.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  };
};

Deno.serve(async (req: Request) => {
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET"), stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!secret || !stripeKey) return new Response("payments not configured", { status: 503 });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const payload = await req.text();
  if (!(await validSignature(payload, req.headers.get("Stripe-Signature") ?? "", secret))) {
    return new Response("invalid signature", { status: 400 });
  }

  const event = JSON.parse(payload), obj = event.data.object;
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const fail = (msg: string) => new Response(msg, { status: 500 });

  if (event.type === "checkout.session.completed") {
    if (obj.mode === "payment" && obj.payment_status === "paid") {
      const { data: purchase } = await admin.from("purchases").update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("stripe_session_id", obj.id).select("patient_id,product_id").maybeSingle();
      if (purchase?.product_id) {
        const { error } = await admin.from("accesses").upsert(
          { patient_id: purchase.patient_id, product_id: purchase.product_id, method: "purchased" },
          { onConflict: "patient_id,product_id", ignoreDuplicates: true });
        if (error) return fail("could not grant access");
      }
    }
    if (obj.mode === "subscription" && obj.subscription) {
      const patientId = obj.metadata?.patient_id ?? obj.client_reference_id;
      const res = await fetch(`https://api.stripe.com/v1/subscriptions/${obj.subscription}`, { headers: { Authorization: `Bearer ${stripeKey}` } });
      if (!res.ok || !patientId) return fail("could not load subscription");
      const { error } = await admin.from("subscriptions").upsert({ patient_id: patientId, ...subFields(await res.json()) }, { onConflict: "patient_id" });
      if (error) return fail("could not save subscription");
      await admin.from("purchases").update({ status: "paid", paid_at: new Date().toISOString() }).eq("stripe_session_id", obj.id);
    }
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const fields = subFields(obj);
    if (event.type === "customer.subscription.deleted") fields.status = "canceled";
    const { error } = await admin.from("subscriptions").update(fields).eq("stripe_subscription_id", obj.id);
    if (error) return fail("could not update subscription");
  }

  // Renovaciones mensuales: se anotan como ingreso (la primera cuota ya consta por la sesión de pago).
  if (event.type === "invoice.paid" && obj.billing_reason === "subscription_cycle") {
    const subId = obj.subscription ?? obj.parent?.subscription_details?.subscription;
    const { data: sub } = await admin.from("subscriptions").select("patient_id").eq("stripe_subscription_id", subId ?? "").maybeSingle();
    if (sub) await admin.from("purchases").insert({ patient_id: sub.patient_id, kind: "subscription", amount_cents: obj.amount_paid, status: "paid", paid_at: new Date().toISOString() });
  }

  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});
