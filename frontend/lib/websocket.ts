/**
 * WebSocket client for real-time arbitrage alerts
 * Handles connection management, message parsing, and auto-reconnection
 */

export interface ArbitrageOpportunity {
  id: string
  sport: string
  polymarket_market: string
  kalshi_market: string
  polymarket_price: number
  kalshi_price: number
  estimated_profit: number
  required_capital: number
  confidence: number
  expires_at: string
  created_at: string
  time_remaining: number
}

export interface WebSocketMessage {
  type: string
  timestamp: string
  [key: string]: any
}

export interface OpportunityMessage extends WebSocketMessage {
  type: 'arbitrage_opportunity'
  opportunity: ArbitrageOpportunity
  status: 'auto_unlocked' | 'preview_only'
  eligibility?: {
    eligible: boolean
    reason?: string
    [key: string]: any
  }
  action_required: string
  message: string
}

export interface TradeExecutionMessage extends WebSocketMessage {
  type: 'trade_execution'
  status: 'started' | 'completed' | 'failed' | 'error'
  opportunity_id: string
  result?: {
    success: boolean
    gross_profit?: number
    execution_fee?: number
    platform_fee?: number
    net_profit?: number
    error?: string
  }
  message: string
}

export interface ProfitDistributionMessage extends WebSocketMessage {
  type: 'profit_distribution'
  status: 'completed' | 'failed'
  amount: number
  transaction_hash?: string
  message: string
}

type MessageHandler = (message: WebSocketMessage) => void
type OpportunityHandler = (message: OpportunityMessage) => void
type TradeHandler = (message: TradeExecutionMessage) => void
type ProfitHandler = (message: ProfitDistributionMessage) => void

export class ArboretumWebSocket {
  private ws: WebSocket | null = null
  private url: string
  private userId: number | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private isConnecting = false
  
  private messageHandlers: MessageHandler[] = []
  private opportunityHandlers: OpportunityHandler[] = []
  private tradeHandlers: TradeHandler[] = []
  private profitHandlers: ProfitHandler[] = []
  
  constructor(baseUrl: string = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000') {
    this.url = baseUrl
  }
  
  public async connect(userId?: number): Promise<void> {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return
    }
    
    this.isConnecting = true
    this.userId = userId || null
    
    const wsUrl = userId 
      ? `${this.url}/ws/opportunities?user_id=${userId}`
      : `${this.url}/ws/opportunities`
    
    try {
      this.ws = new WebSocket(wsUrl)
      
      this.ws.onopen = () => {
        console.log('WebSocket connected')
        this.isConnecting = false
        this.reconnectAttempts = 0
        
        // Subscribe to alerts if user is authenticated
        if (this.userId) {
          this.send({
            type: 'subscribe_alerts',
            user_id: this.userId
          })
        }
      }
      
      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          this.handleMessage(message)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }
      
