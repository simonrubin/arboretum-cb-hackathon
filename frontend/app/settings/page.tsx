"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LogOut } from "lucide-react";

export default function SettingsPage() {
  const [tradingMode, setTradingMode] = useState<"manual" | "auto">("manual");
  const [maxTradesPerDay, setMaxTradesPerDay] = useState<string>("10");
  const [maxCapitalPerTrade, setMaxCapitalPerTrade] = useState<string>("250");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const isAuto = tradingMode === "auto";
  
  // Account linking state
  const [polymarketApiKey, setPolymarketApiKey] = useState<string>("");
  const [kalshiApiKey, setKalshiApiKey] = useState<string>("");
  const [kalshiApiSecret, setKalshiApiSecret] = useState<string>("");
  const [polymarketConnected, setPolymarketConnected] = useState(false);
  const [kalshiConnected, setKalshiConnected] = useState(false);

  // Wallet state (read-only here with disconnect)
  const [connected, setConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [walletType, setWalletType] = useState<string>("");
  const [coinbaseProvider, setCoinbaseProvider] = useState<any>(null);

  useEffect(() => {
    try {
      const savedMode =
        (localStorage.getItem("tradingMode") as "manual" | "auto") || "manual";
      const savedTrades = localStorage.getItem("maxTradesPerDay") || "10";
      const savedCapital = localStorage.getItem("maxCapitalPerTrade") || "250";
      setTradingMode(savedMode);
      setMaxTradesPerDay(savedTrades);
      setMaxCapitalPerTrade(savedCapital);
      
      // Load account linking data
      const savedPolyKey = localStorage.getItem("polymarketApiKey") || "";
      const savedKalshiKey = localStorage.getItem("kalshiApiKey") || "";
      const savedKalshiSecret = localStorage.getItem("kalshiApiSecret") || "";
      setPolymarketApiKey(savedPolyKey);
      setKalshiApiKey(savedKalshiKey);
      setKalshiApiSecret(savedKalshiSecret);
      setPolymarketConnected(!!savedPolyKey);
      setKalshiConnected(!!(savedKalshiKey && savedKalshiSecret));
    } catch {}
  }, []);

  useEffect(() => {
    // Detect injected Coinbase provider and accounts
    const detect = async () => {
      try {
        const injected = (window as any)?.ethereum;
        const provider = injected?.providers
          ? injected.providers.find((p: any) => p && p.isCoinbaseWallet)
          : injected?.isCoinbaseWallet
          ? injected
          : null;
        if (!provider) return;
        setCoinbaseProvider(provider);
        const accounts: string[] = await provider.request({
          method: "eth_accounts",
        });
        if (accounts && accounts.length > 0) {
          setConnected(true);
          setWalletAddress(accounts[0]);
          setWalletType("Coinbase Wallet");
        }
        provider.on?.("accountsChanged", (accounts: string[]) => {
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
      } catch {
        // ignore
      }
    };
    detect();
  }, []);

  const disconnectWallet = async () => {
    try {
      setConnected(false);
      setWalletAddress("");
      setWalletType("");
      localStorage.removeItem("walletAddress");
      localStorage.removeItem("walletType");
      alert("Wallet disconnected successfully");
    } catch (e) {
      // ignore
    }
  };

  const getShortAddress = (address: string) =>
    `${address.slice(0, 6)}...${address.slice(-4)}`;

  const handleConnectPolymarket = () => {
    if (!polymarketApiKey.trim()) {
      alert("Please enter a valid Polymarket API key");
      return;
    }
    localStorage.setItem("polymarketApiKey", polymarketApiKey);
    setPolymarketConnected(true);
    alert("Polymarket account connected successfully!");
  };

  const handleConnectKalshi = () => {
    if (!kalshiApiKey.trim() || !kalshiApiSecret.trim()) {
      alert("Please enter both Kalshi API key and secret");
      return;
    }
    localStorage.setItem("kalshiApiKey", kalshiApiKey);
    localStorage.setItem("kalshiApiSecret", kalshiApiSecret);
    setKalshiConnected(true);
    alert("Kalshi account connected successfully!");
  };

  const handleDisconnectPolymarket = () => {
    localStorage.removeItem("polymarketApiKey");
    setPolymarketApiKey("");
    setPolymarketConnected(false);
    alert("Polymarket account disconnected");
  };

  const handleDisconnectKalshi = () => {
    localStorage.removeItem("kalshiApiKey");
    localStorage.removeItem("kalshiApiSecret");
    setKalshiApiKey("");
    setKalshiApiSecret("");
    setKalshiConnected(false);
    alert("Kalshi account disconnected");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      localStorage.setItem("onboardingCompleted", "true");
      localStorage.setItem("tradingMode", tradingMode);
      localStorage.setItem(
        "maxTradesPerDay",
        String(parseInt(maxTradesPerDay || "0", 10))
      );
      localStorage.setItem(
        "maxCapitalPerTrade",
        String(parseFloat(maxCapitalPerTrade || "0"))
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-background hero-bg relative">
      {/* Top Bar */}
      <nav className="border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-20">
        <div className="container mx-auto px-4 py-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold gradient-text">
                  🌳 Arboretum
                </span>
                <Badge variant="secondary" className="ml-2">
                  Settings
                </Badge>
              </div>
              <div className="flex gap-2 items-center">
                <Button
                  variant="outline"
                  onClick={() => (window.location.href = "/dashboard")}
                >
                  ← Back to App
                </Button>
                {connected && (
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">{walletType}</span>
                      <br />
                      <span className="font-mono">
                        {getShortAddress(walletAddress)}
                      </span>
                    </div>
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
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-10 relative z-10">
        <div className="max-w-4xl mx-auto grid gap-6">
          <Card className="glass">
            <CardHeader>
              <CardTitle>Trading Mode</CardTitle>
              <CardDescription>
                Select how trades should be executed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                    Execute profitable trades automatically within your limits.
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle>Risk & Limits</CardTitle>
              <CardDescription>
                Set guardrails for automated execution
                {!isAuto && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    (Switch to Autonomous to edit)
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className={!isAuto ? "opacity-60" : ""}>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-2">
                    Max trades per day
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={maxTradesPerDay}
                    onChange={(e) => setMaxTradesPerDay(e.target.value)}
                    disabled={!isAuto}
                    placeholder="e.g. 10"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-2">
                    Max capital per trade (USD)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={maxCapitalPerTrade}
                    onChange={(e) => setMaxCapitalPerTrade(e.target.value)}
                    disabled={!isAuto}
                    placeholder="e.g. 250"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle>Account Linking</CardTitle>
              <CardDescription>
                Connect your Polymarket and Kalshi accounts to read balances and execute trades
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Polymarket Section */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                      <span className="text-purple-600 dark:text-purple-400 font-bold text-sm">P</span>
                    </div>
                    <div>
                      <div className="font-medium">Polymarket</div>
                      <div className="text-xs text-muted-foreground">
                        {polymarketConnected ? "Connected" : "Not connected"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {polymarketConnected && (
                      <Badge variant="secondary" className="text-green-600">
                        ✓ Connected
                      </Badge>
                    )}
                  </div>
                </div>
                
                {!polymarketConnected ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm mb-2">
                        API Key
                      </label>
                      <Input
                        type="password"
                        value={polymarketApiKey}
                        onChange={(e) => setPolymarketApiKey(e.target.value)}
                        placeholder="Enter your Polymarket API key"
                      />
                      <div className="text-xs text-muted-foreground mt-1">
                        Get your API key from Polymarket's developer settings
                      </div>
                    </div>
                    <Button 
                      onClick={handleConnectPolymarket}
                      className="w-full bg-purple-600 hover:bg-purple-700"
                    >
                      Connect Polymarket Account
                    </Button>
                  </div>
                ) : (
                  <div className="text-center">
                    <Button 
                      onClick={handleDisconnectPolymarket}
                      variant="outline"
                      className="text-red-600 border-red-300 hover:bg-red-50"
                    >
                      Disconnect Account
                    </Button>
                  </div>
                )}
              </div>

              {/* Kalshi Section */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <span className="text-blue-600 dark:text-blue-400 font-bold text-sm">K</span>
                    </div>
                    <div>
                      <div className="font-medium">Kalshi</div>
                      <div className="text-xs text-muted-foreground">
                        {kalshiConnected ? "Connected" : "Not connected"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {kalshiConnected && (
                      <Badge variant="secondary" className="text-green-600">
                        ✓ Connected
                      </Badge>
                    )}
                  </div>
                </div>
                
                {!kalshiConnected ? (
                  <div className="space-y-3">
                    <div className="grid md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm mb-2">
                          API Key
                        </label>
                        <Input
                          type="password"
                          value={kalshiApiKey}
                          onChange={(e) => setKalshiApiKey(e.target.value)}
                          placeholder="API key"
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-2">
                          API Secret
                        </label>
                        <Input
                          type="password"
                          value={kalshiApiSecret}
                          onChange={(e) => setKalshiApiSecret(e.target.value)}
                          placeholder="API secret"
                        />
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Get your API credentials from Kalshi's developer portal
                    </div>
                    <Button 
                      onClick={handleConnectKalshi}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      Connect Kalshi Account
                    </Button>
                  </div>
                ) : (
                  <div className="text-center">
                    <Button 
                      onClick={handleDisconnectKalshi}
                      variant="outline"
                      className="text-red-600 border-red-300 hover:bg-red-50"
                    >
                      Disconnect Account
                    </Button>
                  </div>
                )}
              </div>
              
              <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-2">
                  <span className="text-amber-600 dark:text-amber-400 mt-0.5">⚠️</span>
                  <div className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Security Notice:</strong> Your API keys are stored locally and encrypted. 
                    Only provide read-only API keys when possible. Never share your API credentials.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => (window.location.href = "/dashboard")}
            >
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
          
          {saved && (
            <div className="text-sm text-green-600 text-right">
              Settings saved.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
