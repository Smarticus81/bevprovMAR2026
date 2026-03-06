import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { storage } from './storage';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    try {
      const stripe = await getUncachableStripeClient();
      const event = JSON.parse(payload.toString());
      await WebhookHandlers.handleBillingEvent(event, stripe);
    } catch (err: any) {
      console.error("Post-webhook billing sync error:", err.message);
    }
  }

  static async handleBillingEvent(event: any, stripe: any): Promise<void> {
    const type = event.type;

    if (type === "checkout.session.completed") {
      const session = event.data.object;
      if (session.mode === "subscription" && session.subscription) {
        const customerId = session.customer;
        const org = await storage.getOrganizationByStripeCustomerId(customerId);
        if (org) {
          const sub = await stripe.subscriptions.retrieve(session.subscription);
          const priceId = sub.items.data[0]?.price?.id;
          let plan = "starter";
          if (priceId) {
            const price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
            const product = price.product as any;
            if (product?.metadata?.bevpro_plan) {
              plan = product.metadata.bevpro_plan;
            }
          }
          await storage.updateOrganization(org.id, {
            plan,
            stripeSubscriptionId: session.subscription,
          });
          console.log(`[Billing] Org ${org.id} upgraded to ${plan} (sub: ${session.subscription})`);
        }
      }
    }

    if (type === "customer.subscription.updated" || type === "customer.subscription.deleted") {
      const sub = event.data.object;
      const customerId = sub.customer;
      const org = await storage.getOrganizationByStripeCustomerId(customerId);
      if (!org) return;

      if (type === "customer.subscription.deleted" || sub.status === "canceled" || sub.status === "unpaid") {
        await storage.updateOrganization(org.id, {
          plan: "starter",
          stripeSubscriptionId: null as any,
        });
        console.log(`[Billing] Org ${org.id} downgraded to starter (subscription ended)`);
      } else if (sub.status === "active") {
        const priceId = sub.items.data[0]?.price?.id;
        let plan = "starter";
        if (priceId) {
          try {
            const price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
            const product = price.product as any;
            if (product?.metadata?.bevpro_plan) {
              plan = product.metadata.bevpro_plan;
            }
          } catch (e) {}
        }
        await storage.updateOrganization(org.id, {
          plan,
          stripeSubscriptionId: sub.id,
        });
        console.log(`[Billing] Org ${org.id} plan updated to ${plan}`);
      }
    }

    if (type === "invoice.payment_failed") {
      const invoice = event.data.object;
      const customerId = invoice.customer;
      const org = await storage.getOrganizationByStripeCustomerId(customerId);
      if (org) {
        console.log(`[Billing] Payment failed for org ${org.id} — subscription may be at risk`);
      }
    }
  }
}
