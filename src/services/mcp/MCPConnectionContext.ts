/**
 * Isolated React context for MCPConnectionManager.
 *
 * Kept dependency-light so Vite/Rollup cannot duplicate this context across
 * chunks (REPL inlines the provider while /mcp UI imports hooks from a
 * separate chunk — mismatched contexts crash with
 * "useMcpReconnect must be used within MCPConnectionManager").
 */
import { createContext } from 'react'
import type { Command } from '../../commands.js'
import type { Tool } from '../../Tool.js'
import type { MCPServerConnection, ServerResource } from './types.js'

export type MCPConnectionContextValue = {
  reconnectMcpServer: (serverName: string) => Promise<{
    client: MCPServerConnection
    tools: Tool[]
    commands: Command[]
    resources?: ServerResource[]
  }>
  toggleMcpServer: (serverName: string) => Promise<void>
}

export const MCPConnectionContext =
  createContext<MCPConnectionContextValue | null>(null)
