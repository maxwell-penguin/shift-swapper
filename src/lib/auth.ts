import { PrismaAdapter } from "@next-auth/prisma-adapter";
import AzureADProvider from "next-auth/providers/azure-ad";
import type { NextAuthOptions } from "next-auth";
import { db } from "./db";

// Requires an Azure AD app registration (any of you can create one under
// your own free Azure account — this does NOT need your residence's tenant
// admin, since it's just standard delegated "sign in" access, not Shifts/Graph data).
//
// Env vars needed:
//   AZURE_AD_CLIENT_ID
//   AZURE_AD_CLIENT_SECRET
//   AZURE_AD_TENANT_ID   (use "common" to allow any Microsoft account to sign in)
//   NEXTAUTH_SECRET
//   NEXTAUTH_URL

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID ?? "common",
    }),
  ],
  session: { strategy: "database" },
  callbacks: {
    async session({ session, user }) {
      if (session.user) (session.user as any).id = user.id;
      return session;
    },
  },
};
