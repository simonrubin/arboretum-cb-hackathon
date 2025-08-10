"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RainbowButton } from "@/components/ui/rainbow-button";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background hero-bg relative">
      {/* Top Menu Bar */}
      <nav className="border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-20">
        <div className="container mx-auto px-4 py-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold">
                  🌳 Arboretum
                </span>
              </div>
              <RainbowButton
                onClick={() => (window.location.href = "/dashboard")}
              >
                Open App
              </RainbowButton>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-16 relative z-10">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="mb-6">
              <h1 className="text-6xl md:text-7xl font-black mb-4 leading-tight">
                🌳 Arboretum
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
                Autonomous arbitrage trading with micropayments and real-time execution
              </p>
            </div>
            <div className="flex gap-3 justify-center flex-wrap mb-8">
              <Badge variant="secondary" className="px-4 py-2 text-sm font-medium">
                X402 Protocol
              </Badge>
              <Badge variant="secondary" className="px-4 py-2 text-sm font-medium">
                CDP Integration
              </Badge>
              <Badge variant="secondary" className="px-4 py-2 text-sm font-medium">
                Base Sepolia
              </Badge>
              <Badge variant="secondary" className="px-4 py-2 text-sm font-medium">
                Real-time WebSockets
              </Badge>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-green-700 dark:text-green-300">
                  Live on Testnet
                </span>
              </div>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20">
            <div className="glass rounded-xl p-6 text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">Live</div>
              <div className="text-sm text-muted-foreground font-medium">
                Opportunities
              </div>
            </div>
            <div className="glass rounded-xl p-6 text-center">
              <div className="text-3xl font-bold mb-2">$25.50</div>
              <div className="text-sm text-muted-foreground font-medium">
                Avg Profit
              </div>
            </div>
            <div className="glass rounded-xl p-6 text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">&lt;50ms</div>
              <div className="text-sm text-muted-foreground font-medium">
                Latency
              </div>
            </div>
            <div className="glass rounded-xl p-6 text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">Base</div>
              <div className="text-sm text-muted-foreground font-medium">
                Network
              </div>
            </div>
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-2 gap-8 mb-16">
            <Card className="card-hover rounded-2xl p-8 glass">
              <div className="mb-4">
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                  <span className="text-2xl">🎯</span>
                </div>
                <CardTitle className="text-xl mb-2">Auto-Unlock System</CardTitle>
                <CardDescription className="text-base">
                  Trades unlock automatically when you have sufficient balance
                </CardDescription>
              </div>
              <CardContent className="p-0">
                <p className="text-muted-foreground leading-relaxed">
                  Set your risk limits once. When profitable opportunities arise
                  and you have enough funds, trades execute automatically without
                  manual intervention.
                </p>
              </CardContent>
            </Card>

            <Card className="card-hover rounded-2xl p-8 glass">
              <div className="mb-4">
                <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center mb-4">
                  <span className="text-2xl">💰</span>
                </div>
                <CardTitle className="text-xl mb-2">Pay-per-Trade</CardTitle>
                <CardDescription className="text-base">
                  $0.01 USDC execution fee + 5% profit share
                </CardDescription>
              </div>
              <CardContent className="p-0">
                <p className="text-muted-foreground leading-relaxed">
                  Only pay when trades are executed. No subscriptions, no
                  upfront costs. Built on X402 micropayments for seamless transactions.
                </p>
              </CardContent>
            </Card>

            <Card className="card-hover rounded-2xl p-8 glass">
              <div className="mb-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                  <span className="text-2xl">🔗</span>
                </div>
                <CardTitle className="text-xl mb-2">CDP Integration</CardTitle>
                <CardDescription className="text-base">
                  Seamless wallet connection and profit distribution
                </CardDescription>
              </div>
              <CardContent className="p-0">
                <p className="text-muted-foreground leading-relaxed">
                  Connect your Coinbase Wallet with one click. Profits
                  distributed automatically to your wallet using Coinbase's infrastructure.
                </p>
              </CardContent>
            </Card>

            <Card className="card-hover rounded-2xl p-8 glass">
              <div className="mb-4">
                <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-4">
                  <span className="text-2xl">⚡</span>
                </div>
                <CardTitle className="text-xl mb-2">Real-time Alerts</CardTitle>
                <CardDescription className="text-base">
                  WebSocket-powered arbitrage detection
                </CardDescription>
              </div>
              <CardContent className="p-0">
                <p className="text-muted-foreground leading-relaxed">
                  Get instant notifications when profitable arbitrage
                  opportunities are found across Polymarket and Kalshi markets.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Demo Status */}
          <div className="text-center mt-20">
            <div className="max-w-2xl mx-auto">
              <div className="glass rounded-3xl p-8 border-2 border-dashed border-green-200 dark:border-green-800">
                <div className="mb-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
                    <span className="text-3xl">🚀</span>
                  </div>
                </div>
                <h3 className="text-2xl font-bold mb-4">Ready for CodeNYC 2025</h3>
                <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                  Built with real X402 and CDP integrations on Base Sepolia testnet. 
                  Experience the future of autonomous arbitrage trading.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <Badge variant="outline" className="px-4 py-2">
                    ✅ X402 Payments
                  </Badge>
                  <Badge variant="outline" className="px-4 py-2">
                    ✅ CDP Wallet SDK
                  </Badge>
                  <Badge variant="outline" className="px-4 py-2">
                    ✅ Base Network
                  </Badge>
                  <Badge variant="outline" className="px-4 py-2">
                    ✅ Live Demo
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
