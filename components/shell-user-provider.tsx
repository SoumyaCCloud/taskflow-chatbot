'use client';

import { createContext, useContext, type ReactNode } from 'react';

/*
 * The name arrives as a request header the root layout reads, but the chat tree
 * is a client component — this carries it across the boundary once instead of
 * threading a prop through every message. Initials and the greeting's first
 * name are both derived from it at the point of use.
 */
const UserNameContext = createContext<string>('');

export function useUserName(): string {
  return useContext(UserNameContext);
}

export function ShellUserProvider({
  name,
  children,
}: {
  name: string;
  children: ReactNode;
}) {
  return <UserNameContext.Provider value={name}>{children}</UserNameContext.Provider>;
}
