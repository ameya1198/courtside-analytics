export type TeamRow = {
  team_id: number; abbr: string; name: string; conf: string; w: number; l: number; gp?: number;
  ortg: number; drtg: number; net: number; pace: number; off_rank?: number; def_rank?: number;
  net_rank?: number; win_rank?: number;
};

export type LeagueData = {
  season: number; seasonLabel: string; seasons: number[];
  teams: TeamRow[];
  prev: { team_id: number; net: number }[];
  threeRate: { season: number; label: string; rate: number }[];
};

export type Factors = { efg: number; tov: number; orb: number; ftr: number };
export type Zone = { zone: string; share: number; fg: number; fga?: number };

export type TeamGame = {
  game_date: string; opp: string; home: boolean; win: boolean; pts: number; opp_pts: number;
  margin: number; b2b: boolean; days_rest: number | null;
};

export type TeamData = {
  season: number; seasonLabel: string; seasons: number[];
  teams: { abbr: string; name: string }[];
  team: TeamRow | null;
  factors: (Factors & { abbr: string; efg_rank: number; tov_rank: number; orb_rank: number; ftr_rank: number }) | null;
  leagueFactors: Factors;
  games: TeamGame[];
  zones: Zone[];
  leagueZones: Zone[];
  clutch?: Clutch | null;
};

export type Clutch = {
  games: number; w: number; l: number; win_pct: number | null; net: number | null;
  net_rank: number; win_rank: number; plus_minus: number; teams: number;
};

// [player_id, name, team, ppg, p36, ts]
// id, name, latest team, ppg, points per 36, true shooting, ranked (qualified) or not, every team that season
export type PoolRow = [number, string, string, number, number, number, boolean, string[]];

export type PlayerData = {
  season: number; seasonLabel: string; seasons: number[];
  minGames: number; qualifiedCount: number;
  pool: PoolRow[] | null;
  player: {
    player_id: number; name: string; team: string; team_id: number; gp: number; mpg: number; ppg: number;
    rpg: number; apg: number; spg: number; bpg: number; ts: number; fg3: number | null; p36: number;
  } | null;
  percentiles: { pts: number; reb: number; ast: number; stl: number; blk: number; ts: number; fg3: number; p36_rank: number } | null;
  lastGames: { game_date: string; opp: string; home: boolean; win: boolean; pts: number; reb: number; ast: number; min: number }[];
  shots: { total: number; rimFga: number; rimFgm: number; bins: [number, number, number, number][] };
  value?: { age: number | null; salary: number | null; fantasy_ppg: number; per_pt: number | null } | null;
  clutch?: { games: number; pts: number; ts: number | null; plus_minus: number; pts_rank: number; minutes: number } | null;
  /** On/off and defended shooting (mart_player_defense). Null when the player has no defense data. */
  defense?: {
    team: string; games: number; on_min: number; on_drtg: number | null; off_drtg: number | null; onoff_drtg: number | null;
    dfga: number | null; dfg_diff: number | null; dfga_rim: number | null; dfg_diff_rim: number | null; dfg_diff_three: number | null;
    qualified: boolean; onoff_pctile: number | null; dfg_pctile: number | null; contests_pctile: number | null; deflections_pctile: number | null;
  } | null;
};

// [player_id, name, team, age, salary, fantasy_ppg, pts_per_36, ts_pct, dollars_per_fantasy_pt, games]
export type ValueRow = [number, string, string, number | null, number, number, number, number, number, number];

export type ValueData = {
  season: number | null; seasonLabel: string | null; seasons: number[];
  qualifiedCount: number; pricedCount: number; medianSalary: number | null; medianProduction: number | null;
  players: ValueRow[];
  bargains: { player_id: number; player_name: string; team: string; salary: number; fantasy_ppg: number; per_pt: number }[];
  worst: { player_id: number; player_name: string; team: string; salary: number; fantasy_ppg: number; games: number; per_pt: number }[];
  leaders: { player_id: number; player_name: string; team: string; ppg: number; p36: number; ts: number; salary: number | null }[];
  ages: { age: number; players: number; fantasy_ppg: number }[];
};

