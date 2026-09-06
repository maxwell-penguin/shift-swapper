"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui";

export function SignInButton() {
  return (
    <Button onClick={() => signIn("azure-ad")} className="mt-2 px-5 py-2.5">
      Sign in with Microsoft
    </Button>
  );
}
