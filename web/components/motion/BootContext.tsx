"use client";

import { createContext, useContext } from "react";

/** False while the boot sequence covers the page, so entrances wait for it instead of playing unseen. */
export const BootContext = createContext(true);

export function useBooted(): boolean {
  return useContext(BootContext);
}
