"use client";

import React from "react";
import { OnchainKitProvider } from "@coinbase/onchainkit";
import { baseSepolia } from "viem/chains";

export function OnchainKitClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OnchainKitProvider chain={baseSepolia}>{children}</OnchainKitProvider>
  );
}