export type RestData = {
  season: number; seasonLabel: string; seasons: number[]; historyFrom: number; historyTo: number;
  team?: { abbr: string; name: string } | null;
  buckets: { rest: number; games: number; win_pct: number; margin: number; league_win_pct?: number }[];
  gaps: { abbr: string; b2b_games: number; b2b_pct: number | null; rested_pct: number | null }[];
  months: [string, number, number][];
};

export type MatchupData = {
  season: number; seasonLabel: string; seasons: number[];
  teams: { abbr: string; name: string }[];
  a: TeamRow | null; b: TeamRow | null;
  factors: Record<string, Factors> | null;
  games: { game_date: string; phase: string; a_home: boolean; a_pts: number; b_pts: number }[];
  zones: (Zone & { abbr: string })[];
  clutch?: Record<string, { w: number; l: number; net: number | null; net_rank: number }> | null;
};

export type TonightGame = {
  id: string; label: string | null; tipUtc: string | null; status: string | null; final: boolean;
  away: string; awayPts: number | null; awayNet: number | null; awayRest: number | null; awayB2B: boolean;
  home: string; homePts: number | null; homeNet: number | null; homeRest: number | null; homeB2B: boolean;
  top: { name: string; team: string; pts: number; reb: number; ast: number } | null;
};

export type TonightData = {
  asked: string; today: string; date: string | null; isToday: boolean | null; isUpcoming: boolean | null;
  seasonType: string | null; ratingSeason: number | null;
  games: TonightGame[];
};

export type DefFactors = { opp_efg: number; forced_tov: number; dreb: number; opp_ftr: number };

export type DefensePlayer = {
  player_id: number; name: string; gp: number; mpg: number;
  stl36: number; blk36: number; dreb36: number; pf36: number; pm: number;
  // Phase 2 (mart_player_defense). Optional so older snapshots still type-check; null when not loaded.
  on_min?: number | null; on_drtg?: number | null; off_drtg?: number | null;
  /** Team defensive rating with him off minus with him on. Positive = the team defends better with him. */
  onoff_drtg?: number | null;
  /** Shots he defended, and opponent FG% on them minus what those shooters usually hit. Negative = good. */
  dfga?: number | null; dfg_diff?: number | null; dfg_diff_rim?: number | null; dfg_diff_three?: number | null;
  contests36?: number | null; deflections36?: number | null; salary?: number | null;
  /** 500+ on-court minutes and 20+ games for this team. */
  qualified?: boolean;
  onoff_pctile?: number | null; dfg_pctile?: number | null; contests_pctile?: number | null; deflections_pctile?: number | null;
};

/** Points allowed per game four ways, with league ranks (1 = fewest) and league averages. */
export type DefenseMisc = {
  off_tov: number; off_tov_rank: number; second_chance: number; second_chance_rank: number;
  fast_break: number; fast_break_rank: number; paint: number; paint_rank: number;
  league: { off_tov: number; second_chance: number; fast_break: number; paint: number };
};

export type DefenseData = {
  season: number; seasonLabel: string; seasons: number[];
  team: { team_id: number; abbr: string; name: string; gp: number; drtg: number; def_rank: number; opp_ppg: number; prev_drtg: number | null; prev_rank: number | null } | null;
  leagueDrtg: number;
  ranking: [string, number][];
  factors: (DefFactors & { abbr: string; opp_efg_rank: number; forced_tov_rank: number; dreb_rank: number; opp_ftr_rank: number }) | null;
  leagueFactors: DefFactors;
  // [date, opponent, defensive rating that game, won]
  games: [string, string, number, boolean][];
  // [opponent, games played against them]
  opponents: [string, number][];
  opponent: string | null;
  shotCount: number;
  zones: Zone[];
  compareZones: Zone[];
  bins: [number, number, number, number][];
  players: DefensePlayer[];
  misc?: DefenseMisc | null;
};
