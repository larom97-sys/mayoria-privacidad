// Recibe el aviso de pago de Stripe, marca la compra como pagada y concede el acceso.
// Inactiva hasta que se configuren STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET.
// Se despliega sin verificación de JWT: la autenticidad la da la firma de Stripe.
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

Deno.serve(async (req: Request) => {
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret) return new Response("payments not configured", { status: 503 });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const payload = await req.text();
  if (!(await validSignature(payload, req.headers.get("Stripe-Signature") ?? "", secret))) {
    return new Response("invalid signature", { status: 400 });
  }

  const event = JSON.parse(payload);
  if (event.type === "checkout.session.completed" && event.data.object.payment_status === "paid") {
    const s = event.data.object;
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: purchase } = await admin.from("purchases")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("stripe_session_id", s.id).select("patient_id,product_id").maybeSingle();
    if (purchase) {
      const { error } = await admin.from("accesses").upsert(
        { patient_id: purchase.patient_id, product_id: purchase.product_id, method: "purchased" },
        { onConflict: "patient_id,product_id", ignoreDuplicates: true },
      );
      if (error) return new Response("could not grant access", { status: 500 });
    }
  }
  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});
