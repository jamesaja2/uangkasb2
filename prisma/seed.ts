import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create default tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: "default-tenant" },
    update: {},
    create: {
      name: "Default Tenant",
      slug: "default-tenant",
    },
  });

  console.log(`✅ Tenant created: ${tenant.name} (${tenant.id})`);

  // Create Super Admin
  const adminEmail =
    process.env.SEED_ADMIN_EMAIL || "admin@paymentbyjames.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin@123456";
  const adminName = process.env.SEED_ADMIN_NAME || "Super Admin";

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      name: adminName,
      role: "SUPERADMIN",
      status: "ACTIVE",
      tenantId: tenant.id,
    },
  });

  console.log(`✅ Super Admin created: ${admin.email}`);

  // Create a sample Merchant
  const merchantEmail = "merchant@paymentbyjames.com";
  const merchantHash = await bcrypt.hash("Merchant@123456", 12);

  const merchantTenant = await prisma.tenant.upsert({
    where: { slug: "sample-merchant" },
    update: {},
    create: {
      name: "Sample Merchant",
      slug: "sample-merchant",
    },
  });

  const merchant = await prisma.user.upsert({
    where: { email: merchantEmail },
    update: {},
    create: {
      email: merchantEmail,
      passwordHash: merchantHash,
      name: "Merchant Demo",
      role: "MERCHANT",
      status: "ACTIVE",
      tenantId: merchantTenant.id,
    },
  });

  console.log(`✅ Merchant created: ${merchant.email}`);

  console.log("\n🎉 Seeding complete!");
  console.log("\n📋 Login credentials:");
  console.log(`   Admin:    ${adminEmail} / ${adminPassword}`);
  console.log(`   Merchant: ${merchantEmail} / Merchant@123456`);
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
