"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserMenu } from "./user-menu";

export function HeaderAuth() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <Skeleton className="h-9 w-9 rounded-full" />;
  }

  if (session?.user) {
    return (
      <UserMenu
        user={{
          id: session.user.id!,
          name: session.user.name,
          email: session.user.email,
          image: session.user.image,
        }}
      />
    );
  }

  return (
    <Button variant="outline" size="sm" asChild>
      <Link href="/login">Sign in</Link>
    </Button>
  );
}
