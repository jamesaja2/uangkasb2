import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email dan password harus diisi");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { tenant: true },
        });

        if (!user) {
          throw new Error("Email atau password salah");
        }

        if (user.status !== "ACTIVE") {
          throw new Error(
            "Akun Anda telah dinonaktifkan. Hubungi administrator."
          );
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!isPasswordValid) {
          throw new Error("Email atau password salah");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          tenantName: user.tenant?.name || null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        if (account && account.provider === "google") {
          if (!user.email) {
            throw new Error("Email tidak terdeteksi dari akun Google");
          }

          let dbUser = await prisma.user.findUnique({
            where: { email: user.email },
            include: { tenant: true },
          });

          if (!dbUser) {
            let defaultTenant = await prisma.tenant.findFirst({
              where: { slug: "uangkasb2-default" },
            });
            if (!defaultTenant) {
              defaultTenant = await prisma.tenant.findFirst();
            }

            dbUser = await prisma.user.create({
              data: {
                email: user.email,
                name: user.name || user.email.split("@")[0],
                passwordHash: "",
                role: "MERCHANT", // Anggota / pembayar kas
                status: "ACTIVE",
                tenantId: defaultTenant?.id || null,
              },
              include: { tenant: true },
            });
          }

          if (dbUser.status !== "ACTIVE") {
            throw new Error("Akun Anda telah dinonaktifkan. Hubungi administrator.");
          }

          token.id = dbUser.id;
          token.role = dbUser.role;
          token.tenantId = dbUser.tenantId;
          token.tenantName = dbUser.tenant?.name || null;
        } else {
          token.id = user.id;
          token.role = (user as { role: string }).role;
          token.tenantId = (user as { tenantId: string | null }).tenantId;
          token.tenantName = (user as { tenantName: string | null }).tenantName;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id: string }).id = token.id as string;
        (session.user as { role: string }).role = token.role as string;
        (session.user as { tenantId: string | null }).tenantId =
          token.tenantId as string | null;
        (session.user as { tenantName: string | null }).tenantName =
          token.tenantName as string | null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
};
