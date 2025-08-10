/**
 * Coinbase Wallet SDK integration for Arboretum
 * Handles wallet connection, X402 payments, and user authentication
 */
import { CoinbaseWalletSDK } from '@coinbase/wallet-sdk'

// Initialize Coinbase Wallet SDK
const coinbaseWallet = new CoinbaseWalletSDK({
  appName: 'Arboretum',
  appLogoUrl: '/logo.png',
  darkMode: true,
})

const ethereum = coinbaseWallet.makeWeb3Provider()

export interface WalletState {
  isConnected: boolean
  address: string | null
  balance: number
  chainId: number | null
  isOnBase: boolean
}

export interface PaymentRequest {
  amount: string
  currency: 'USDC'
  recipient: string
  metadata?: Record<string, any>
}

export interface PaymentResult {
  success: boolean
  transactionHash?: string
  error?: string
}

export class ArboretumWallet {
  private provider: any
  private listeners: ((state: WalletState) => void)[] = []
  
  constructor() {
    this.provider = ethereum
    this.setupEventListeners()
  }
  
  private setupEventListeners() {
    if (this.provider) {
      this.provider.on('accountsChanged', this.handleAccountsChanged.bind(this))
      this.provider.on('chainChanged', this.handleChainChanged.bind(this))
      this.provider.on('disconnect', this.handleDisconnect.bind(this))
    }
  }
  
  private handleAccountsChanged(accounts: string[]) {
    this.notifyListeners()
  }
  
  private handleChainChanged(chainId: string) {
    this.notifyListeners()
  }
  
  private handleDisconnect() {
    this.notifyListeners()
  }
  
  private notifyListeners() {
    this.getWalletState().then(state => {
      this.listeners.forEach(listener => listener(state))
    })
  }
  
  public onStateChange(listener: (state: WalletState) => void) {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }
  
