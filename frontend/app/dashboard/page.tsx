"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, LogOut } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";

interface ArbitrageTrade {
  id: string;
  source: "polymarket" | "kalshi";
  price: number;
  side: "yes" | "no";
  shares: number;
}

interface ArbitrageInfo {
  polymarket_url: string;
  name: string;
  kalshi_url: string;
  image_url?: string;
  description: string;
  polymarket_yes_market_name?: string;
  polymarket_no_market_name?: string;
  kalshi_yes_market_name?: string;
  kalshi_no_market_name?: string;
}

interface ArbitrageOpportunity {
  id: string;
  profit: number;
  trade_a: ArbitrageTrade;
  trade_b: ArbitrageTrade;
  total_cost: number;
  shares: number;
  info: ArbitrageInfo;
}

interface ManualTradeRecord {
  tradeId: string;
  opportunityId: string;
  marketTitle: string;
  timestamp: string;
  status: "open" | "closed";
  scale: number; // 0..1
  capital: number;
  expectedProfit: number;
  yesVenue: string;
  yesPrice: number;
  yesShares: number;
  noVenue: string;
  noPrice: number; // price of NO leg (1 - underlying price)
  noShares: number;
}

interface AutoExecRecord {
  tradeId: string;
  opportunityId: string;
  marketTitle: string;
  timestamp: string;
  netProfit?: number;
}

