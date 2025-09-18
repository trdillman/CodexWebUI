import { createContext, useContext } from "react";

export const LobeContext = createContext(null);

export function useLobeSettings() {
  const ctx = useContext(LobeContext);
  if (!ctx) {
    throw new Error("useLobeSettings must be used within a LobeProvider");
  }
  return ctx;
}
