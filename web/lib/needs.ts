// The 11 Roster Needs measures: labels and how to show each team value.
// Keys match marts.mart_team_needs.need and the percentile columns in marts.mart_player_needs.

export type NeedKey =
  | "three_pt" | "rim_finishing" | "ball_security" | "off_rebounding" | "ft_rate" | "playmaking"
  | "rim_protection" | "perimeter_d" | "def_rebounding" | "transition_d" | "forcing_tov";

const pct1 = (v: number) => `${(v * 100).toFixed(1)}%`;
const dec3 = (v: number) => v.toFixed(3).replace(/^0/, "");
const one = (v: number) => v.toFixed(1);

export const NEEDS: Record<NeedKey, {
  label: string;
  /** Column header in the heatmap */
  short: string;
  side: "Offense" | "Defense";
  /** The team's value, e.g. "22.3%" */
  fmt: (v: number) => string;
  /** What the value is, for captions and tooltips */
  unit: string;
}> = {
  three_pt: { label: "3-point shooting", short: "3PT", side: "Offense", fmt: one, unit: "threes made per 100 shots" },
  rim_finishing: { label: "Rim finishing", short: "Rim fin", side: "Offense", fmt: pct1, unit: "FG% in the restricted area" },
  ball_security: { label: "Ball security", short: "Ball sec", side: "Offense", fmt: one, unit: "turnovers per 100 possessions" },
  off_rebounding: { label: "Offensive rebounding", short: "Off reb", side: "Offense", fmt: pct1, unit: "of their own misses rebounded" },
  ft_rate: { label: "Free throw rate", short: "FT rate", side: "Offense", fmt: dec3, unit: "free throws per shot" },
  playmaking: { label: "Playmaking", short: "Playmaking", side: "Offense", fmt: pct1, unit: "of baskets assisted" },
  rim_protection: { label: "Rim protection", short: "Rim prot", side: "Defense", fmt: pct1, unit: "opponent FG% at the rim" },
  perimeter_d: { label: "Perimeter defense", short: "Perim D", side: "Defense", fmt: pct1, unit: "opponent 3P%" },
  def_rebounding: { label: "Defensive rebounding", short: "Def reb", side: "Defense", fmt: pct1, unit: "of opponent misses rebounded" },
  transition_d: { label: "Transition defense", short: "Transition", side: "Defense", fmt: one, unit: "fast-break points allowed a game" },
  forcing_tov: { label: "Forcing turnovers", short: "Force TO", side: "Defense", fmt: one, unit: "opponent turnovers per 100 possessions" },
};

export const NEED_ORDER = Object.keys(NEEDS) as NeedKey[];

/** "Offensive rebounding" -> "offensive rebounding", for use mid-sentence */
export const lower = (k: NeedKey) => NEEDS[k].label.charAt(0).toLowerCase() + NEEDS[k].label.slice(1);