export default function DashboardPage() {
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>(
    []
  );
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [connecting, setConnecting] = useState(false);
  const [walletType, setWalletType] = useState<string>("");
  const [coinbaseProvider, setCoinbaseProvider] = useState<any>(null);
  const [discoveryRan, setDiscoveryRan] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [wsStatus, setWsStatus] = useState<
    "disconnected" | "connecting" | "connected" | "error"
  >("disconnected");
  const [wsLogs, setWsLogs] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [tradingMode, setTradingMode] = useState<"manual" | "auto">("manual");
  const [usdcBalance, setUsdcBalance] = useState<string>("—");
  const [usdcLoading, setUsdcLoading] = useState<boolean>(false);
  const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS || "").trim();
  const BASE_SEPOLIA_CHAIN_ID_HEX = "0x14a34"; // 84532
  const BASE_SEPOLIA_PARAMS = {
    chainId: BASE_SEPOLIA_CHAIN_ID_HEX,
    chainName: "Base Sepolia",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://sepolia.base.org"],
    blockExplorerUrls: ["https://sepolia.basescan.org"],
  } as const;
  const [unlockedOppIds, setUnlockedOppIds] = useState<Set<string>>(new Set());
  const [tradeDetailsOpen, setTradeDetailsOpen] = useState(false);
  const [selectedOpp, setSelectedOpp] = useState<ArbitrageOpportunity | null>(
    null
  );
  const [tradeScale, setTradeScale] = useState<number>(1);
  const [executingTrades, setExecutingTrades] = useState<Set<string>>(
    new Set()
  );
  const [manualTrades, setManualTrades] = useState<ManualTradeRecord[]>([]);
  const [autoExecutions, setAutoExecutions] = useState<AutoExecRecord[]>([]);
  const [polymarketBalance, setPolymarketBalance] = useState<string>("—");
  const [kalshiBalance, setKalshiBalance] = useState<string>("—");
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [polyExecuted, setPolyExecuted] = useState<boolean>(false);
  const [kalshiExecuted, setKalshiExecuted] = useState<boolean>(false);
  const [polyAmount, setPolyAmount] = useState<string>("");
  const [kalshiAmount, setKalshiAmount] = useState<string>("");
  const [firstSeen, setFirstSeen] = useState<Record<string, string>>({});

  useEffect(() => {
    // Initialize Coinbase Wallet (extension-only)
    initializeCoinbaseWallet();
    discoverProvidersEIP6963();
    // Fetch opportunities from backend
    fetchOpportunities();
    // Load onboarding state
    try {
      const completed = localStorage.getItem("onboardingCompleted") === "true";
      const savedMode =
        (localStorage.getItem("tradingMode") as "manual" | "auto") || "manual";
      setOnboardingCompleted(completed);
      setTradingMode(savedMode);
      if (!completed) setOnboardingOpen(true);
      // Load manual trades
      const tradesRaw = localStorage.getItem("manualTrades");
      if (tradesRaw) {
        setManualTrades(JSON.parse(tradesRaw) as ManualTradeRecord[]);
      }
      // Load auto executions
      const autoRaw = localStorage.getItem("autoExecutions");
      if (autoRaw) {
        setAutoExecutions(JSON.parse(autoRaw) as AutoExecRecord[]);
      }
    } catch {}
  }, []);

  const persistManualTrades = (list: ManualTradeRecord[]) => {
    setManualTrades(list);
    try {
      localStorage.setItem("manualTrades", JSON.stringify(list));
    } catch {}
  };

  const addManualTrade = (rec: ManualTradeRecord) => {
    persistManualTrades([rec, ...manualTrades]);
  };

  const markTradeSettled = (tradeId: string) => {
    const next = manualTrades.map((t) =>
      t.tradeId === tradeId ? { ...t, status: "closed" as const } : t
    );
    persistManualTrades(next);
  };

  const unlockTrade = async (opp: ArbitrageOpportunity) => {
    try {
      setExecutingTrades((prev) => new Set([...Array.from(prev), opp.id]));

      if (!walletAddress || !coinbaseProvider) {
        throw new Error("Connect wallet first");
      }

      const { executeTradeWithPayment } = await import("../lib/wallet");
      const result = await executeTradeWithPayment(
        opp.id,
        1,
        walletAddress,
        coinbaseProvider
      );

      if (result.success) {
        if (!result.alreadyUnlocked) {
          alert(
            `Trade details unlocked! Estimated profit: $${result.data.net_profit.toFixed(
              2
            )}`
          );
        }
        // Mark as unlocked and open details
        setUnlockedOppIds((prev) => new Set([...Array.from(prev), opp.id]));
        setSelectedOpp(opp);
        setTradeScale(1);
        setTradeDetailsOpen(true);
        setPolyExecuted(false);
        setKalshiExecuted(false);
        // Initialize default amounts from current slider
        try {
          const capital = getTotalCost(opp) * 1;
          setPolyAmount((0.5 * capital).toFixed(2));
          setKalshiAmount((0.5 * capital).toFixed(2));
        } catch {}
      } else {
        throw new Error(result.error || "Unlock failed");
      }
    } catch (e) {
      alert(
        `Failed to unlock trade: ${
          e instanceof Error ? e.message : "Unknown error"
        }`
      );
    } finally {
      setExecutingTrades((prev) => {
        const next = new Set(prev);
        next.delete(opp.id);
        return next;
      });
    }
  };

  const persistAutoExecutions = (list: AutoExecRecord[]) => {
    setAutoExecutions(list);
    try {
      localStorage.setItem("autoExecutions", JSON.stringify(list));
    } catch {}
  };

  const addAutoExecution = (rec: AutoExecRecord) => {
    persistAutoExecutions([rec, ...autoExecutions]);
  };

  // Calculate total capital locked in open trades
  const getLockedCapital = () => {
    return manualTrades
      .filter((t) => t.status === "open")
      .reduce((total, trade) => total + trade.capital, 0);
  };

  // Fetch account balances from trading platforms
  const fetchAccountBalances = async () => {
    if (!connected || !walletAddress) return;

    setBalancesLoading(true);
    try {
      const polyApiKey = localStorage.getItem("polymarketApiKey");
      const kalshiApiKey = localStorage.getItem("kalshiApiKey");
      const kalshiApiSecret = localStorage.getItem("kalshiApiSecret");

      // Polymarket balance
      try {
        if (polyApiKey) {
          const polyResp = await fetch(
            `${getApiBase()}/api/v1/balances/polymarket`,
            {
              headers: {
                "wallet-address": walletAddress,
                "api-key": polyApiKey,
              },
            }
          );
          if (polyResp.ok) {
            const data = await polyResp.json();
            setPolymarketBalance(data.balance?.toFixed(2) || "0.00");
          } else {
            setPolymarketBalance("API Error");
          }
        } else {
          setPolymarketBalance("Not Connected");
        }
      } catch {
        // Fallback to mock data for demo when no API key
        if (polyApiKey) {
          setPolymarketBalance("—");
        } else {
          setPolymarketBalance((Math.random() * 500 + 100).toFixed(2));
        }
      }

      // Kalshi balance
      try {
        if (kalshiApiKey && kalshiApiSecret) {
          console.log(
            "Fetching Kalshi balance with API key:",
            kalshiApiKey.slice(0, 8) + "..."
          );
          const kalshiResp = await fetch(
            `${getApiBase()}/api/v1/balances/kalshi`,
            {
              headers: {
                "wallet-address": walletAddress,
                "api-key": kalshiApiKey,
                "api-secret": kalshiApiSecret,
              },
            }
          );

          console.log("Kalshi API response status:", kalshiResp.status);

          if (kalshiResp.ok) {
            const data = await kalshiResp.json();
            console.log("Kalshi balance data:", data);
            setKalshiBalance(data.balance?.toFixed(2) || "0.00");
          } else {
            const errorText = await kalshiResp.text();
            console.error("Kalshi API error:", kalshiResp.status, errorText);
            setKalshiBalance(`Error ${kalshiResp.status}`);
          }
        } else {
          setKalshiBalance("Not Connected");
        }
      } catch (error) {
        console.error("Kalshi fetch error:", error);
        // Fallback to mock data for demo when no API credentials
        if (kalshiApiKey && kalshiApiSecret) {
          setKalshiBalance("—");
        } else {
          setKalshiBalance((Math.random() * 300 + 50).toFixed(2));
        }
      }
    } finally {
      setBalancesLoading(false);
    }
  };

  // Helper function to get market name from opportunity
  const getMarketName = (opp: ArbitrageOpportunity) => {
    return opp.info?.name || "Unknown Market";
  };

  // Helper function to get profit from opportunity
  const getProfit = (opp: ArbitrageOpportunity) => {
    return opp.profit || 0;
  };

  // Helper function to get total cost from opportunity
  const getTotalCost = (opp: ArbitrageOpportunity) => {
    return opp.total_cost || 0;
  };

  // Helper function to get trade details from opportunity
  const getTradeDetails = (opp: ArbitrageOpportunity) => {
    // Add null checks for trade_a and trade_b
    if (!opp.trade_a || !opp.trade_b) {
      console.error(
        "Invalid opportunity structure - missing trade_a or trade_b:",
        opp
      );
      return {
        polyPrice: 0,
        kalshiPrice: 0,
        polySide: "yes" as "yes" | "no",
        kalshiSide: "no" as "yes" | "no",
        polyShares: 0,
        kalshiShares: 0,
        polymarketUrl: opp.info?.polymarket_url,
        kalshiUrl: opp.info?.kalshi_url,
      };
    }

    const polyTrade =
      opp.trade_a.source === "polymarket" ? opp.trade_a : opp.trade_b;
    const kalshiTrade =
      opp.trade_a.source === "kalshi" ? opp.trade_a : opp.trade_b;

    return {
      polyPrice: polyTrade.price,
      kalshiPrice: kalshiTrade.price,
      polySide: polyTrade.side,
      kalshiSide: kalshiTrade.side,
      polyShares: polyTrade.shares,
      kalshiShares: kalshiTrade.shares,
      polymarketUrl: opp.info?.polymarket_url,
      kalshiUrl: opp.info?.kalshi_url,
    };
  };

  // Helper function to get market-specific names for Yes/No sides
  const getMarketSideNames = (
    opp: ArbitrageOpportunity,
    venue: "polymarket" | "kalshi",
    side: "yes" | "no"
  ) => {
    if (venue === "polymarket") {
      if (side === "yes") {
        return opp.info?.polymarket_yes_market_name || "Yes";
      } else {
        return opp.info?.polymarket_no_market_name || "No";
      }
    } else {
      if (side === "yes") {
        return opp.info?.kalshi_yes_market_name || "Yes";
      } else {
        return opp.info?.kalshi_no_market_name || "No";
      }
    }
  };

  const executeManualTrade = async () => {
    if (!selectedOpp || !walletAddress || !coinbaseProvider) return;

    try {
      // First import the wallet utilities
      const { executeTradeWithPayment } = await import("../lib/wallet");

      // Execute trade with X402 payment
      const result = await executeTradeWithPayment(
        selectedOpp.id,
        1, // Mock user ID for demo
        walletAddress,
        coinbaseProvider
      );

      if (result.success) {
        if (result.alreadyUnlocked) {
          // Already unlocked
          alert(
            `Trade details are already unlocked! You can manually execute the trades on each platform.`
          );
        } else {
          // Newly unlocked
          alert(
            `Trade details unlocked! Now you can manually execute the trades on each platform for an estimated profit of $${result.data.net_profit.toFixed(
              2
            )}.`
          );
          // Add to unlocked set
          setUnlockedOppIds(
            (prev) => new Set([...Array.from(prev), selectedOpp.id])
          );
        }
        setTradeDetailsOpen(false);
      } else {
        // Show error message
        alert(`Failed to unlock trade details: ${result.error}`);
      }
    } catch (error) {
      console.error("Trade execution error:", error);
      alert(
        "Trade execution failed: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    }
  };

  const saveExecutedTrade = () => {
    if (!selectedOpp) return;
    const tradeDetails = getTradeDetails(selectedOpp);
    const defaultCapital = getTotalCost(selectedOpp) * tradeScale;
    const parsedPolyAmt = polyAmount !== "" ? parseFloat(polyAmount) : NaN;
    const parsedKalshiAmt =
      kalshiAmount !== "" ? parseFloat(kalshiAmount) : NaN;
    const polyAmt = isNaN(parsedPolyAmt)
      ? 0.5 * defaultCapital
      : Math.max(0, parsedPolyAmt);
    const kalshiAmt = isNaN(parsedKalshiAmt)
      ? 0.5 * defaultCapital
      : Math.max(0, parsedKalshiAmt);
    const capital = polyAmt + kalshiAmt;
    const polyShares = polyAmt / tradeDetails.polyPrice;
    const kalshiShares = kalshiAmt / tradeDetails.kalshiPrice;
    const yesVenue = tradeDetails.polySide === "yes" ? "Polymarket" : "Kalshi";
    const yesPrice =
      tradeDetails.polySide === "yes"
        ? tradeDetails.polyPrice
        : tradeDetails.kalshiPrice;
    const yesShares =
      tradeDetails.polySide === "yes" ? polyShares : kalshiShares;
    const noVenue = tradeDetails.polySide === "no" ? "Polymarket" : "Kalshi";
    const noPrice =
      tradeDetails.polySide === "no"
        ? tradeDetails.polyPrice
        : tradeDetails.kalshiPrice;
    const noShares = tradeDetails.polySide === "no" ? polyShares : kalshiShares;

    // Scale expected profit proportional to capital used vs baseline
    const baselineCost = Math.max(1, getTotalCost(selectedOpp));
    const profitPerDollar = getProfit(selectedOpp) / baselineCost;
    const expectedProfit = profitPerDollar * capital;

    const rec: ManualTradeRecord = {
      tradeId: `manual_${Date.now()}`,
      opportunityId: selectedOpp.id,
      marketTitle: getMarketName(selectedOpp),
      timestamp: new Date().toISOString(),
      status: "open",
      scale: tradeScale,
      capital: Math.round(capital * 100) / 100,
      expectedProfit: Math.round(expectedProfit * 100) / 100,
      yesVenue,
      yesPrice,
      yesShares: Math.round(yesShares),
      noVenue,
      noPrice,
      noShares: Math.round(noShares),
    };
    addManualTrade(rec);
    setTradeDetailsOpen(false);
    setPolyExecuted(false);
    setKalshiExecuted(false);
    setPolyAmount("");
    setKalshiAmount("");
  };

  // Fetch USDC balance when connected or account changes
  useEffect(() => {
    let interval: any;
    const maybeFetch = async () => {
      if (!connected || !walletAddress || !coinbaseProvider || !USDC_ADDRESS) {
        setUsdcBalance("—");
        return;
      }
      await fetchUsdcBalance();
    };
    maybeFetch();
    // Refresh every 30s
    interval = setInterval(maybeFetch, 30000);
    return () => clearInterval(interval);
  }, [connected, walletAddress, coinbaseProvider, USDC_ADDRESS]);

  // Fetch account balances when connected
  useEffect(() => {
    let interval: any;
    if (connected && walletAddress) {
      fetchAccountBalances();
      // Load unlocked opportunities for this wallet
      (async () => {
        try {
          const resp = await fetch(
            `${getApiBase()}/api/v1/unlocks/user/${walletAddress}`
          );
          if (resp.ok) {
            const data = await resp.json();
            const ids: string[] = (data.unlocked_opportunities || []).map(
              (u: any) => u.opportunity_id
            );
            setUnlockedOppIds(new Set(ids));
          }
        } catch {}
      })();
      // Refresh balances every 60s
      interval = setInterval(fetchAccountBalances, 60000);
    } else {
      setPolymarketBalance("—");
      setKalshiBalance("—");
    }
    return () => clearInterval(interval);
  }, [connected, walletAddress]);

  const fetchUsdcBalance = async () => {
    if (!coinbaseProvider || !walletAddress || !USDC_ADDRESS) return;
    try {
      setUsdcLoading(true);
      // Ensure we're on Base Sepolia
      const ok = await ensureBaseSepoliaNetwork();
      if (!ok) {
        setUsdcBalance("—");
        return;
      }
      const to = USDC_ADDRESS;
      const addr = walletAddress
        .replace(/^0x/, "")
        .toLowerCase()
        .padStart(40, "0");
      const balanceOfSelector = "0x70a08231"; // balanceOf(address)
      const data = balanceOfSelector + "0".repeat(24) + addr;
      const hex: string = await coinbaseProvider.request({
        method: "eth_call",
        params: [{ to, data }, "latest"],
      });
      const raw = BigInt(hex);
      // decimals()
      let decimals = 6;
      try {
        const decimalsSelector = "0x313ce567";
        const dHex: string = await coinbaseProvider.request({
          method: "eth_call",
          params: [{ to, data: decimalsSelector }, "latest"],
        });
        decimals = Number(BigInt(dHex));
      } catch {}
      // Avoid BigInt exponentiation for broader TS targets
      const denom = BigInt("1" + "0".repeat(decimals));
      const whole = raw / denom;
      const frac = raw % denom;
      const fracStr = frac.toString().padStart(decimals, "0").slice(0, 2); // 2 dp
      setUsdcBalance(`${whole.toString()}.${fracStr}`);
    } catch (e) {
      setUsdcBalance("—");
    } finally {
      setUsdcLoading(false);
    }
  };

  const ensureBaseSepoliaNetwork = async (): Promise<boolean> => {
    try {
      const chainId: string = await coinbaseProvider.request({
        method: "eth_chainId",
      });
      if (chainId?.toLowerCase() === BASE_SEPOLIA_CHAIN_ID_HEX) return true;
      try {
        await coinbaseProvider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: BASE_SEPOLIA_CHAIN_ID_HEX }],
        });
        return true;
      } catch (switchErr: any) {
        // 4902 = Unrecognized chain, try adding
        if (switchErr?.code === 4902) {
          try {
            await coinbaseProvider.request({
              method: "wallet_addEthereumChain",
              params: [BASE_SEPOLIA_PARAMS],
            });
            return true;
          } catch {
            return false;
          }
        }
        return false;
      }
    } catch {
      return false;
    }
  };

  // Re-detect provider when the window gains focus (e.g., after installing extension)
  useEffect(() => {
    const handleFocus = () => initializeCoinbaseWallet();
    if (typeof window !== "undefined") {
      window.addEventListener("focus", handleFocus);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", handleFocus);
      }
    };
  }, []);

  // EIP-6963 discovery
  const discoverProvidersEIP6963 = () => {
    if (typeof window === "undefined" || discoveryRan) return;
    try {
      const discovered: any[] = [];
      const onAnnounce = (event: any) => {
        const provider = event?.detail?.provider;
        if (provider && !discovered.includes(provider)) {
          discovered.push(provider);
        }
      };
      window.addEventListener("eip6963:announceProvider", onAnnounce as any, {
        once: false,
      });
      window.dispatchEvent(new Event("eip6963:requestProvider"));

      // Evaluate after a short delay
      setTimeout(() => {
        window.removeEventListener(
          "eip6963:announceProvider",
          onAnnounce as any
        );
        setDiscoveryRan(true);
        if (discovered.length > 0) {
          const coinbase = discovered.find(
            (p) => p?.isCoinbaseWallet || p?.info?.rdns?.includes?.("coinbase")
          );
          const chosen = coinbase || discovered[0];
          if (chosen) {
            setCoinbaseProvider(chosen);
          }
        }
      }, 150);
    } catch (err) {
      // no-op
    }
  };

  const initializeCoinbaseWallet = async () => {
    try {
      const injected = (window as any)?.ethereum;
      // Prefer the Coinbase provider if multiple are injected
      const provider = injected?.providers
        ? injected.providers.find((p: any) => p && p.isCoinbaseWallet)
        : injected?.isCoinbaseWallet
        ? injected
        : null;
      if (provider) {
        setCoinbaseProvider(provider);

        // Check if already connected
        const accounts: string[] = await provider.request({
          method: "eth_accounts",
        });
        if (accounts && accounts.length > 0) {
          setConnected(true);
          setWalletAddress(accounts[0]);
          setWalletType("Coinbase Wallet");
        }

        // Listen for connection changes on the provider
        provider.on("accountsChanged", (accounts: string[]) => {
          if (!accounts || accounts.length === 0) {
            setConnected(false);
            setWalletAddress("");
            setWalletType("");
          } else {
            setConnected(true);
            setWalletAddress(accounts[0]);
            setWalletType("Coinbase Wallet");
          }
        });

        provider.on("chainChanged", () => {
          window.location.reload();
        });
      } else {
        setCoinbaseProvider(null);
        // Also check if a generic provider exists as a fallback
        if (injected?.providers && injected.providers.length > 0) {
          setCoinbaseProvider(injected.providers[0]);
        } else if (injected) {
          setCoinbaseProvider(injected);
        }
      }
    } catch (error) {
      console.error("Failed to initialize Coinbase Wallet:", error);
    }
  };

  const connectWallet = async () => {
    setConnecting(true);
    try {
      if (!coinbaseProvider) {
        // No extension installed: show inline prompt instead of opening a big tab
        setShowInstallPrompt(true);
        return;
      }

      // This will trigger the small extension popup
      const accounts: string[] = await coinbaseProvider.request({
        method: "eth_requestAccounts",
      });

      if (accounts.length > 0) {
        setConnected(true);
        setWalletAddress(accounts[0]);
        setWalletType("Coinbase Wallet");

        // Store connection in localStorage
        localStorage.setItem("walletAddress", accounts[0]);
        localStorage.setItem("walletType", "Coinbase Wallet");
      }
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      const e = error as { code?: number | string; message?: string };
      if (e && (e.code === 4001 || e.code === "USER_REJECTED")) {
        alert("Connection was cancelled by user.");
      } else if (e?.message?.includes?.("Already processing")) {
        alert(
          "Wallet is already processing a connection request. Check your extension popup."
        );
      } else {
        alert("Failed to connect wallet. Please try again.");
      }
    } finally {
      setConnecting(false);
    }
  };

  const disconnectWallet = async () => {
    try {
      setConnected(false);
      setWalletAddress("");
      setWalletType("");

      // Clear stored wallet data
      localStorage.removeItem("walletAddress");
      localStorage.removeItem("walletType");

      alert("Wallet disconnected successfully");
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
    }
  };

  const getShortAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const fetchOpportunities = async () => {
    try {
      const response = await fetch(
        `${
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
        }/api/v1/opportunities/`
      );
      if (response.ok) {
        const data = await response.json();
        console.log("API data received:", data);
        const list = [...data.opportunities];
        console.log("Final opportunities list:", list);
        setOpportunities(list);
        setFirstSeen((prev) => {
          const next = { ...prev };
          const nowIso = new Date().toISOString();
          for (const o of list) {
            if (!next[o.id]) next[o.id] = nowIso;
          }
          return next;
        });
      } else {
        console.log("API response not ok, using fallback");
        // Fallback to demo data if API is not available
        const list = [sampleOpportunity];
        setOpportunities(list);
        setFirstSeen((prev) => {
          const next = { ...prev };
          if (!next[sampleOpportunity.id])
            next[sampleOpportunity.id] = new Date().toISOString();
          return next;
        });
      }
    } catch (error) {
      console.error("Failed to fetch opportunities:", error);
      // Use demo data when API fails
      const list = [sampleOpportunity];
      setOpportunities(list);
      setFirstSeen((prev) => {
        const next = { ...prev };
        if (!next[sampleOpportunity.id])
          next[sampleOpportunity.id] = new Date().toISOString();
        return next;
      });
    } finally {
      setLoading(false);
    }
  };

  // Sample demo data based on your JSON schema
  const sampleOpportunity: ArbitrageOpportunity = {
    id: "demo_rays_mariners_2025",
    profit: 94.7874,
    trade_a: {
      id: "81702151472902979371724610344050613085560013955755917249373146284911269602672",
      source: "polymarket",
      price: 0.4,
      side: "yes",
      shares: 4739.37,
    },
    trade_b: {
      id: "KXMLBGAME-25AUG09TBSEA-SEA",
      source: "kalshi",
      price: 0.58,
      side: "no",
      shares: 4739.37,
    },
    total_cost: 4644.5826,
    shares: 4739.37,
    info: {
      polymarket_url: "https://polymarket.com/event/mlb-tb-sea-2025-08-10",
      name: "Rays vs. Mariners",
      kalshi_url:
        "https://kalshi.com/markets/KXMLBGAME/professional-baseball-game#kxmlbgame-25aug09tbsea",
      image_url:
        "https://polymarket-upload.s3.us-east-2.amazonaws.com/Repetitive-markets/MLB.jpg",
      description:
        'In the upcoming MLB game, scheduled for August 10 at 4:10PM ET:\nIf the Tampa Bay Rays win, the market will resolve to "Rays".\nIf the Seattle Mariners win, the market will resolve to "Mariners".\nIf the game is postponed, this market will remain open until the game has been completed.\nIf the game is canceled entirely, with no make-up game, this market will resolve 50-50.\nTo know when a postponed game will be played, please check the home team\'s schedule on MLB.com for the listed team and look for the game described as a makeup game.',
      polymarket_yes_market_name: "Rays",
      polymarket_no_market_name: "Mariners",
      kalshi_yes_market_name: "Tampa Bay",
      kalshi_no_market_name: "Seattle",
    },
  };

  // Utilities to build WS URL from API base
  const getApiBase = (): string => {
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
  };

  const toWsUrl = (path: string): string => {
    const base = getApiBase();
    const u = new URL(base);
    const proto = u.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${u.host}${path}`;
  };

  const handleTestWebSocket = () => {
    // Toggle connect/disconnect
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
      return;
    }

    setWsStatus("connecting");
    const wsUrl = toWsUrl("/api/v1/ws/opportunities");
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    const appendLog = (line: string) => {
      setWsLogs((prev) => {
        const next = [...prev, line];
        return next.slice(-10);
      });
    };

    ws.onopen = () => {
      setWsStatus("connected");
      appendLog("connected");
      try {
        ws.send(JSON.stringify({ type: "request_demo_opportunity" }));
        appendLog("sent: request_demo_opportunity");
      } catch (e) {
        appendLog("send error");
      }
    };

    ws.onmessage = (evt) => {
      appendLog(`recv: ${evt.data}`);
      try {
        const msg = JSON.parse(evt.data);
        if (msg?.type === "trade_execution" && msg?.status === "completed") {
          const oppId: string | undefined = msg.opportunity_id;
          const netProfit: number | undefined = msg.result?.net_profit;
          const now = new Date().toISOString();
          const opp = opportunities.find((o) => o.id === oppId);
          const rec: AutoExecRecord = {
            tradeId: msg.result?.trade_id || `auto_${Date.now()}`,
            opportunityId: oppId || "unknown",
            marketTitle: opp ? getMarketName(opp) : oppId || "Executed trade",
            timestamp: now,
            netProfit: typeof netProfit === "number" ? netProfit : undefined,
          };
          addAutoExecution(rec);
        }
      } catch {
        // ignore non-JSON
      }
    };

    ws.onerror = () => {
      setWsStatus("error");
      appendLog("error");
    };

    ws.onclose = () => {
      setWsStatus("disconnected");
      appendLog("disconnected");
      wsRef.current = null;
    };
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        wsRef.current?.close();
      } catch {}
    };
  }, []);

  // Helper to format "time ago" for discovery
  const getDiscoveredAgo = (oppId: string) => {
    const iso = firstSeen[oppId];
    if (!iso) return "just now";
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diffSec = Math.max(0, Math.floor((now - then) / 1000));
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} hr ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay} d ago`;
  };

  // Update amounts when slider changes, unless trade is already executed
  useEffect(() => {
    if (selectedOpp && tradeDetailsOpen) {
      const capital = getTotalCost(selectedOpp) * tradeScale;

      // Only update polymarket amount if not executed
      if (!polyExecuted) {
        setPolyAmount((0.5 * capital).toFixed(2));
      }

      // Only update kalshi amount if not executed
      if (!kalshiExecuted) {
        setKalshiAmount((0.5 * capital).toFixed(2));
      }
    }
  }, [tradeScale, selectedOpp, tradeDetailsOpen, polyExecuted, kalshiExecuted]);

  // Helper function to validate opportunity structure
  const isValidOpportunity = (opp: any): opp is ArbitrageOpportunity => {
    return (
      opp &&
      typeof opp.id === "string" &&
      typeof opp.profit === "number" &&
      opp.trade_a &&
      opp.trade_b &&
      typeof opp.trade_a.source === "string" &&
      typeof opp.trade_b.source === "string" &&
      typeof opp.total_cost === "number" &&
      opp.info &&
      typeof opp.info.name === "string"
    );
  };

  // Helper function to get existing trade for an opportunity
  const getExistingTrade = (opportunityId: string) => {
    return manualTrades.find(
      (t) => t.opportunityId === opportunityId && t.status === "open"
    );
  };

  return (
    <div className="min-h-screen bg-background hero-bg relative">
      {/* Top Menu Bar */}
      <nav className="border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-20">
        <div className="container mx-auto px-4 py-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span
                  className="text-xl font-bold cursor-pointer"
                  onClick={() => (window.location.href = "/")}
                >
                  Arboretum
                </span>
                <Badge variant="secondary" className="ml-2">
                  Dashboard
                </Badge>
                {onboardingCompleted && (
                  <Badge variant="secondary" className="ml-1">
                    Mode: {tradingMode === "auto" ? "Autonomous" : "Manual"}
                  </Badge>
                )}
              </div>
              <div className="flex gap-2 items-center">
                {connected ? (
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">{walletType}</span>
                      <br />
                      <span className="font-mono">
                        {getShortAddress(walletAddress)}
                      </span>
                    </div>
                    <Badge
                      variant="secondary"
                      title="Base Sepolia USDC balance"
                    >
                      USDC: {usdcLoading ? "…" : usdcBalance}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => (window.location.href = "/settings")}
                        variant="outline"
                        size="icon"
                        aria-label="Settings"
                        className="h-9 w-9"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={disconnectWallet}
                        variant="outline"
                        size="icon"
                        aria-label="Disconnect Wallet"
                        className="h-9 w-9 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <LogOut className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={connectWallet}
                    disabled={connecting}
                    className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
                  >
                    {connecting ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Connecting...
                      </div>
                    ) : !coinbaseProvider ? (
                      "Install Coinbase Wallet"
                    ) : (
                      "Connect Wallet"
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 relative z-10">
        <div className="max-w-4xl mx-auto">
          {/* Onboarding Modal */}
          <Dialog.Root open={onboardingOpen} onOpenChange={setOnboardingOpen}>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
              <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-lg rounded-lg border glass p-6 shadow-xl">
                <Dialog.Title className="text-xl font-semibold mb-2">
                  Welcome to Arboretum
                </Dialog.Title>
                <Dialog.Description className="text-sm text-muted-foreground mb-4">
                  Choose how you want to trade. You can switch later in
                  settings.
                </Dialog.Description>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() => setTradingMode("manual")}
                    className={`rounded-md border p-4 text-left transition ${
                      tradingMode === "manual"
                        ? "ring-2 ring-green-500 bg-green-50 dark:bg-green-950/20"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="font-medium mb-1">Manual Trading</div>
                    <div className="text-xs text-muted-foreground">
                      Review each opportunity and confirm before executing.
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTradingMode("auto")}
                    className={`rounded-md border p-4 text-left transition ${
                      tradingMode === "auto"
                        ? "ring-2 ring-green-500 bg-green-50 dark:bg-green-950/20"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="font-medium mb-1">Autonomous Trading</div>
                    <div className="text-xs text-muted-foreground">
                      Let Arboretum execute profitable trades within your
                      limits.
                    </div>
                  </button>
                </div>

                <div className="flex justify-end gap-2 mt-2">
                  <Button
                    variant="outline"
                    onClick={() => setOnboardingOpen(false)}
                  >
                    Maybe later
                  </Button>
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      try {
                        localStorage.setItem("onboardingCompleted", "true");
                        localStorage.setItem("tradingMode", tradingMode);
                      } catch {}
                      setOnboardingCompleted(true);
                      setOnboardingOpen(false);
                    }}
                  >
                    Continue
                  </Button>
                </div>

                <Dialog.Close asChild>
                  <button
                    aria-label="Close"
                    className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted"
                    onClick={() => setOnboardingOpen(false)}
                  >
                    ✕
                  </button>
                </Dialog.Close>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
          {/* Status Cards */}
          <div className="grid md:grid-cols-4 gap-4 mb-8">
            <Card className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Connection Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      connected ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Today's Profit
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">$0.00</div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Opportunities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {connected ? opportunities.length : "—"}
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Trades Today
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0</div>
              </CardContent>
            </Card>
          </div>

          {/* Account Balances */}
          {connected && (
            <Card className="glass mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Account Balances</CardTitle>
                <CardDescription>
                  Your available funds across trading platforms
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  const hasPolymarketKey =
                    !!localStorage.getItem("polymarketApiKey");
                  const hasKalshiCreds = !!(
                    localStorage.getItem("kalshiApiKey") &&
                    localStorage.getItem("kalshiApiSecret")
                  );
                  const hasAnyConnection = hasPolymarketKey || hasKalshiCreds;

                  if (!hasAnyConnection) {
                    return (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800" />
                        <h3 className="text-lg font-medium mb-2">
                          Link Your Trading Accounts
                        </h3>
                        <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                          Connect your Polymarket and Kalshi accounts to see
                          real balances and enable automatic trading.
                        </p>
                        <Button
                          onClick={() => (window.location.href = "/settings")}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Link Accounts in Settings
                        </Button>
                      </div>
                    );
                  }

                  return (
                    <>
                      <div className="grid md:grid-cols-4 gap-4">
                        <div className="text-center p-4 border rounded-lg">
                          <div className="text-sm text-muted-foreground mb-1">
                            Base Sepolia USDC
                          </div>
                          <div className="text-xl font-bold">
                            {usdcLoading ? (
                              <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto" />
                            ) : (
                              `$${usdcBalance}`
                            )}
                          </div>
                        </div>

                        <div
                          className={`text-center p-4 border rounded-lg ${
                            !hasPolymarketKey
                              ? "opacity-60 bg-gray-50 dark:bg-gray-800"
                              : ""
                          }`}
                        >
                          <div className="text-sm text-muted-foreground mb-1 flex items-center justify-center gap-1">
                            <span>Polymarket</span>
                            {!hasPolymarketKey && (
                              <span className="text-xs">(not linked)</span>
                            )}
                          </div>
                          <div className="text-xl font-bold">
                            {balancesLoading ? (
                              <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" />
                            ) : hasPolymarketKey ? (
                              `$${polymarketBalance}`
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  (window.location.href = "/settings")
                                }
                                className="text-xs"
                              >
                                Link Account
                              </Button>
                            )}
                          </div>
                        </div>

                        <div
                          className={`text-center p-4 border rounded-lg ${
                            !hasKalshiCreds
                              ? "opacity-60 bg-gray-50 dark:bg-gray-800"
                              : ""
                          }`}
                        >
                          <div className="text-sm text-muted-foreground mb-1 flex items-center justify-center gap-1">
                            <span>Kalshi</span>
                            {!hasKalshiCreds && (
                              <span className="text-xs">(not linked)</span>
                            )}
                          </div>
                          <div className="text-xl font-bold">
                            {balancesLoading ? (
                              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                            ) : hasKalshiCreds ? (
                              `$${kalshiBalance}`
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  (window.location.href = "/settings")
                                }
                                className="text-xs"
                              >
                                Link Account
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="text-center p-4 border rounded-lg bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800">
                          <div className="text-sm text-muted-foreground mb-1">
                            Locked in Trades
                          </div>
                          <div className="text-xl font-bold text-orange-600">
                            ${getLockedCapital().toFixed(2)}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {
                              manualTrades.filter((t) => t.status === "open")
                                .length
                            }{" "}
                            open trades
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex justify-end gap-2">
                        {hasAnyConnection && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={fetchAccountBalances}
                            disabled={balancesLoading}
                          >
                            {balancesLoading
                              ? "Refreshing..."
                              : "Refresh Balances"}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => (window.location.href = "/settings")}
                        >
                          Manage Accounts
                        </Button>
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          <div className="section-divider my-6" />

          {/* Test WebSocket Button */}
          <div className="mb-6">
            <div className="flex justify-end">
              {connected && (
                <Button
                  onClick={fetchOpportunities}
                  variant="outline"
                  size="icon"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" />
                  </svg>
                </Button>
              )}
            </div>
          </div>

          {/* Opportunities List - Show blurred feed when not connected, full details when connected */}
          {connected ? (
            <Card className="glass">
              <CardHeader>
                <CardTitle>Current Arbitrage Opportunities</CardTitle>
                <CardDescription>
                  Live opportunities from Polymarket and Kalshi
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">
                    Loading opportunities...
                  </div>
                ) : opportunities.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No arbitrage opportunities found. The detector is scanning
                    for new opportunities...
                  </div>
                ) : (
                  <div className="space-y-4">
                    {opportunities.map((opp) => {
                      const isUnlocked = unlockedOppIds.has(opp.id);
                      const isExecuting = executingTrades.has(opp.id);
                      const hasExistingTrade = manualTrades.some(
                        (t) => t.opportunityId === opp.id
                      );

                      return (
                        <div
                          key={opp.id}
                          className="border rounded-lg p-4 card-hover opportunity-card relative"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span
                                  className={`font-medium ${
                                    isUnlocked ? "" : "blur-[6px]"
                                  }`}
                                >
                                  {getMarketName(opp)}
                                </span>
                                {hasExistingTrade &&
                                  (() => {
                                    const existingTrade = getExistingTrade(
                                      opp.id
                                    );
                                    return (
                                      <Badge
                                        variant="outline"
                                        className="ml-2"
                                        title={
                                          existingTrade
                                            ? `Executed on ${new Date(
                                                existingTrade.timestamp
                                              ).toLocaleDateString()}`
                                            : undefined
                                        }
                                      >
                                        In Portfolio
                                      </Badge>
                                    );
                                  })()}
                              </div>
                              {opp.info?.description && (
                                <div
                                  className={`text-xs text-muted-foreground line-clamp-2 mb-2 ${
                                    isUnlocked ? "" : "blur-[6px]"
                                  }`}
                                >
                                  {opp.info.description.slice(0, 120)}...
                                </div>
                              )}
                            </div>
                            <div className="text-right ml-4">
                              <div className="text-lg font-bold text-green-600">
                                +${getProfit(opp).toFixed(2)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Discovered {getDiscoveredAgo(opp.id)}
                              </div>
                            </div>
                          </div>

                          {(() => {
                            const tradeDetails = getTradeDetails(opp);
                            return (
                              <div
                                className={`grid grid-cols-2 gap-4 text-sm mb-3 ${
                                  isUnlocked ? "" : "blur-[6px]"
                                }`}
                              >
                                <div>
                                  <div className="text-muted-foreground">
                                    Polymarket (
                                    {getMarketSideNames(
                                      opp,
                                      "polymarket",
                                      "yes"
                                    )}
                                    )
                                  </div>
                                  <div className="font-medium">
                                    ${tradeDetails.polyPrice.toFixed(3)}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-muted-foreground">
                                    Kalshi (
                                    {getMarketSideNames(opp, "kalshi", "no")})
                                  </div>
                                  <div className="font-medium">
                                    ${tradeDetails.kalshiPrice.toFixed(3)}
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          <div className="flex items-center justify-between">
                            <div
                              className={`text-sm text-muted-foreground ${
                                isUnlocked ? "" : "blur-[6px]"
                              }`}
                            >
                              Capital: ${getTotalCost(opp).toFixed(0)}
                            </div>
                            {tradingMode === "manual" ? (
                              <div className="flex gap-2">
                                {hasExistingTrade ? (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled
                                    className="cursor-not-allowed"
                                  >
                                    Already Executed
                                  </Button>
                                ) : !isUnlocked ? (
                                  <Button
                                    size="sm"
                                    className="btn-primary"
                                    disabled={isExecuting}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      unlockTrade(opp);
                                    }}
                                  >
                                    {isExecuting ? (
                                      <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                                        Unlocking...
                                      </div>
                                    ) : (
                                      "Unlock ($0.01)"
                                    )}
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedOpp(opp);
                                      setTradeScale(1);
                                      setPolyExecuted(false);
                                      setKalshiExecuted(false);
                                      try {
                                        const capital = getTotalCost(opp) * 1;
                                        setPolyAmount(
                                          (0.5 * capital).toFixed(2)
                                        );
                                        setKalshiAmount(
                                          (0.5 * capital).toFixed(2)
                                        );
                                      } catch {}
                                      setTradeDetailsOpen(true);
                                    }}
                                  >
                                    Trade Details
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <Badge variant="secondary">Autonomous Mode</Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            /* Blurred Opportunities Feed when not connected */
            <Card className="glass">
              <CardHeader>
                <CardTitle>Live Arbitrage Activity</CardTitle>
                <CardDescription>
                  Recent opportunities detected - connect your wallet to see
                  full details
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">
                    Loading opportunities...
                  </div>
                ) : opportunities.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No recent activity detected. The detector is scanning for
                    new opportunities...
                  </div>
                ) : (
                  <div className="space-y-4">
                    {opportunities.map((opp) => (
                      <div
                        key={opp.id}
                        className="border rounded-lg p-4 relative overflow-hidden card-hover"
                      >
                        {/* Blur overlay for non-connected users */}
                        <div className="absolute inset-0 bg-white/20 backdrop-blur-md pointer-events-none" />

                        <div className="flex items-center justify-between mb-2 relative z-10">
                          <div className="flex items-center gap-2">
                            <span className="font-medium blur-[8px] text-muted-foreground">
                              {getMarketName(opp)}
                            </span>
                          </div>
                          <div className="text-right">
                            {/* Only show profit and timestamp clearly */}
                            <div className="text-lg font-bold text-green-600">
                              +${getProfit(opp).toFixed(2)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Discovered {getDiscoveredAgo(opp.id)}
                            </div>
                          </div>
                        </div>

                        {/* Blurred market details */}
                        <div className="grid grid-cols-2 gap-4 text-sm relative z-10">
                          <div>
                            <div className="text-muted-foreground">
                              Polymarket
                            </div>
                            <div className="blur-[10px] text-muted-foreground">
                              •••
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Kalshi</div>
                            <div className="blur-[10px] text-muted-foreground">
                              •••
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between relative z-10">
                          <div className="text-sm text-muted-foreground blur-[6px]">
                            Capital required: •••
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Connect wallet to unlock
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Call to action (text only) */}
                <div className="mt-6 text-center p-4 bg-muted/30 rounded-lg">
                  <p className="text-muted-foreground text-sm">
                    Connect your wallet to unlock full market details and start
                    trading
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          {/* Trade Details Modal */}
          <Dialog.Root
            open={tradeDetailsOpen}
            onOpenChange={setTradeDetailsOpen}
          >
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
              <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-2xl max-h-[90vh] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-xl overflow-y-auto">
                <Dialog.Title className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                  Trade Details
                </Dialog.Title>

                {selectedOpp && (
                  <div className="space-y-5">
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                      <div className="flex items-center gap-4 mb-4">
                        {selectedOpp.info?.image_url && (
                          <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
                            <img
                              src={selectedOpp.info.image_url}
                              alt={getMarketName(selectedOpp)}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        )}

                        <div className="font-bold text-xl text-gray-900 dark:text-white">
                          {getMarketName(selectedOpp)}
                        </div>

                        <div className="ml-auto">
                          <div className="bg-green-500 text-white rounded-lg p-2 w-24 h-16">
                            <div className="text-xs font-medium">
                              You make
                            </div>
                            <div className="text-m mt-1 font-bold text-center">
                              ${(getProfit(selectedOpp) * tradeScale).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {selectedOpp.info?.description && (
                        <div className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                          {selectedOpp.info.description.slice(0, 150)}...
                        </div>
                      )}
                    </div>

                    {/* Instructions */}
                    {selectedOpp && (
                      <>
                        {(() => {
                          const tradeDetails = getTradeDetails(selectedOpp);
                          const capital =
                            getTotalCost(selectedOpp) * tradeScale;

                          // Calculate shares based on actual amounts (from input fields or 50/50 split)
                          const parsedPolyAmt =
                            polyAmount !== "" ? parseFloat(polyAmount) : NaN;
                          const parsedKalshiAmt =
                            kalshiAmount !== ""
                              ? parseFloat(kalshiAmount)
                              : NaN;

                          // Use manual amounts if entered, otherwise use 50/50 split of capital
                          const polyAmt = !isNaN(parsedPolyAmt)
                            ? parsedPolyAmt
                            : 0.5 * capital;
                          const kalshiAmt = !isNaN(parsedKalshiAmt)
                            ? parsedKalshiAmt
                            : 0.5 * capital;

                          let polyShares = tradeDetails.polyShares;
                          let kalshiShares = tradeDetails.kalshiShares;

                          // Scale shares proportionally with the trade scale
                          if (polyShares === 0) {
                            polyShares = polyAmt / tradeDetails.polyPrice;
                          } else {
                            polyShares = tradeDetails.polyShares * tradeScale;
                          }

                          if (kalshiShares === 0) {
                            kalshiShares = kalshiAmt / tradeDetails.kalshiPrice;
                          } else {
                            kalshiShares =
                              tradeDetails.kalshiShares * tradeScale;
                          }

                          const polyLink =
                            tradeDetails.polymarketUrl ||
                            `https://polymarket.com/search?q=${encodeURIComponent(
                              getMarketName(selectedOpp)
                            )}`;
                          const kalshiLink =
                            tradeDetails.kalshiUrl ||
                            `https://kalshi.com/search?q=${encodeURIComponent(
                              getMarketName(selectedOpp)
                            )}`;

                          const yesVenue =
                            tradeDetails.polySide === "yes"
                              ? "Polymarket"
                              : "Kalshi";
                          const yesPrice =
                            tradeDetails.polySide === "yes"
                              ? tradeDetails.polyPrice
                              : tradeDetails.kalshiPrice;
                          const yesShares =
                            tradeDetails.polySide === "yes"
                              ? polyShares
                              : kalshiShares;
                          const yesLink =
                            yesVenue === "Polymarket" ? polyLink : kalshiLink;

                          const noVenue =
                            tradeDetails.polySide === "no"
                              ? "Polymarket"
                              : "Kalshi";
                          const noPrice =
                            tradeDetails.polySide === "no"
                              ? tradeDetails.polyPrice
                              : tradeDetails.kalshiPrice;
                          const noShares =
                            tradeDetails.polySide === "no"
                              ? polyShares
                              : kalshiShares;
                          const noLink =
                            noVenue === "Polymarket" ? polyLink : kalshiLink;
                          return (
                            <>
                              <div className="grid md:grid-cols-2 gap-4">
                                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-2 border-purple-200 dark:border-purple-800 p-5 shadow-lg hover:shadow-xl transition-all duration-300">
                                  <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full blur-xl"></div>
                                  <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-3">
                                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
                                        {yesVenue === "Polymarket" ? "P" : "K"}
                                      </div>
                                      <div>
                                        <div className="font-bold text-gray-900 dark:text-white">
                                          {yesVenue}
                                        </div>
                                        <div className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                                          Buy{" "}
                                          {getMarketSideNames(
                                            selectedOpp,
                                            yesVenue === "Polymarket"
                                              ? "polymarket"
                                              : "kalshi",
                                            tradeDetails.polySide === "yes"
                                              ? "yes"
                                              : "no"
                                          )}{" "}
                                          @ ${yesPrice.toFixed(3)}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="mb-3">
                                      <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                                        {yesShares.toFixed(0)}
                                      </div>
                                      <div className="text-sm text-gray-600 dark:text-gray-300">
                                        shares • Cost: $
                                        {(yesVenue === "Polymarket"
                                          ? polyAmt
                                          : kalshiAmt
                                        ).toFixed(2)}
                                      </div>
                                      <div className="mt-2 text-xs text-gray-700 dark:text-gray-200">
                                        Action:{" "}
                                        <span className="font-semibold">
                                          Place LIMIT order
                                        </span>
                                        <br />
                                        Side:{" "}
                                        <span className="font-semibold">
                                          {getMarketSideNames(
                                            selectedOpp,
                                            yesVenue === "Polymarket"
                                              ? "polymarket"
                                              : "kalshi",
                                            tradeDetails.polySide === "yes"
                                              ? "yes"
                                              : "no"
                                          )}
                                        </span>
                                        <br />
                                        Quantity:{" "}
                                        <span className="font-semibold">
                                          {yesShares.toFixed(0)} shares
                                        </span>
                                        <br />
                                        Limit price:{" "}
                                        <span className="font-semibold">
                                          ${yesPrice.toFixed(3)}
                                        </span>
                                      </div>
                                    </div>
                                    <a
                                      href={yesLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 transition-all duration-200 shadow-lg hover:shadow-xl"
                                    >
                                      <span>Open {yesVenue}</span>
                                    </a>
                                  </div>
                                </div>

                                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-2 border-blue-200 dark:border-blue-800 p-5 shadow-lg hover:shadow-xl transition-all duration-300">
                                  <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-full blur-xl"></div>
                                  <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-3">
                                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
                                        {noVenue === "Polymarket" ? "P" : "K"}
                                      </div>
                                      <div>
                                        <div className="font-bold text-gray-900 dark:text-white">
                                          {noVenue}
                                        </div>
                                        <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                          Buy{" "}
                                          {getMarketSideNames(
                                            selectedOpp,
                                            noVenue === "Polymarket"
                                              ? "polymarket"
                                              : "kalshi",
                                            tradeDetails.kalshiSide === "yes"
                                              ? "yes"
                                              : "no"
                                          )}{" "}
                                          @ ${noPrice.toFixed(3)}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="mb-3">
                                      <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                                        {noShares.toFixed(0)}
                                      </div>
                                      <div className="text-sm text-gray-600 dark:text-gray-300">
                                        shares • Cost: $
                                        {(noVenue === "Polymarket"
                                          ? polyAmt
                                          : kalshiAmt
                                        ).toFixed(2)}
                                      </div>
                                      <div className="mt-2 text-xs text-gray-700 dark:text-gray-200">
                                        Action:{" "}
                                        <span className="font-semibold">
                                          Place LIMIT order
                                        </span>
                                        <br />
                                        Side:{" "}
                                        <span className="font-semibold">
                                          {getMarketSideNames(
                                            selectedOpp,
                                            noVenue === "Polymarket"
                                              ? "polymarket"
                                              : "kalshi",
                                            tradeDetails.kalshiSide === "yes"
                                              ? "yes"
                                              : "no"
                                          )}
                                        </span>
                                        <br />
                                        Quantity:{" "}
                                        <span className="font-semibold">
                                          {noShares.toFixed(0)} shares
                                        </span>
                                        <br />
                                        Limit price:{" "}
                                        <span className="font-semibold">
                                          ${noPrice.toFixed(3)}
                                        </span>
                                      </div>
                                    </div>
                                    <a
                                      href={noLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-4 py-2 rounded-lg font-medium hover:from-blue-600 hover:to-cyan-600 transition-all duration-200 shadow-lg hover:shadow-xl"
                                    >
                                      <span>Open {noVenue}</span>
                                    </a>
                                  </div>
                                </div>
                              </div>
                            </>
                          );
                        })()}

                        {/* Enhanced Slider */}

                        <div className="bg-white/70 dark:bg-gray-800/70 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              ⚖️ Adjust Trade Size
                            </span>
                            <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                              {Math.round(tradeScale * 100)}%
                            </div>
                          </div>
                          <div className="relative">
                            <input
                              type="range"
                              min={10}
                              max={100}
                              step={5}
                              value={tradeScale * 100}
                              onChange={(e) =>
                                setTradeScale(Number(e.target.value) / 100)
                              }
                              className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider-green"
                            />
                            <style jsx>{`
                              .slider-green::-webkit-slider-thumb {
                                appearance: none;
                                height: 20px;
                                width: 20px;
                                border-radius: 50%;
                                background: linear-gradient(
                                  45deg,
                                  #10b981,
                                  #059669
                                );
                                cursor: pointer;
                                box-shadow: 0 4px 8px rgba(16, 185, 129, 0.3);
                                border: 2px solid white;
                              }
                              .slider-green::-webkit-slider-track {
                                height: 12px;
                                border-radius: 6px;
                                background: linear-gradient(
                                  90deg,
                                  #d1fae5 0%,
                                  #10b981 ${tradeScale * 100}%,
                                  #e5e7eb ${tradeScale * 100}%,
                                  #e5e7eb 100%
                                );
                              }
                              .slider-green::-moz-range-thumb {
                                height: 20px;
                                width: 20px;
                                border-radius: 50%;
                                background: linear-gradient(
                                  45deg,
                                  #10b981,
                                  #059669
                                );
                                cursor: pointer;
                                box-shadow: 0 4px 8px rgba(16, 185, 129, 0.3);
                                border: 2px solid white;
                              }
                            `}</style>
                          </div>
                          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
                            <span>10%</span>
                            <span className="font-medium">
                              Capital: $
                              {Math.round(
                                getTotalCost(selectedOpp) * tradeScale
                              )}
                            </span>
                            <span>100%</span>
                          </div>
                        </div>

                        {selectedOpp && unlockedOppIds.has(selectedOpp.id) && (
                          <div className="pt-2 space-y-3">
                            {(() => {
                              const existingTrade = getExistingTrade(
                                selectedOpp.id
                              );
                              return existingTrade ? (
                                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-3">
                                  <div className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
                                    ⚠️ Trade Already in Portfolio
                                  </div>
                                  <div className="text-xs text-amber-700 dark:text-amber-300">
                                    You executed this trade on{" "}
                                    {new Date(
                                      existingTrade.timestamp
                                    ).toLocaleDateString()}
                                    with ${existingTrade.capital.toFixed(2)}{" "}
                                    capital. Expected profit: $
                                    {existingTrade.expectedProfit.toFixed(2)}
                                  </div>
                                </div>
                              ) : null;
                            })()}
                          </div>
                        )}

                        <div className="flex justify-between gap-3 pt-2">
                          <Dialog.Close asChild>
                            <Button
                              variant="outline"
                              className="flex-1 border-2 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 font-medium"
                            >
                              Cancel
                            </Button>
                          </Dialog.Close>
                          {selectedOpp && unlockedOppIds.has(selectedOpp.id) ? (
                            <Button
                              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                              onClick={saveExecutedTrade}
                              disabled={
                                !polyExecuted ||
                                !kalshiExecuted ||
                                (polyAmount !== "" &&
                                  parseFloat(polyAmount) <= 0) ||
                                (kalshiAmount !== "" &&
                                  parseFloat(kalshiAmount) <= 0) ||
                                manualTrades.some(
                                  (t) =>
                                    t.opportunityId === selectedOpp.id &&
                                    t.status === "open"
                                )
                              }
                            >
                              {selectedOpp && getExistingTrade(selectedOpp.id)
                                ? "Trade Already in Portfolio"
                                : "Save Trade to Portfolio"}
                            </Button>
                          ) : (
                            <Button
                              className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                              onClick={executeManualTrade}
                              disabled={!connected || !walletAddress}
                            >
                              Unlock Trade Details ($0.01 USDC)
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
                <Dialog.Close asChild>
                  <button
                    aria-label="Close"
                    className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted"
                    onClick={() => setTradeDetailsOpen(false)}
                  >
                    ✕
                  </button>
                </Dialog.Close>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>

          {/* Your Trades */}
          {manualTrades.length > 0 && (
            <div className="mt-8 grid md:grid-cols-2 gap-4">
              <Card className="glass">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Open Trades
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {manualTrades.filter((t) => t.status === "open").length ===
                  0 ? (
                    <div className="text-sm text-muted-foreground">
                      No open trades
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {manualTrades
                        .filter((t) => t.status === "open")
                        .map((t) => (
                          <div key={t.tradeId} className="border rounded p-3">
                            <div className="flex items-center justify-between">
                              <div className="font-medium truncate mr-2">
                                {t.marketTitle}
                              </div>
                              <Badge>Open</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Placed {new Date(t.timestamp).toLocaleString()} •{" "}
                              {Math.round(t.scale * 100)}% size
                            </div>
                            <div className="text-xs mt-1">
                              Capital ${t.capital} • Expected Profit $
                              {t.expectedProfit.toFixed(2)}
                            </div>
                            <div className="text-xs mt-1">
                              {t.yesVenue} Yes: {t.yesShares} @ $
                              {t.yesPrice.toFixed(2)} • {t.noVenue} No:{" "}
                              {t.noShares} @ ${t.noPrice.toFixed(2)}
                            </div>
                            <div className="mt-2 flex justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => markTradeSettled(t.tradeId)}
                              >
                                Mark settled
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className="glass">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Trade History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {manualTrades.filter((t) => t.status === "closed").length ===
                  0 ? (
                    <div className="text-sm text-muted-foreground">
                      No past trades
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {manualTrades
                        .filter((t) => t.status === "closed")
                        .map((t) => (
                          <div key={t.tradeId} className="border rounded p-3">
                            <div className="flex items-center justify-between">
                              <div className="font-medium truncate mr-2">
                                {t.marketTitle}
                              </div>
                              <Badge variant="secondary">Settled</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Placed {new Date(t.timestamp).toLocaleString()} •{" "}
                              {Math.round(t.scale * 100)}% size
                            </div>
                            <div className="text-xs mt-1">
                              Capital ${t.capital} • Expected Profit $
                              {t.expectedProfit.toFixed(2)}
                            </div>
                            <div className="text-xs mt-1">
                              {t.yesVenue} Yes: {t.yesShares} @ $
                              {t.yesPrice.toFixed(2)} • {t.noVenue} No:{" "}
                              {t.noShares} @ ${t.noPrice.toFixed(2)}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Auto Executions */}
          {autoExecutions.length > 0 && (
            <div className="mt-8">
              <Card className="glass">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Auto Executions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {autoExecutions.map((a) => (
                      <div key={a.tradeId} className="border rounded p-3">
                        <div className="flex items-center justify-between">
                          <div className="font-medium truncate mr-2">
                            {a.marketTitle}
                          </div>
                          <Badge variant="secondary">Completed</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Executed {new Date(a.timestamp).toLocaleString()}
                          {typeof a.netProfit === "number" && (
                            <span className="ml-2 text-green-600">
                              Net ${a.netProfit.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
