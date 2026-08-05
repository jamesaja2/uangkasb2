import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // 1. Create default tenant / Kelompok Uang Kas
  const tenant = await prisma.tenant.upsert({
    where: { slug: "default-tenant" },
    update: {},
    create: {
      name: "Kelompok Uang Kas Utama",
      slug: "default-tenant",
    },
  });
  console.log(`✅ Tenant created: ${tenant.name} (${tenant.id})`);

  // 2. Create Super Admin Uang Kas
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@paymentbyjames.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin@123456";
  const adminName = process.env.SEED_ADMIN_NAME || "Admin Uang Kas";

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { name: adminName },
    create: {
      email: adminEmail,
      passwordHash,
      name: adminName,
      role: "SUPERADMIN",
      status: "ACTIVE",
      tenantId: tenant.id,
    },
  });
  console.log(`✅ Admin created: ${admin.email}`);

  // 3. Create Demo Member / Pembayar Kas (menggantikan fungsi merchant lama)
  const memberEmail = "merchant@paymentbyjames.com";
  const memberHash = await bcrypt.hash("Merchant@123456", 12);

  const memberTenant = await prisma.tenant.upsert({
    where: { slug: "sample-merchant" },
    update: { name: "Anggota Kas Demo" },
    create: {
      name: "Anggota Kas Demo",
      slug: "sample-merchant",
    },
  });

  const member = await prisma.user.upsert({
    where: { email: memberEmail },
    update: { name: "Budi (Anggota Kas)" },
    create: {
      email: memberEmail,
      passwordHash: memberHash,
      name: "Budi (Anggota Kas)",
      role: "MERCHANT", // Role default pengguna agar bisa login ke dashboard
      status: "ACTIVE",
      tenantId: memberTenant.id,
    },
  });
  console.log(`✅ Demo Member created: ${member.email}`);

  // 4. Seed Default System Settings untuk Uang Kas & DOKU SNAP QRIS
  const defaultSettings = [
    { key: "uangkas_harga_dasar", value: "50000" },
    { key: "uangkas_tanggal_deadline", value: "10" },
    { key: "uangkas_denda", value: "5000" },
    { key: "doku_terminal_id", value: "A01" },
    { key: "doku_is_production", value: "false" },
  ];

  for (const s of defaultSettings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: {},
      create: {
        key: s.key,
        value: s.value,
        updatedBy: admin.id,
      },
    });
  }
  console.log("✅ Default Uang Kas & DOKU QRIS settings seeded.");

  console.log("\n🎉 Seeding complete!");
  console.log("\n📋 Login credentials:");
  console.log(`   Admin (Pengelola):  ${adminEmail} / ${adminPassword}`);
  console.log(`   Member (Pembayar):  ${memberEmail} / Merchant@123456`);
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

