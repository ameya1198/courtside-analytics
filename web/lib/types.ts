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
};

// [player_id, name, team, ppg, p36, ts]
export type PoolRow = [number, string, string, number, number, number];

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
};

export type RestData = {
  season: number; seasonLabel: string; seasons: number[]; historyFrom: number; historyTo: number;
  buckets: { rest: number; games: number; win_pct: number; margin: number }[];
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
};

export type TonightData = {
  asked: string; date: string | null; isToday: boolean | null; seasonType: string | null;
  games: {
    away: string; awayPts: number; awayNet: number | null; home: string; homePts: number; homeNet: number | null;
    top: { name: string; team: string; pts: number; reb: number; ast: number };
  }[];
};