      this.ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason)
        this.isConnecting = false
        this.ws = null
        
        // Attempt to reconnect if not intentionally closed
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect()
        }
      }
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        this.isConnecting = false
      }
      
    } catch (error) {
      console.error('Failed to connect WebSocket:', error)
      this.isConnecting = false
      throw error
    }
  }
  
  public disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect')
      this.ws = null
    }
    this.reconnectAttempts = this.maxReconnectAttempts // Prevent reconnection
  }
  
  public send(message: object): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket not connected, cannot send message:', message)
    }
  }
  
  public requestDemoOpportunity(): void {
    this.send({
      type: 'request_demo_opportunity'
    })
  }
  
  private handleMessage(message: WebSocketMessage): void {
    // Notify all general message handlers
    this.messageHandlers.forEach(handler => {
      try {
        handler(message)
      } catch (error) {
        console.error('Message handler error:', error)
      }
    })
    
    // Handle specific message types
    switch (message.type) {
      case 'arbitrage_opportunity':
        this.opportunityHandlers.forEach(handler => {
          try {
            handler(message as OpportunityMessage)
          } catch (error) {
            console.error('Opportunity handler error:', error)
          }
        })
        break
        
      case 'trade_execution':
        this.tradeHandlers.forEach(handler => {
          try {
            handler(message as TradeExecutionMessage)
          } catch (error) {
            console.error('Trade handler error:', error)
          }
        })
        break
        
      case 'profit_distribution':
        this.profitHandlers.forEach(handler => {
          try {
            handler(message as ProfitDistributionMessage)
          } catch (error) {
            console.error('Profit handler error:', error)
          }
        })
        break
        
      case 'ping':
        // Respond to keepalive ping
        this.send({ type: 'pong' })
        break
        
      case 'connected':
      case 'subscription_confirmed':
      case 'eligibility_status':
        console.log('WebSocket status:', message)
        break
        
      case 'error':
        console.error('WebSocket error message:', message)
        break
        
      default:
        console.log('Unknown message type:', message.type, message)
    }
  }
  
  private scheduleReconnect(): void {
    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1) // Exponential backoff
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
    
    setTimeout(() => {
      this.connect(this.userId || undefined)
    }, delay)
  }
  
  // Event handler registration methods
  public onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.push(handler)
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler)
    }
  }
  
  public onOpportunity(handler: OpportunityHandler): () => void {
    this.opportunityHandlers.push(handler)
    return () => {
      this.opportunityHandlers = this.opportunityHandlers.filter(h => h !== handler)
    }
  }
  
  public onTradeExecution(handler: TradeHandler): () => void {
    this.tradeHandlers.push(handler)
    return () => {
      this.tradeHandlers = this.tradeHandlers.filter(h => h !== handler)
    }
  }
  
  public onProfitDistribution(handler: ProfitHandler): () => void {
    this.profitHandlers.push(handler)
    return () => {
      this.profitHandlers = this.profitHandlers.filter(h => h !== handler)
    }
  }
  
  public get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }
  
  public get connectionState(): string {
    if (!this.ws) return 'disconnected'
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting'
      case WebSocket.OPEN: return 'connected'
      case WebSocket.CLOSING: return 'closing'
      case WebSocket.CLOSED: return 'closed'
      default: return 'unknown'
    }
  }
}

// Global WebSocket instance
export const arboretumWS = new ArboretumWebSocket()

// React hook for WebSocket integration
import { useState, useEffect, useCallback } from 'react'

export interface UseWebSocketReturn {
  isConnected: boolean
  connectionState: string
  connect: (userId?: number) => Promise<void>
  disconnect: () => void
  requestDemo: () => void
  opportunities: OpportunityMessage[]
  trades: TradeExecutionMessage[]
  profits: ProfitDistributionMessage[]
  clearHistory: () => void
}

export function useWebSocket(): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionState, setConnectionState] = useState('disconnected')
  const [opportunities, setOpportunities] = useState<OpportunityMessage[]>([])
  const [trades, setTrades] = useState<TradeExecutionMessage[]>([])
  const [profits, setProfits] = useState<ProfitDistributionMessage[]>([])
  
  // Update connection state periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setIsConnected(arboretumWS.isConnected)
      setConnectionState(arboretumWS.connectionState)
    }, 1000)
    
    return () => clearInterval(interval)
  }, [])
  
  // Set up event handlers
  useEffect(() => {
    const unsubscribes = [
      arboretumWS.onOpportunity((message) => {
        setOpportunities(prev => [message, ...prev.slice(0, 9)]) // Keep last 10
      }),
      
      arboretumWS.onTradeExecution((message) => {
        setTrades(prev => [message, ...prev.slice(0, 19)]) // Keep last 20
      }),
      
      arboretumWS.onProfitDistribution((message) => {
        setProfits(prev => [message, ...prev.slice(0, 19)]) // Keep last 20
      })
    ]
    
    return () => {
      unsubscribes.forEach(unsub => unsub())
    }
  }, [])
  
  const connect = useCallback(async (userId?: number) => {
    await arboretumWS.connect(userId)
  }, [])
  
  const disconnect = useCallback(() => {
    arboretumWS.disconnect()
  }, [])
  
  const requestDemo = useCallback(() => {
    arboretumWS.requestDemoOpportunity()
  }, [])
  
  const clearHistory = useCallback(() => {
    setOpportunities([])
    setTrades([])
    setProfits([])
  }, [])
  
  return {
    isConnected,
    connectionState,
    connect,
    disconnect,
    requestDemo,
    opportunities,
    trades,
    profits,
    clearHistory
  }
}