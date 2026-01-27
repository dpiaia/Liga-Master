
import { Team, Match, TournamentRules, TournamentFormat, DecisionLog } from "../types";

export function generateFixtures(rules: TournamentRules, teams: Team[]): { matches: Match[], logs: DecisionLog[] } {
  const matches: Match[] = [];
  const logs: DecisionLog[] = [];

  // 1. Check for Custom Fixtures first
  if (rules.customFixtures && rules.customFixtures.length > 0) {
    rules.customFixtures.forEach((cf, idx) => {
      const home = teams.find(t => t.name.toLowerCase() === cf.homeTeamName.toLowerCase());
      const away = teams.find(t => t.name.toLowerCase() === cf.awayTeamName.toLowerCase());

      if (home && away) {
        matches.push({
          id: `custom-${idx}`,
          homeTeamId: home.id,
          awayTeamId: away.id,
          round: cf.round,
          phase: 'Personalizada',
          isCompleted: false
        });
      } else {
        logs.push({
          timestamp: new Date().toISOString(),
          action: 'GEN_WARN',
          reason: `Não foi possível encontrar times para o confronto: ${cf.homeTeamName} vs ${cf.awayTeamName}`,
          impact: 'Confronto ignorado.'
        });
      }
    });

    logs.push({
      timestamp: new Date().toISOString(),
      action: 'GEN_CUSTOM',
      reason: `Geração baseada em calendário manual fornecido pelo usuário.`,
      impact: `${matches.length} partidas personalizadas inseridas.`
    });

    return { matches, logs };
  }

  // 2. Standard Generation (Fallback)
  const n = teams.length;
  const teamList = [...teams];
  
  if (n % 2 !== 0) {
    teamList.push({ 
      id: 'ghost', 
      name: 'BYE', 
      colors: { primary: '#64748b', secondary: '#475569', accent: '#334155' },
      shield: '⏹️' 
    });
  }
  
  const totalTeams = teamList.length;
  const standardRounds = totalTeams - 1;
  const targetRounds = rules.rounds || (rules.hasReturnMatch ? standardRounds * 2 : standardRounds);
  
  const matchesPerRound = totalTeams / 2;

  for (let r = 0; r < targetRounds; r++) {
    const cycle = r % standardRounds;
    const isReturn = r >= standardRounds;

    for (let m = 0; m < matchesPerRound; m++) {
      const homeIdx = (cycle + m) % (totalTeams - 1);
      let awayIdx = (totalTeams - 1 - m + cycle) % (totalTeams - 1);
      if (m === 0) awayIdx = totalTeams - 1;

      const home = teamList[homeIdx];
      const away = teamList[awayIdx];

      if (home.id !== 'ghost' && away.id !== 'ghost') {
        matches.push({
          id: `r${r+1}-m${m+1}`,
          homeTeamId: isReturn ? away.id : home.id,
          awayTeamId: isReturn ? home.id : away.id,
          round: r + 1,
          phase: 'Temporada Regular',
          isCompleted: false
        });
      }
    }
  }

  logs.push({
    timestamp: new Date().toISOString(),
    action: 'GEN_AUTO',
    reason: `Geração automática para ${rules.format} com ${targetRounds} rodadas.`,
    impact: `${matches.length} partidas geradas.`
  });

  return { matches, logs };
}

export function calculateStandings(matches: Match[], teams: Team[], rules: TournamentRules) {
  const stats = teams.map(t => ({
    ...t,
    points: 0,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDiff: 0,
  }));

  const completed = matches.filter(m => m.isCompleted);

  completed.forEach(m => {
    const home = stats.find(s => s.id === m.homeTeamId);
    const away = stats.find(s => s.id === m.awayTeamId);
    if (!home || !away) return;

    const hs = m.homeScore || 0;
    const as = m.awayScore || 0;

    home.played++;
    away.played++;
    home.goalsFor += hs;
    home.goalsAgainst += as;
    away.goalsFor += as;
    away.goalsAgainst += hs;

    if (hs > as) {
      home.points += rules.pointsForWin;
      home.won++;
      away.lost++;
    } else if (as > hs) {
      away.points += rules.pointsForWin;
      away.won++;
      home.lost++;
    } else {
      home.points += rules.pointsForDraw;
      away.points += rules.pointsForDraw;
      home.drawn++;
      away.drawn++;
    }
  });

  const finalStats = stats.map(s => ({ ...s, goalDiff: s.goalsFor - s.goalsAgainst }));

  return finalStats.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    for (const criterion of rules.tieBreakerRules) {
      if (criterion === 'GOAL_DIFF') {
        if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
      }
      if (criterion === 'GOALS_FOR') {
        if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      }
      if (criterion === 'HEAD_TO_HEAD') {
        const h2hMatch = completed.find(m => 
          (m.homeTeamId === a.id && m.awayTeamId === b.id) || 
          (m.homeTeamId === b.id && m.awayTeamId === a.id)
        );
        if (h2hMatch) {
          const aIsHome = h2hMatch.homeTeamId === a.id;
          const aScore = aIsHome ? (h2hMatch.homeScore || 0) : (h2hMatch.awayScore || 0);
          const bScore = aIsHome ? (h2hMatch.awayScore || 0) : (h2hMatch.homeScore || 0);
          if (aScore !== bScore) return bScore - aScore;
        }
      }
    }
    return 0;
  });
}