  public async connectWallet(): Promise<WalletState> {
    try {
      if (!this.provider) {
        throw new Error('Coinbase Wallet not available')
      }
      
      // Request account access
      const accounts = await this.provider.request({
        method: 'eth_requestAccounts'
      })
      
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned from wallet')
      }
      
      // Switch to Base Sepolia for demo
      await this.switchToBaseSepolia()
      
      const state = await this.getWalletState()
      this.notifyListeners()
      
      return state
      
    } catch (error) {
      console.error('Wallet connection failed:', error)
      throw error
    }
  }
  
  public async getWalletState(): Promise<WalletState> {
    try {
      if (!this.provider) {
        return {
          isConnected: false,
          address: null,
          balance: 0,
          chainId: null,
          isOnBase: false
        }
      }
      
      const accounts = await this.provider.request({ method: 'eth_accounts' })
      const chainId = await this.provider.request({ method: 'eth_chainId' })
      
      const isConnected = accounts && accounts.length > 0
      const address = isConnected ? accounts[0] : null
      const chainIdNumber = chainId ? parseInt(chainId, 16) : null
      const isOnBase = chainIdNumber === 84532 // Base Sepolia
      
      // Get USDC balance if connected
      let balance = 0
      if (isConnected && isOnBase) {
        balance = await this.getUSDCBalance(address)
      }
      
      return {
        isConnected,
        address,
        balance,
        chainId: chainIdNumber,
        isOnBase
      }
      
    } catch (error) {
      console.error('Failed to get wallet state:', error)
      return {
        isConnected: false,
        address: null,
        balance: 0,
        chainId: null,
        isOnBase: false
      }
    }
  }
  
  public async switchToBaseSepolia(): Promise<void> {
    try {
      // Base Sepolia chain parameters
      const baseSepoliaParams = {
        chainId: '0x14a34', // 84532 in hex
        chainName: 'Base Sepolia',
        nativeCurrency: {
          name: 'ETH',
          symbol: 'ETH',
          decimals: 18
        },
        rpcUrls: ['https://sepolia.base.org'],
        blockExplorerUrls: ['https://sepolia-explorer.base.org']
      }
      
      try {
        // Try to switch to Base Sepolia
        await this.provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: baseSepoliaParams.chainId }]
        })
      } catch (switchError: any) {
        // If chain doesn't exist, add it
        if (switchError.code === 4902) {
          await this.provider.request({
            method: 'wallet_addEthereumChain',
            params: [baseSepoliaParams]
          })
        } else {
          throw switchError
        }
      }
      
    } catch (error) {
      console.error('Failed to switch to Base Sepolia:', error)
      throw error
    }
  }
  
  public async getUSDCBalance(address: string): Promise<number> {
    try {
      // USDC contract address on Base Sepolia
      const usdcAddress = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
      
      // ERC-20 balanceOf function selector
      const balanceOfSelector = '0x70a08231'
      const paddedAddress = address.slice(2).padStart(64, '0')
      
      const result = await this.provider.request({
        method: 'eth_call',
        params: [
          {
            to: usdcAddress,
            data: balanceOfSelector + paddedAddress
          },
          'latest'
        ]
      })
      
      // Convert from hex to decimal and adjust for USDC decimals (6)
      const balance = parseInt(result, 16) / Math.pow(10, 6)
      return balance
      
    } catch (error) {
      console.error('Failed to get USDC balance:', error)
      return 0
    }
  }
  
  public async createX402Payment(paymentRequest: PaymentRequest): Promise<PaymentResult> {
    try {
      if (!this.provider) {
        throw new Error('Wallet not connected')
      }
      
      const state = await this.getWalletState()
      if (!state.isConnected || !state.address) {
        throw new Error('Wallet not connected')
      }
      
      if (!state.isOnBase) {
        await this.switchToBaseSepolia()
      }
      
      // Mock X402 payment for demo
      console.log('Mock X402 payment:', paymentRequest)
      
      return {
        success: true,
        transactionHash: `0x${Math.random().toString(16).slice(2)}`
      }
      
    } catch (error) {
      console.error('X402 payment failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment failed'
      }
    }
  }
  
  public async verifyPayment(transactionHash: string, expectedAmount: string): Promise<boolean> {
    try {
      // Mock verification for demo
      console.log('Mock payment verification:', { transactionHash, expectedAmount })
      return true
      
    } catch (error) {
      console.error('Payment verification failed:', error)
      return false
    }
  }
  
  public async disconnectWallet(): Promise<void> {
    try {
      if (this.provider && this.provider.disconnect) {
        await this.provider.disconnect()
      }
      this.notifyListeners()
    } catch (error) {
      console.error('Disconnect failed:', error)
    }
  }
}

// Global wallet instance
export const wallet = new ArboretumWallet()

// React hook for wallet state
import { useState, useEffect } from 'react'

export function useWallet() {
  const [walletState, setWalletState] = useState<WalletState>({
    isConnected: false,
    address: null,
    balance: 0,
    chainId: null,
    isOnBase: false
  })
  
  const [isLoading, setIsLoading] = useState(false)
  
  useEffect(() => {
    // Initial state load
    wallet.getWalletState().then(setWalletState)
    
    // Subscribe to state changes
    const unsubscribe = wallet.onStateChange(setWalletState)
    
    return unsubscribe
  }, [])
  
  const connect = async () => {
    setIsLoading(true)
    try {
      const state = await wallet.connectWallet()
      setWalletState(state)
    } catch (error) {
      console.error('Connection failed:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }
  
  const disconnect = async () => {
    await wallet.disconnectWallet()
  }
  
  const createPayment = async (request: PaymentRequest) => {
    return await wallet.createX402Payment(request)
  }
  
  const switchToBase = async () => {
    setIsLoading(true)
    try {
      await wallet.switchToBaseSepolia()
      const state = await wallet.getWalletState()
      setWalletState(state)
    } finally {
      setIsLoading(false)
    }
  }
  
  return {
    ...walletState,
    isLoading,
    connect,
    disconnect,
    createPayment,
    switchToBase
  }
}