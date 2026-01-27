
export enum TournamentFormat {
  ROUND_ROBIN = 'ROUND_ROBIN',
  KNOCKOUT = 'KNOCKOUT',
  WORLD_CUP = 'WORLD_CUP',
  CHAMPIONS = 'CHAMPIONS',
  CUSTOM = 'CUSTOM'
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

export interface CustomFixture {
  round: number;
  homeTeamName: string;
  awayTeamName: string;
}

export interface TournamentRules {
  name: string;
  format: TournamentFormat;
  teamsCount: number;
  rounds?: number;
  groups?: number;
  teamsPerGroup?: number;
  hasReturnMatch: boolean;
  tieBreakerRules: string[];
  pointsForWin: number;
  pointsForDraw: number;
  pointsForLoss: number;
  customFixtures?: CustomFixture[];
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
