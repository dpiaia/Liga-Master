
export enum TournamentFormat {
  ROUND_ROBIN = 'ROUND_ROBIN',
  KNOCKOUT = 'KNOCKOUT',
  LIGA_PLAYOFFS = 'LIGA_PLAYOFFS',
  GROUPS_PLAYOFFS = 'GROUPS_PLAYOFFS'
}

export interface TeamColors {
  primary: string;
  secondary: string;
  accent: string;
}

export interface Team {
  id: string;
  name: string;
  colors: TeamColors;
  shield: string; // Emoji ou identificador de ícone
  group?: string; // Grupo ao qual o time pertence (se aplicável)
}

export interface Match {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore?: number;
  awayScore?: number;
  round: number;
  group?: string;
  phase: string;
  isCompleted: boolean;
}

export interface TournamentRules {
  name: string;
  format: TournamentFormat;
  teamsCount: number;
  groupsCount?: number; // Nova propriedade para o formato de grupos
  rounds?: number;
  hasReturnMatch: boolean;
  playoffLegs: number; // 1 ou 2 jogos por fase de playoff
  finalLegs: number;   // 1 ou 2 jogos na final
  tieBreakerRules: string[];
  pointsForWin: number;
  pointsForDraw: number;
  pointsForLoss: number;
  startDate?: string;
}

export interface DecisionLog {
  timestamp: string;
  action: string;
  reason: string;
  impact: string;
}

export interface TournamentState {
  rules: TournamentRules;
  teams: Team[];
  matches: Match[];
  logs: DecisionLog[];
}
