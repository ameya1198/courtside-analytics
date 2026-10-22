-- Player Profile reads one player's shots across every season for its heatmap.
-- Without this index that is a scan of every shot, which can push the page past the 10s reader timeout.
create index if not exists shots_player_idx on raw.shots (player_id, season_type, season);
