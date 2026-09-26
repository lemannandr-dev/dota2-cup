-- Unique bracket slot per tournament (prevents duplicate match rows from concurrent bracket generation)
CREATE UNIQUE INDEX "Match_tournamentId_bracket_round_position_key" ON "Match"("tournamentId", "bracket", "round", "position");
