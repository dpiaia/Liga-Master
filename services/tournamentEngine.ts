
import { Team, Match, TournamentRules, TournamentFormat, DecisionLog } from "../types";

export function generateFixtures(rules: TournamentRules, teams: Team[]): { matches: Match[], logs: DecisionLog[] } {
  let matches: Match[] = [];
  const logs: DecisionLog[] = [];
  const teamList = [...teams];

  if (rules.format === TournamentFormat.GROUPS_PLAYOFFS && rules.groupsCount) {
    const numGroups = rules.groupsCount;
    const teamsPerGroup = Math.ceil(teamList.length / numGroups);
    
    logs.push({
      timestamp: new Date().toISOString(),
      action: 'DIVISAO_GRUPOS',
      reason: `Torneio de grupos selecionado com ${numGroups} grupos.`,
      impact: `Aproximadamente ${teamsPerGroup} equipes por grupo.`
    });

    for (let i = 0; i < numGroups; i++) {
      const groupName = String.fromCharCode(65 + i); // A, B, C...
      const groupTeams = teamList.slice(i * teamsPerGroup, (i + 1) * teamsPerGroup);
      
      // Aplicar Round Robin dentro do grupo
      const groupFixtures = generateRoundRobin(groupTeams, rules, groupName);
      matches = [...matches, ...groupFixtures];
      
      logs.push({
        timestamp: new Date().toISOString(),
        action: 'GERACAO_CONFRONTOS',
        reason: `Fase de grupos do Grupo ${groupName} gerada.`,
        impact: `${groupFixtures.length} partidas adicionadas para o Grupo ${groupName}.`
      });
    }
  } else if (rules.format === TournamentFormat.ROUND_ROBIN || rules.format === TournamentFormat.LIGA_PLAYOFFS) {
    matches = generateRoundRobin(teamList, rules);
    logs.push({
      timestamp: new Date().toISOString(),
      action: 'ESTRUTURA_LIGA',
      reason: `Geração de campeonato tipo ${rules.format}.`,
      impact: `${matches.length} partidas organizadas no calendário.`
    });
  } else if (rules.format === TournamentFormat.KNOCKOUT) {
    const matchesCount = Math.floor(teamList.length / 2);
    for (let i = 0; i < matchesCount; i++) {
      matches.push({
        id: `k-r1-m${i+1}`,
        homeTeamId: teamList[i * 2].id,
        awayTeamId: teamList[i * 2 + 1].id,
        round: 1,
        phase: 'Oitavas/Quartas de Final',
        isCompleted: false
      });
    }
    logs.push({
      timestamp: new Date().toISOString(),
      action: 'ESTRUTURA_COPA',
      reason: `Geração de chaves de eliminação direta.`,
      impact: `Primeira fase com ${matchesCount} confrontos definida.`
    });
  }

  return { matches, logs };
}

function generateRoundRobin(teams: Team[], rules: TournamentRules, groupName?: string): Match[] {
  const matches: Match[] = [];
  const teamList = [...teams];
  const n = teamList.length;

  if (n < 2) return [];

  if (n % 2 !== 0) {
    teamList.push({ 
      id: 'ghost', 
      name: 'Folga', 
      colors: { primary: '#64748b', secondary: '#475569', accent: '#334155' },
      shield: '⏹️' 
    });
  }

  const totalTeams = teamList.length;
  const standardRounds = totalTeams - 1;
  const targetRounds = rules.hasReturnMatch ? standardRounds * 2 : standardRounds;
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
          id: `${groupName || 'L'}-r${r+1}-m${m+1}-${home.id}-${away.id}`,
          homeTeamId: isReturn ? away.id : home.id,
          awayTeamId: isReturn ? home.id : away.id,
          round: r + 1,
          group: groupName,
          phase: groupName ? `Grupo ${groupName}` : 'Fase de Liga',
          isCompleted: false
        });
      }
    }
  }
  return matches;
}

export function calculateStandings(matches: Match[], teams: Team[], rules: TournamentRules) {
  const statsMap = new Map(teams.map(t => [t.id, {
    ...t,
    points: 0,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDiff: 0,
  }]));

  matches.filter(m => m.isCompleted).forEach(m => {
    const home = statsMap.get(m.homeTeamId);
    const away = statsMap.get(m.awayTeamId);
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

  const allStats = Array.from(statsMap.values()).map(s => ({ ...s, goalDiff: s.goalsFor - s.goalsAgainst }));

  const sortFn = (a: any, b: any) => {
    if (b.points !== a.points) return b.points - a.points;
    for (const criterion of rules.tieBreakerRules) {
      if (criterion === 'GOAL_DIFF') {
        if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
      }
      if (criterion === 'GOALS_FOR') {
        if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      }
    }
    return 0;
  };

  // Se houver grupos, retornar um objeto com as tabelas separadas
  const groups = Array.from(new Set(teams.map(t => t.group).filter(Boolean)));
  if (groups.length > 0) {
    const groupedResults: Record<string, typeof allStats> = {};
    groups.forEach(g => {
      groupedResults[g!] = allStats.filter(s => s.group === g).sort(sortFn);
    });
    return groupedResults;
  }

  return allStats.sort(sortFn);
}
