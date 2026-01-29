
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
      const groupName = String.fromCharCode(65 + i);
      const groupTeams = teamList.slice(i * teamsPerGroup, (i + 1) * teamsPerGroup);
      
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
    matches = generateKnockoutInitialPhase(teamList, "Mata-Mata");
    logs.push({
      timestamp: new Date().toISOString(),
      action: 'ESTRUTURA_COPA',
      reason: `Geração de chaves de eliminação direta.`,
      impact: `Primeira fase definida.`
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

function generateKnockoutInitialPhase(teams: Team[], phaseName: string): Match[] {
  const matches: Match[] = [];
  const matchesCount = Math.floor(teams.length / 2);
  for (let i = 0; i < matchesCount; i++) {
    matches.push({
      id: `k-${phaseName}-${i+1}`,
      homeTeamId: teams[i * 2].id,
      awayTeamId: teams[i * 2 + 1].id,
      round: 1,
      phase: phaseName,
      isCompleted: false
    });
  }
  return matches;
}

export function generatePlayoffsFromStandings(
  standings: any, 
  rules: TournamentRules, 
  currentMatches: Match[]
): { matches: Match[], logs: DecisionLog[] } {
  const newMatches: Match[] = [];
  const logs: DecisionLog[] = [];
  let qualifiedTeams: Team[] = [];

  if (rules.format === TournamentFormat.GROUPS_PLAYOFFS) {
    // Top 2 de cada grupo
    Object.entries(standings as Record<string, any[]>).forEach(([groupName, groupStats]) => {
      qualifiedTeams.push(...groupStats.slice(0, 2));
    });
  } else if (rules.format === TournamentFormat.LIGA_PLAYOFFS) {
    // Top 4 ou Top 8 dependendo do número de times
    const limit = rules.teamsCount >= 16 ? 8 : 4;
    qualifiedTeams = (standings as any[]).slice(0, limit);
  }

  if (qualifiedTeams.length < 2) {
    return { matches: [], logs: [{
      timestamp: new Date().toISOString(),
      action: 'PLAYOFFS_ERRO',
      reason: 'Equipes insuficientes para gerar playoffs.',
      impact: 'Nenhuma partida gerada.'
    }]};
  }

  // Lógica simples de cruzamento (1º vs Último, 2º vs Penúltimo) ou A1 vs B2
  const phaseName = qualifiedTeams.length === 2 ? "Final" : 
                    qualifiedTeams.length === 4 ? "Semifinal" : "Quartas de Final";
  
  const lastRound = Math.max(...currentMatches.map(m => m.round), 0);

  for (let i = 0; i < qualifiedTeams.length / 2; i++) {
    const home = qualifiedTeams[i];
    const away = qualifiedTeams[qualifiedTeams.length - 1 - i];
    
    const numLegs = phaseName === "Final" ? rules.finalLegs : rules.playoffLegs;

    for (let leg = 0; leg < numLegs; leg++) {
      newMatches.push({
        id: `playoff-${phaseName}-m${i+1}-leg${leg+1}`,
        homeTeamId: leg === 0 ? home.id : away.id,
        awayTeamId: leg === 0 ? away.id : home.id,
        round: lastRound + 1 + leg,
        phase: phaseName,
        isCompleted: false
      });
    }
  }

  logs.push({
    timestamp: new Date().toISOString(),
    action: 'PLAYOFFS_GERADOS',
    reason: `Geração automática da fase de ${phaseName}.`,
    impact: `${newMatches.length} partidas de eliminatórias adicionadas.`
  });

  return { matches: newMatches, logs };
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

  // Apenas computar standings para fases que não são mata-mata (simplificação)
  matches.filter(m => m.isCompleted && (m.phase.startsWith('Grupo') || m.phase === 'Fase de Liga')).forEach(m => {
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
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return 0;
  };

  const hasGroups = teams.some(t => t.group);
  if (hasGroups) {
    const groups = Array.from(new Set(teams.map(t => t.group).filter(Boolean)));
    const groupedResults: Record<string, typeof allStats> = {};
    groups.forEach(g => {
      groupedResults[g!] = allStats.filter(s => s.group === g).sort(sortFn);
    });
    return groupedResults;
  }

  return allStats.sort(sortFn);
}
