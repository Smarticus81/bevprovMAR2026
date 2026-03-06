import { getUncachableStripeClient } from "./stripeClient";

async function seedStripeProducts() {
  const stripe = await getUncachableStripeClient();

  const plans = [
    {
      name: "BevPro Starter",
      description: "Perfect for single-venue operators getting started with voice AI.",
      metadata: {
        bevpro_plan: "starter",
        agent_limit: "2",
        venue_limit: "1",
        voice_minutes: "500",
      },
      price: 4900,
    },
    {
      name: "BevPro Pro",
      description: "For growing venues that need unlimited agents and deep integrations.",
      metadata: {
        bevpro_plan: "pro",
        agent_limit: "unlimited",
        venue_limit: "3",
        voice_minutes: "2000",
      },
      price: 14900,
    },
  ];

  for (const plan of plans) {
    const existing = await stripe.products.search({
      query: `name:'${plan.name}'`,
    });

    if (existing.data.length > 0) {
      console.log(`${plan.name} already exists (${existing.data[0].id})`);
      const prices = await stripe.prices.list({
        product: existing.data[0].id,
        active: true,
      });
      if (prices.data.length > 0) {
        console.log(`  Price: ${prices.data[0].id} ($${prices.data[0].unit_amount! / 100}/mo)`);
      }
      continue;
    }

    const product = await stripe.products.create({
      name: plan.name,
      description: plan.description,
      metadata: plan.metadata,
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.price,
      currency: "usd",
      recurring: { interval: "month" },
    });

    console.log(`Created ${plan.name}: product=${product.id}, price=${price.id}`);
  }

  console.log("Stripe product seeding complete.");
}

seedStripeProducts().catch(console.error);
