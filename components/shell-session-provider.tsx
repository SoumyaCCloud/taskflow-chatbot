'use client';

import { createContext, useContext, type ReactNode } from 'react';

/*
 * The session token arrives as a request header the root layout reads, but the
 * fetch that needs it happens in the client — this carries it across the
 * boundary once. It only ever travels back to our own origin
 * (`/api/agent`), which forwards it to the agent service.
 */
const SessionTokenContext = createContext<string>('');

export function useSessionToken(): string {
  return useContext(SessionTokenContext);
}

export function ShellSessionProvider({
  token,
  children,
}: {
  token: string;
  children: ReactNode;
}) {
  return (
    <SessionTokenContext.Provider value={token}>{children}</SessionTokenContext.Provider>
  );
}
