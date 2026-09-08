import { PrismaAdapter } from "@next-auth/prisma-adapter";
import EmailProvider from "next-auth/providers/email";
import type { NextAuthOptions } from "next-auth";
import { Resend } from "resend";
import { db } from "./db";

// Magic-link sign-in: no password, no OAuth app registration to manage.
//
// Env vars needed:
//   RESEND_API_KEY
//   EMAIL_FROM      (e.g. "Shift Swapper <swaps@yourdomain.com>")
//   NEXTAUTH_SECRET
//   NEXTAUTH_URL

const resend = new Resend(process.env.RESEND_API_KEY);

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  providers: [
    EmailProvider({
      from: process.env.EMAIL_FROM,
      async sendVerificationRequest({ identifier, url }) {
        await resend.emails.send({
          from: process.env.EMAIL_FROM!,
          to: identifier,
          subject: "Sign in to Shift Swapper",
          html: `
            <p>Click below to sign in to Shift Swapper:</p>
            <p><a href="${url}">Sign in</a></p>
            <p>If you didn't request this, you can ignore this email.</p>
          `,
        });
      },
    }),
  ],
  session: { strategy: "database" },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        (session.user as any).id = user.id;
        // Every page/API route reads tenant scope off these two — set here
        // once so nothing needs an extra DB round trip just to find out.
        (session.user as any).groupId = (user as any).groupId ?? null;
        (session.user as any).name = (user as any).name ?? "";
      }
      return session;
    },
  },
};
