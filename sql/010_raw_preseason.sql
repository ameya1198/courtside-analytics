-- Preseason player game logs, kept apart from raw.player_game_logs on purpose: preseason minutes are not real
-- games (starters rest, coaches experiment), so nothing in the analysis reads this table. It only feeds the
-- "Preseason so far" box on Player Profile for rookies and new signings. Same columns as raw.player_game_logs.
create table if not exists raw.preseason_game_logs (like raw.player_game_logs including defaults);

create index if not exists preseason_game_logs_season_idx on raw.preseason_game_logs (season);

alter table raw.preseason_game_logs enable row level security;
