
import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Users, 
  Calendar, 
  ChevronRight, 
  ArrowRight, 
  ArrowLeft, 
  LayoutGrid, 
  GitBranch, 
  Layers, 
  Zap, 
  Edit2, 
  CheckCircle2,
  Settings2,
  Info,
  Palette,
  Target,
  Grid,
  Play
} from 'lucide-react';
import { Team, TournamentRules, TournamentState, TournamentFormat, Match } from './types';
import { generateFixtures, calculateStandings, generatePlayoffsFromStandings } from './services/tournamentEngine';

const COLOR_PRESETS = [
  '#ef4444', '#f97316', '#f59e0b', '#10b981', 
  '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', 
  '#ec4899', '#ffffff', '#000000'
];

const SHIELD_EMOJIS = ['🛡️', '🦁', '🦅', '🐺', '⭐', '🔥', '⚓', '⚡', '🐉', '⚽', '🐯', '🐂', '🐍', '🐙'];

const App: React.FC = () => {
  const [view, setView] = useState<'landing' | 'wizard' | 'app'>('landing');
  const [wizardStep, setWizardStep] = useState(1);
  
  // Wizard States
  const [tournamentName, setTournamentName] = useState('');
  const [format, setFormat] = useState<TournamentFormat>(TournamentFormat.ROUND_ROBIN);
  const [teamsCount, setTeamsCount] = useState(8);
  const [groupsCount, setGroupsCount] = useState(2);
  const [teams, setTeams] = useState<Team[]>([]);
  const [hasReturnMatch, setHasReturnMatch] = useState(true);
  const [playoffLegs, setPlayoffLegs] = useState(2);
  const [finalLegs, setFinalLegs] = useState(1);
  const [pointsRules] = useState({ win: 3, draw: 1, loss: 0 });

  // App States
  const [state, setState] = useState<TournamentState | null>(null);
  const [activeTab, setActiveTab] = useState<'matches' | 'table' | 'setup'>('matches');

  // Initialize teams when wizard reaches Step 5
  useEffect(() => {
    if (wizardStep === 5 && teams.length !== teamsCount) {
      const newTeams: Team[] = Array.from({ length: teamsCount }).map((_, i) => {
        let groupName = undefined;
        if (format === TournamentFormat.GROUPS_PLAYOFFS) {
          const teamsPerGroup = Math.ceil(teamsCount / groupsCount);
          groupName = String.fromCharCode(65 + Math.floor(i / teamsPerGroup));
        }
        
        return {
          id: `team-${i + 1}`,
          name: teams[i]?.name || `Time ${i + 1}`,
          shield: teams[i]?.shield || SHIELD_EMOJIS[i % SHIELD_EMOJIS.length],
          group: groupName,
          colors: teams[i]?.colors || { 
            primary: COLOR_PRESETS[i % COLOR_PRESETS.length], 
            secondary: '#ffffff', 
            accent: '#000000' 
          }
        };
      });
      setTeams(newTeams);
    }
  }, [wizardStep, teamsCount, groupsCount, format]);

  const handleGenerateTournament = () => {
    const rules: TournamentRules = {
      name: tournamentName,
      format: format,
      teamsCount: teamsCount,
      groupsCount: format === TournamentFormat.GROUPS_PLAYOFFS ? groupsCount : undefined,
      hasReturnMatch: hasReturnMatch,
      playoffLegs: playoffLegs,
      finalLegs: finalLegs,
      pointsForWin: pointsRules.win,
      pointsForDraw: pointsRules.draw,
      pointsForLoss: pointsRules.loss,
      tieBreakerRules: ['GOAL_DIFF', 'GOALS_FOR']
    };

    const { matches, logs } = generateFixtures(rules, teams);
    
    setState({
      rules,
      teams,
      matches,
      logs
    });
    setView('app');
    setActiveTab('matches');
  };

  const handleStartPlayoffs = () => {
    if (!state || !standings) return;
    
    const { matches: playoffMatches, logs: playoffLogs } = generatePlayoffsFromStandings(
      standings, 
      state.rules, 
      state.matches
    );

    if (playoffMatches.length > 0) {
      setState({
        ...state,
        matches: [...state.matches, ...playoffMatches],
        logs: [...state.logs, ...playoffLogs]
      });
      setActiveTab('matches');
    }
  };

  const updateScore = (matchId: string, homeScore: number, awayScore: number) => {
    if (!state) return;
    const newMatches = state.matches.map(m => 
      m.id === matchId ? { ...m, homeScore, awayScore, isCompleted: true } : m
    );
    setState({ ...state, matches: newMatches });
  };

  const updateTeam = (teamId: string, updates: Partial<Team>) => {
    const updater = (t: Team) => t.id === teamId ? { ...t, ...updates } : t;
    if (view === 'wizard') {
      setTeams(teams.map(updater));
    } else if (state) {
      setState({ ...state, teams: state.teams.map(updater) });
    }
  };

  const standings = state ? calculateStandings(state.matches, state.teams, state.rules) : null;

  const isInitialPhaseComplete = state?.matches
    .filter(m => m.phase.startsWith('Grupo') || m.phase === 'Fase de Liga')
    .every(m => m.isCompleted) ?? false;

  const hasPlayoffsStarted = state?.matches.some(m => !m.phase.startsWith('Grupo') && m.phase !== 'Fase de Liga') ?? false;

  const showPlayoffButton = (state?.rules.format === TournamentFormat.GROUPS_PLAYOFFS || state?.rules.format === TournamentFormat.LIGA_PLAYOFFS) 
    && isInitialPhaseComplete 
    && !hasPlayoffsStarted;

  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-[#020617] text-slate-200 flex flex-col items-center justify-center p-6 text-center">
        <div className="mb-8 animate-pulse">
          <Trophy className="w-24 h-24 text-emerald-500 mx-auto" />
        </div>
        <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter text-white mb-6">
          LIGA<span className="text-emerald-500">MASTER</span>
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl mb-12 font-medium leading-relaxed">
          O motor de gestão de torneios mais potente. <br/>Agora com suporte a fases de grupos e playoffs.
        </p>
        <button 
          onClick={() => setView('wizard')}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-12 py-6 rounded-3xl font-black text-2xl shadow-2xl shadow-emerald-900/40 transition-all hover:scale-105 active:scale-95 flex items-center gap-4"
        >
          INICIAR CONFIGURAÇÃO <ChevronRight className="w-8 h-8" />
        </button>
      </div>
    );
  }

  if (view === 'wizard') {
    return (
      <div className="min-h-screen bg-[#020617] text-slate-200 flex items-center justify-center p-4">
        <div className="max-w-3xl w-full bg-slate-900 border border-slate-800 rounded-[48px] shadow-2xl overflow-hidden">
          <div className="bg-slate-950 p-6 flex justify-between items-center border-b border-slate-800">
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(s => (
                <div key={s} className={`h-2 w-10 rounded-full transition-all duration-500 ${wizardStep >= s ? 'bg-emerald-500' : 'bg-slate-800'}`} />
              ))}
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Passo {wizardStep} de 5</span>
          </div>

          <div className="p-8 md:p-14">
            {wizardStep === 1 && (
              <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                <div>
                  <h2 className="text-4xl font-black italic text-white uppercase tracking-tighter mb-3">Nome da Competição</h2>
                  <p className="text-slate-500 font-medium">Como se chamará seu torneio?</p>
                </div>
                <input 
                  autoFocus
                  className="w-full bg-slate-950 border-2 border-slate-800 rounded-3xl px-8 py-6 text-2xl font-bold text-white focus:border-emerald-500 outline-none transition-all placeholder:text-slate-800"
                  placeholder="Ex: Champions Cup"
                  value={tournamentName}
                  onChange={(e) => setTournamentName(e.target.value)}
                />
                <button 
                  disabled={!tournamentName}
                  onClick={() => setWizardStep(2)}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 py-6 rounded-3xl font-black text-xl shadow-xl shadow-emerald-900/20"
                >
                  PRÓXIMO PASSO
                </button>
              </div>
            )}

            {wizardStep === 2 && (
              <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                <div>
                  <h2 className="text-4xl font-black italic text-white uppercase tracking-tighter mb-3">Qual o Formato?</h2>
                  <p className="text-slate-500 font-medium">Escolha a estrutura principal do torneio.</p>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { id: TournamentFormat.ROUND_ROBIN, label: 'Liga Direta', icon: LayoutGrid, desc: 'Pontos corridos sem fase final.' },
                    { id: TournamentFormat.KNOCKOUT, label: 'Mata-Mata', icon: GitBranch, desc: 'Eliminação direta desde o início.' },
                    { id: TournamentFormat.GROUPS_PLAYOFFS, label: 'Liga (Grupos) + Playoffs', icon: Grid, desc: 'Equipes divididas em grupos seguidas de mata-mata.' },
                    { id: TournamentFormat.LIGA_PLAYOFFS, label: 'Liga Única + Playoffs', icon: Layers, desc: 'Liga geral onde os melhores avançam ao playoff.' },
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setFormat(f.id)}
                      className={`p-6 rounded-[32px] text-left transition-all border-2 flex gap-6 items-center ${
                        format === f.id ? 'bg-emerald-500/10 border-emerald-500' : 'bg-slate-950 border-slate-800'
                      }`}
                    >
                      <div className={`p-4 rounded-2xl ${format === f.id ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                        <f.icon className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-black uppercase text-base text-white">{f.label}</p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">{f.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="flex gap-4">
                  <button onClick={() => setWizardStep(1)} className="flex-1 bg-slate-800 py-6 rounded-3xl font-black">VOLTAR</button>
                  <button onClick={() => setWizardStep(3)} className="flex-[2] bg-emerald-600 py-6 rounded-3xl font-black">CONTINUAR</button>
                </div>
              </div>
            )}

            {wizardStep === 3 && (
              <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                <div>
                  <h2 className="text-4xl font-black italic text-white uppercase tracking-tighter mb-3">Participantes</h2>
                  <p className="text-slate-500 font-medium">Quantas equipes no total?</p>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
                  {[4, 8, 12, 16, 24, 32].map(n => (
                    <button 
                      key={n}
                      onClick={() => setTeamsCount(n)}
                      className={`py-6 rounded-2xl font-black text-xl border-2 ${teamsCount === n ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-600'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="flex gap-4">
                  <button onClick={() => setWizardStep(2)} className="flex-1 bg-slate-800 py-6 rounded-3xl font-black">VOLTAR</button>
                  <button onClick={() => setWizardStep(4)} className="flex-[2] bg-emerald-600 py-6 rounded-3xl font-black">CONTINUAR</button>
                </div>
              </div>
            )}

            {wizardStep === 4 && (
              <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                <div>
                  <h2 className="text-4xl font-black italic text-white uppercase tracking-tighter mb-3">Configurações</h2>
                  <p className="text-slate-500 font-medium">Regras detalhadas da competição.</p>
                </div>
                
                <div className="space-y-5">
                  {format === TournamentFormat.GROUPS_PLAYOFFS && (
                    <div className="bg-slate-950 p-6 rounded-3xl border-2 border-slate-800">
                      <p className="text-[10px] font-black text-emerald-500 uppercase mb-4 tracking-widest">Quantidade de Grupos</p>
                      <div className="flex gap-3">
                        {[2, 4, 8].map(n => (
                          <button 
                            key={n}
                            onClick={() => setGroupsCount(n)}
                            className={`flex-1 py-4 rounded-2xl font-black border-2 ${groupsCount === n ? 'bg-emerald-500 border-emerald-500' : 'bg-slate-900 border-slate-800 text-slate-500'}`}
                          >
                            {n} Grupos
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="bg-slate-950 p-6 rounded-3xl border-2 border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="font-black text-white uppercase text-sm">Turno e Returno?</p>
                      <p className="text-[10px] text-slate-600 font-bold uppercase mt-1">Jogos de ida e volta na fase inicial</p>
                    </div>
                    <button 
                      onClick={() => setHasReturnMatch(!hasReturnMatch)}
                      className={`w-16 h-10 rounded-full relative transition-all ${hasReturnMatch ? 'bg-emerald-600' : 'bg-slate-800'}`}
                    >
                      <div className={`absolute top-2 w-6 h-6 rounded-full bg-white transition-all ${hasReturnMatch ? 'right-2' : 'left-2'}`} />
                    </button>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button onClick={() => setWizardStep(3)} className="flex-1 bg-slate-800 py-6 rounded-3xl font-black">VOLTAR</button>
                  <button onClick={() => setWizardStep(5)} className="flex-[2] bg-emerald-600 py-6 rounded-3xl font-black">CONFIGURAR TIMES</button>
                </div>
              </div>
            )}

            {wizardStep === 5 && (
              <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                <div>
                  <h2 className="text-4xl font-black italic text-white uppercase tracking-tighter mb-2">Times</h2>
                  <p className="text-slate-500 font-medium">Nomeie e estilize as equipes.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[450px] overflow-y-auto pr-3 custom-scrollbar">
                  {teams.map((team, idx) => (
                    <div key={team.id} className="bg-slate-950 p-5 rounded-[28px] border-2 border-slate-800 flex items-center gap-5 group hover:border-slate-600 transition-all">
                      <div className="text-[10px] font-black text-slate-800 w-4">{idx + 1}</div>
                      <div className="flex-1 space-y-2">
                        <input 
                          className="w-full bg-transparent border-none p-0 text-lg font-black text-white focus:ring-0 placeholder:text-slate-800 italic"
                          placeholder="Nome do Time"
                          value={team.name}
                          onChange={(e) => updateTeam(team.id, { name: e.target.value })}
                        />
                        {team.group && (
                          <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-lg uppercase tracking-widest">Grupo {team.group}</span>
                        )}
                      </div>
                      <button 
                        onClick={() => {
                          const nextEmoji = SHIELD_EMOJIS[(SHIELD_EMOJIS.indexOf(team.shield) + 1) % SHIELD_EMOJIS.length];
                          updateTeam(team.id, { shield: nextEmoji });
                        }}
                        className="w-16 h-16 bg-slate-900 rounded-[20px] border-2 border-slate-800 flex items-center justify-center text-3xl"
                      >
                        {team.shield}
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-4">
                  <button onClick={() => setWizardStep(4)} className="flex-1 bg-slate-800 py-6 rounded-3xl font-black">VOLTAR</button>
                  <button 
                    onClick={handleGenerateTournament} 
                    className="flex-[2] bg-emerald-600 hover:bg-emerald-500 py-6 rounded-3xl font-black text-xl shadow-2xl"
                  >
                    GERAR CAMPEONATO
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#020617] text-slate-200">
      <header className="bg-slate-900/50 backdrop-blur-xl border-b border-slate-800 p-5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-600 p-2.5 rounded-2xl shadow-lg shadow-emerald-900/20">
              <Trophy className="text-white w-7 h-7" />
            </div>
            <h1 className="text-2xl font-black tracking-tighter text-white uppercase italic">
              LIGA<span className="text-emerald-500">MASTER</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setView('wizard')} className="bg-slate-800 hover:bg-slate-700 p-3 rounded-2xl transition-all">
              <Settings2 className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4 space-y-8">
          <div className="bg-slate-900/40 border border-slate-800 rounded-[40px] p-8 shadow-2xl">
             <div className="flex items-center gap-3 mb-8">
                <Target className="text-emerald-500 w-6 h-6" />
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Painel de Controle</h3>
             </div>
             <div className="space-y-4">
                <div className="bg-slate-950/60 p-5 rounded-[24px] border border-slate-800/50">
                  <p className="text-[10px] text-slate-600 font-black uppercase mb-1.5 tracking-widest">Torneio</p>
                  <p className="text-sm font-black text-white uppercase italic truncate">{state?.rules.name}</p>
                </div>
                <div className="bg-slate-950/60 p-5 rounded-[24px] border border-slate-800/50">
                  <p className="text-[10px] text-slate-600 font-black uppercase mb-1.5 tracking-widest">Formato</p>
                  <p className="text-sm font-black text-emerald-400 uppercase italic">{state?.rules.format.replace('_', ' ')}</p>
                </div>
                
                {showPlayoffButton && (
                  <button 
                    onClick={handleStartPlayoffs}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 p-4 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 transition-all shadow-lg animate-pulse"
                  >
                    <Play className="w-4 h-4" /> Gerar Playoffs
                  </button>
                )}
             </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 rounded-[40px] p-8 shadow-2xl">
             <div className="flex items-center gap-3 mb-8">
                <Palette className="text-emerald-500 w-6 h-6" />
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Equipes</h3>
             </div>
             <div className="space-y-3 max-h-[400px] overflow-y-auto pr-3 custom-scrollbar">
                {state?.teams.map(team => (
                  <div key={team.id} className="bg-slate-950/40 p-4 rounded-3xl border border-slate-800/50 flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-900 rounded-[14px] flex items-center justify-center border border-slate-800 text-xl">
                      {team.shield}
                    </div>
                    <div>
                      <span className="text-sm font-black text-white italic block">{team.name}</span>
                      {team.group && <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Grupo {team.group}</span>}
                    </div>
                  </div>
                ))}
             </div>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-8">
           <div className="flex p-2 bg-slate-900/60 backdrop-blur rounded-[32px] border border-slate-800 shadow-2xl">
              {[
                { id: 'matches', label: 'Confrontos', icon: Calendar },
                { id: 'table', label: 'Tabela', icon: Users },
                { id: 'setup', label: 'Histórico', icon: Info },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 flex items-center justify-center gap-3 py-5 rounded-[24px] transition-all text-[11px] font-black uppercase tracking-[0.1em] ${
                    activeTab === tab.id 
                    ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-900/20' 
                    : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
           </div>

           <div className="min-h-[600px] bg-slate-900/30 border border-slate-800/80 rounded-[48px] p-8 lg:p-12 shadow-inner overflow-hidden">
              {activeTab === 'matches' && state && (
                <div className="space-y-12">
                  {Array.from(new Set(state.matches.map(m => m.phase))).map(phase => (
                    <div key={phase} className="space-y-6">
                      <div className="flex items-center gap-6">
                        <span className="text-xs font-black uppercase tracking-[0.3em] text-emerald-500 italic">{phase}</span>
                        <div className="flex-1 h-px bg-slate-800/50" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {state.matches.filter(m => m.phase === phase).map(match => {
                          const home = state.teams.find(t => t.id === match.homeTeamId);
                          const away = state.teams.find(t => t.id === match.awayTeamId);
                          return (
                            <div key={match.id} className="bg-slate-950/60 p-6 rounded-[32px] border border-slate-800/50 hover:border-emerald-500/30 transition-all shadow-lg">
                               <div className="flex items-center justify-between gap-6">
                                  <div className="flex flex-col gap-4 flex-1 overflow-hidden">
                                     <div className="flex items-center gap-4">
                                        <span className="text-2xl">{home?.shield}</span>
                                        <div className="flex flex-col">
                                          <span className="text-sm font-black text-slate-100 truncate italic">{home?.name}</span>
                                          {match.group && <span className="text-[8px] font-black text-slate-600 uppercase">Grupo {match.group}</span>}
                                        </div>
                                     </div>
                                     <div className="flex items-center gap-4">
                                        <span className="text-2xl">{away?.shield}</span>
                                        <div className="flex flex-col">
                                          <span className="text-sm font-black text-slate-100 truncate italic">{away?.name}</span>
                                          {match.group && <span className="text-[8px] font-black text-slate-600 uppercase">Grupo {match.group}</span>}
                                        </div>
                                     </div>
                                  </div>
                                  <div className="flex flex-col gap-3">
                                     <input 
                                       type="number"
                                       className="w-14 bg-slate-900 border-2 border-slate-800 rounded-2xl text-center py-2.5 text-base font-black text-emerald-400 focus:border-emerald-500 outline-none"
                                       defaultValue={match.homeScore}
                                       onBlur={(e) => updateScore(match.id, parseInt(e.target.value) || 0, match.awayScore || 0)}
                                     />
                                     <input 
                                       type="number"
                                       className="w-14 bg-slate-900 border-2 border-slate-800 rounded-2xl text-center py-2.5 text-base font-black text-emerald-400 focus:border-emerald-500 outline-none"
                                       defaultValue={match.awayScore}
                                       onBlur={(e) => updateScore(match.id, match.homeScore || 0, parseInt(e.target.value) || 0)}
                                     />
                                  </div>
                               </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'table' && state && standings && (
                <div className="space-y-12">
                  {typeof standings === 'object' && !Array.isArray(standings) ? (
                    Object.entries(standings).map(([groupName, groupStats]) => (
                      <div key={groupName} className="space-y-4">
                        <div className="flex items-center gap-4">
                          <h4 className="text-sm font-black text-emerald-500 italic uppercase tracking-widest">Grupo {groupName}</h4>
                          <div className="flex-1 h-px bg-slate-800/50" />
                        </div>
                        <TableComponent stats={groupStats} />
                      </div>
                    ))
                  ) : (
                    <TableComponent stats={standings as any[]} />
                  )}
                </div>
              )}

              {activeTab === 'setup' && state && (
                <div className="space-y-6">
                   {state.logs.map((log, idx) => (
                     <div key={idx} className="bg-slate-950/60 p-8 rounded-[36px] border border-slate-800/50 flex gap-6 hover:border-emerald-500/20 transition-all shadow-xl">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-2 shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                        <div className="space-y-3 flex-1">
                           <div className="flex justify-between items-center">
                              <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.3em]">{log.action}</span>
                              <span className="text-[10px] text-slate-700 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
                           </div>
                           <p className="text-base font-black text-white italic leading-tight">{log.reason}</p>
                           <p className="text-xs text-slate-500 leading-relaxed font-medium">{log.impact}</p>
                        </div>
                     </div>
                   ))}
                </div>
              )}
           </div>
        </div>
      </main>

      <footer className="p-10 text-center bg-slate-950/80 border-t border-slate-900/50">
        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-700 italic">LigaMaster • Sistema de Competição Avançado</p>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(15, 23, 42, 0.1); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 20px; }
        
        @keyframes slide-in-bottom {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-in { animation: slide-in-bottom 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
};

const TableComponent = ({ stats }: { stats: any[] }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-left border-separate border-spacing-y-3">
      <thead>
        <tr className="text-slate-600 text-[10px] uppercase font-black tracking-[0.2em]">
          <th className="px-6 py-4 text-center">Pos</th>
          <th className="px-6 py-4">Time</th>
          <th className="px-6 py-4 text-center">Pts</th>
          <th className="px-6 py-4 text-center">PJ</th>
          <th className="px-6 py-4 text-center">SG</th>
        </tr>
      </thead>
      <tbody>
        {stats.map((team, idx) => (
          <tr key={team.id} className="bg-slate-950/40 hover:bg-slate-900 transition-all rounded-[24px]">
            <td className="px-6 py-5 text-center first:rounded-l-[24px]">
              <span className={`text-base font-black italic ${idx < 2 ? 'text-emerald-500' : 'text-slate-600'}`}>
                {idx + 1}
              </span>
            </td>
            <td className="px-6 py-5">
               <div className="flex items-center gap-4">
                  <span className="text-2xl">{team.shield}</span>
                  <span className="text-sm font-black text-white italic">{team.name}</span>
               </div>
            </td>
            <td className="px-6 py-5 text-center font-black text-emerald-400 text-xl italic">{team.points}</td>
            <td className="px-6 py-5 text-center text-slate-500 font-mono text-sm">{team.played}</td>
            <td className="px-6 py-5 text-center font-black text-slate-300 italic text-sm last:rounded-r-[24px]">
              {team.goalDiff > 0 ? `+${team.goalDiff}` : team.goalDiff}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default App;
