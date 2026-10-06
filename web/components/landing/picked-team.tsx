"use client";

import { createContext, useContext, useState } from "react";

/** One team on the landing page's dot chart. */
export type DotTeam = {
  abbr: string; full: string; nick: string; color: string;
  w: number; l: number; net: number; netRank: number; offRank: number; defRank: number;
};

type Picked = { team: DotTeam | null; pick: (t: DotTeam) => void };

const PickedTeam = createContext<Picked>({ team: null, pick: () => {} });

/** Shares the dot the visitor clicked, so the questions and buttons further down can name that team. */
export function PickedTeamProvider({ children }: { children: React.ReactNode }) {
  const [team, pick] = useState<DotTeam | null>(null);
  return <PickedTeam.Provider value={{ team, pick }}>{children}</PickedTeam.Provider>;
}

export const usePickedTeam = () => useContext(PickedTeam);
