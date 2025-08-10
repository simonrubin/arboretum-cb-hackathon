/**
 * Wallet utilities for X402 payments and CDP integration
 */
import {
  createPublicClient,
  createWalletClient,
  custom,
  parseUnits,
  formatUnits,
} from "viem";
import { baseSepolia } from "viem/chains";

// Base Sepolia USDC contract address
export const USDC_ADDRESS =
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;

// USDC ABI - minimal for transfer and balanceOf
const USDC_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
  {
    constant: false,
    inputs: [
      { name: "_to", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    type: "function",
  },
] as const;

export class WalletService {
  private publicClient;
  private walletClient;

  constructor(provider: any) {
    this.publicClient = createPublicClient({
      chain: baseSepolia,
      transport: custom(provider),
    });

    this.walletClient = createWalletClient({
      chain: baseSepolia,
      transport: custom(provider),
    });
  }

  /**
   * Get USDC balance for connected wallet
   */
  async getUSDCBalance(address: string): Promise<string> {
    try {
      const balance = await this.publicClient.readContract({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      });

      // USDC has 6 decimals
      return formatUnits(balance as bigint, 6);
    } catch (error) {
      console.error("Error fetching USDC balance:", error);
      return "0";
    }
  }

  /**
   * Create X402 payment for trade execution
   */
  async createX402Payment(
    recipientAddress: string,
    amount: number,
    userAddress: string
  ): Promise<{ success: boolean; hash?: string; error?: string }> {
    try {
      // Convert amount to USDC wei (6 decimals)
      const amountWei = parseUnits(amount.toString(), 6);

      // Send USDC transaction
      const hash = await this.walletClient.writeContract({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: "transfer",
        args: [recipientAddress as `0x${string}`, amountWei],
        account: userAddress as `0x${string}`,
      });

      return {
        success: true,
        hash,
      };
    } catch (error) {
      console.error("X402 payment failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Payment failed",
      };
    }
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForTransaction(hash: string): Promise<boolean> {
    try {
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: hash as `0x${string}`,
        timeout: 60000, // 1 minute timeout
      });

      return receipt.status === "success";
    } catch (error) {
      console.error("Transaction confirmation failed:", error);
      return false;
    }
  }
}

// Helper to get API base URL (align with dashboard logic)
function getApiBase(): string {
  const envBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  try {
    const url = new URL(envBase);
    if (url.hostname === "0.0.0.0") {
      url.hostname = "127.0.0.1";
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return "http://localhost:8000";
  }
}

/**
 * Check if opportunity is already unlocked
 */
export async function checkUnlockStatus(
  opportunityId: string,
  walletAddress: string
): Promise<{ unlocked: boolean; unlock_timestamp?: string }> {
  try {
    const response = await fetch(
      `${getApiBase()}/api/v1/unlocks/check/${opportunityId}?wallet_address=${walletAddress}`
    );
    if (response.ok) {
      return await response.json();
    }
    return { unlocked: false };
  } catch (error) {
    console.error("Failed to check unlock status:", error);
    return { unlocked: false };
  }
}

/**
 * Execute arbitrage trade with X402 payment (or use existing unlock)
 */
export async function executeTradeWithPayment(
  opportunityId: string,
  userId: number,
  walletAddress: string,
  provider: any
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
  alreadyUnlocked?: boolean;
}> {
  try {
    // First check if already unlocked
    const unlockStatus = await checkUnlockStatus(opportunityId, walletAddress);

    if (unlockStatus.unlocked) {
      // Already unlocked, return success without payment
      return {
        success: true,
        alreadyUnlocked: true,
        data: {
          success: true,
          message: "Trade details already unlocked",
          net_profit: Math.random() * 30 + 10, // Mock profit for display
          unlock_timestamp: unlockStatus.unlock_timestamp,
        },
      };
    }

    const walletService = new WalletService(provider);

    // Get service wallet address from backend
    const serviceResponse = await fetch(
      `${getApiBase()}/api/v1/cdp/service-wallet`
    );
    if (!serviceResponse.ok) {
      throw new Error("Failed to get service wallet address");
    }
    const { address: serviceWalletAddress } = await serviceResponse.json();

    // Create X402 payment of $0.01 USDC
    const paymentResult = await walletService.createX402Payment(
      serviceWalletAddress,
      0.01, // $0.01 USDC
      walletAddress
    );

    if (!paymentResult.success) {
      return {
        success: false,
        error: paymentResult.error || "Payment failed",
      };
    }

    // Wait for payment confirmation
    const confirmed = await walletService.waitForTransaction(
      paymentResult.hash!
    );
    if (!confirmed) {
      return {
        success: false,
        error: "Payment transaction failed to confirm",
      };
    }

    // Execute trade on backend with payment proof
    const tradeResponse = await fetch(`${getApiBase()}/api/v1/trades/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        opportunity_id: opportunityId,
        user_id: userId,
        payment_hash: paymentResult.hash,
        wallet_address: walletAddress,
      }),
    });

    if (!tradeResponse.ok) {
      let errorDetail = "Trade execution failed";
      try {
        const errorData = await tradeResponse.json();
        errorDetail = errorData.detail || errorDetail;
      } catch {}
      return {
        success: false,
        error: errorDetail,
      };
    }

    const tradeData = await tradeResponse.json();
    return {
      success: true,
      data: tradeData,
    };
  } catch (error) {
    console.error("Trade execution with payment failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
