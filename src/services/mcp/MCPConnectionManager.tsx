import React, { type ReactNode, useContext, useMemo } from 'react';
import { useManageMCPConnections } from './useManageMCPConnections.js';
import { MCPConnectionContext, type MCPConnectionContextValue } from './MCPConnectionContext.js';
import type { ScopedMcpServerConfig } from './types.js';

export function useMcpReconnect() {
  const context = useContext(MCPConnectionContext);
  if (!context) {
    throw new Error('useMcpReconnect must be used within MCPConnectionManager');
  }
  return context.reconnectMcpServer;
}

export function useMcpToggleEnabled() {
  const context = useContext(MCPConnectionContext);
  if (!context) {
    throw new Error('useMcpToggleEnabled must be used within MCPConnectionManager');
  }
  return context.toggleMcpServer;
}

interface MCPConnectionManagerProps {
  children: ReactNode;
  dynamicMcpConfig: Record<string, ScopedMcpServerConfig> | undefined;
  isStrictMcpConfig: boolean;
}

// TODO (ollie): We may be able to get rid of this context by putting these function on app state
export function MCPConnectionManager({
  children,
  dynamicMcpConfig,
  isStrictMcpConfig,
}: MCPConnectionManagerProps): React.ReactNode {
  const { reconnectMcpServer, toggleMcpServer } = useManageMCPConnections(dynamicMcpConfig, isStrictMcpConfig);
  const value = useMemo<MCPConnectionContextValue>(
    () => ({ reconnectMcpServer, toggleMcpServer }),
    [reconnectMcpServer, toggleMcpServer],
  );

  return <MCPConnectionContext.Provider value={value}>{children}</MCPConnectionContext.Provider>;
}
