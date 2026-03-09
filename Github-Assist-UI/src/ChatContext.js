import React, { createContext, useContext, useMemo, useState } from "react";
 
const ChatContext = createContext(null);
 
export function ChatProvider({ children }) {
  const [isChatReady, setIsChatReady] = useState(false);
 
  const value = useMemo(() => ({ isChatReady, setIsChatReady }), [isChatReady]);
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
 
export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within <ChatProvider>");
  return ctx;
}