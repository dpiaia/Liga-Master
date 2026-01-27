
import React, { useState } from 'react';
import { 
  Trophy, 
  Settings, 
  Users, 
  Calendar, 
  Info, 
  ChevronRight, 
  Target, 
  Palette, 
  Edit2, 
  Save, 
  ShieldCheck, 
  Zap, 
  Cpu, 
  Globe, 
  ArrowRight, 
  ArrowLeft, 
  LayoutGrid, 
  GitBranch, 
  Layers, 
  Dices, 
  HelpCircle, 
  Loader2, 
  Sparkles, 
  Wand2, 
  AlertCircle 
} from 'lucide-react';
import { Team, TournamentRules, TournamentState, TournamentFormat } from './types';
import { parseTournamentRules, identifyAmbiguities, generateTeamShield } from './services/geminiService';
import { generateFixtures, calculateStandings } from './services/tournamentEngine';

const COLOR_PRESETS = [
  '#ef4444', '#f97316', '#f59e0b', '#10b981', 
  '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', 
  '#ec4899', '#64748b', '#ffffff', '#000000'
];

const SHIELD_PRESETS = ['🛡️', '🦁', '🦅', '🐺', '⭐', '🔥', '⚓', '⚡', '🐉', '🏔️', '🏟️', '⚽'];

const INITIAL_TEAMS: Team[] = [
  { id: '1', name: 'Arsenal', shield: '🛡️', colors: { primary: '#ef4444', secondary: '#ffffff', accent: '#fbbf24' } },
  { id: '2', name: 'Man City', shield: '🦅', colors: { primary: '#06b6d4', secondary: '#ffffff', accent: '#1e293b' } },
  { id: '3', name: 'Liverpool', shield: '🦁', colors: { primary: '#dc2626', secondary: '#fde047', accent: '#166534' } },
  { id: '4', name: 'Aston Villa', shield: '🦁', colors: { primary: '#991b1b', secondary: '#38bdf8', accent: '#fde047' } },
  { id: '5', name: 'Tottenham', shield: '🐓', colors: { primary: '#f8fafc', secondary: '#1e293b', accent: '#334155' } },
  { id: '6', name: 'Man Utd', shield: '😈', colors: { primary: '#ef4444', secondary: '#1e293b', accent: '#fde047' } },
  { id: '7', name: 'Newcastle', shield: '⚓', colors: { primary: '#1e293b', secondary: '#ffffff', accent: '#334155' } },
  { id: '8', name: 'Chelsea', shield: '🦁', colors: { primary: '#2563eb', secondary: '#ffffff', accent: '#fbbf24' } },
];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const App: React.FC = () => {
  const [view, setView] = useState<'landing' | 'wizard' | 'app'>('landing');
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardData, setWizardData] = useState({
    name: '',
    teamsCount: 8,
    format: TournamentFormat.ROUND_ROBIN
  });

  const [naturalInput, setNaturalInput] = useState('');
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [generatingShields, setGeneratingShields] = useState<string[]>([]);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  const [state, setState] = useState<TournamentState | null>(null);
  const [activeTab, setActiveTab] = useState<'setup' | 'matches' | 'table' | 'logs'>('setup');
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);

  const startAnalysis = async () => {
    setIsAnalyzing(true);
    setWizardStep(5);
    try {
      const qs = await identifyAmbiguities(wizardData, naturalInput);
      setQuestions(qs);
    } catch (e) {
      setQuestions(["Defina os critérios de desempate.", "Defina a data de início."]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateTeamLocally = (teamId: string, updates: Partial<Team>) => {
    setState(prev => {
      if (!prev) return null;
      return {
        ...prev,
        teams: prev.teams.map(t => t.id === teamId ? { ...t, ...updates } : t)
      };
    });
  };

  const generateAllShields = async (teams: Team[]) => {
    setQuotaExceeded(false);
    for (const team of teams) {
      setGeneratingShields(prev => [...prev, team.id]);
      try {
        await sleep(1500); 
        const imageUrl = await generateTeamShield(team);
        if (imageUrl) {
          updateTeamLocally(team.id, { shield: imageUrl });
        }
      } catch (error: any) {
        if (error.message === 'QUOTA_EXHAUSTED') {
          setQuotaExceeded(true);
          setGeneratingShields([]);
          break;
        }
      } finally {
        setGeneratingShields(prev => prev.filter(id => id !== team.id));
      }
    }
  };

  const handleProcessRules = async () => {
    const answersText = Object.entries(answers).map(([q, a]) => `${q}: ${a}`).join('\n');
    const fullPrompt = `
      NOME DO TORNEIO: ${wizardData.name}
      QUANTIDADE DE EQUIPES: ${wizardData.teamsCount}
      FORMATO BASE: ${wizardData.format}
      PEDIDO MANUAL: ${naturalInput}
      ESCLARECIMENTOS TÉCNICOS: ${answersText}
    `;

    setIsProcessing(true);
    try {
      const parsedRules = await parseTournamentRules(fullPrompt);
      
      let finalTeams = [...INITIAL_TEAMS].slice(0, parsedRules.teamsCount);
      if (finalTeams.length < parsedRules.teamsCount) {
        for (let i = finalTeams.length; i < parsedRules.teamsCount; i++) {
          finalTeams.push({ 
            id: `team-${i + 1}`, 
            name: `Time ${i + 1}`, 
            shield: SHIELD_PRESETS[i % SHIELD_PRESETS.length],
            colors: { 
              primary: COLOR_PRESETS[i % COLOR_PRESETS.length],
              secondary: '#ffffff',
              accent: '#000000'
            } 
          });
        }
      }

      const { matches, logs } = generateFixtures(parsedRules, finalTeams);
      
      setState({
        rules: parsedRules,
        teams: finalTeams,
        matches,
        logs
      });
      setActiveTab('matches');
      setView('app');
      generateAllShields(finalTeams);
    } catch (error: any) {
      console.error("Erro no processamento lógico:", error);
      alert(`Erro: ${error.message || "Não foi possível estruturar seu torneio agora. Tente novamente."}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateSingleShield = async (team: Team) => {
    setGeneratingShields(prev => [...prev, team.id]);
    setQuotaExceeded(false);
    try {
      const imageUrl = await generateTeamShield(team);
      if (imageUrl) {
        updateTeam(team.id, { shield: imageUrl });
      }
    } catch (error: any) {
      if (error.message === 'QUOTA_EXHAUSTED') {
        setQuotaExceeded(true);
      }
    } finally {
      setGeneratingShields(prev => prev.filter(id => id !== team.id));
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
    if (!state) return;
    const newTeams = state.teams.map(t => t.id === teamId ? { ...t, ...updates } : t);
    setState({ ...state, teams: newTeams });
  };

  const updateTeamColor = (teamId: string, type: 'primary' | 'secondary' | 'accent', color: string) => {
    if (!state) return;
    const newTeams = state.teams.map(t => {
      if (t.id === teamId) {
        return { ...t, colors: { ...t.colors, [type]: color } };
      }
      return t;
    });
    setState({ ...state, teams: newTeams });
  };

  const updateRules = (updates: Partial<TournamentRules>) => {
    if (!state) return;
    setState({ ...state, rules: { ...state.rules, ...updates } });
  };

  const standings = state ? calculateStandings(state.matches, state.teams, state.rules) : [];

  const renderShield = (shield: string, sizeClass: string = "w-10 h-10") => {
    if (shield.startsWith('data:image') || shield.startsWith('http')) {
      return (
        <div className={`${sizeClass} rounded-xl overflow-hidden shadow-lg border border-slate-700 bg-slate-900 flex items-center justify-center`}>
          <img src={shield} alt="Shield" className="w-full h-full object-cover" />
        </div>
      );
    }
    return (
      <div className={`${sizeClass} rounded-xl bg-slate-800 flex items-center justify-center text-2xl shadow-inner border border-slate-700`}>
        {shield}
      </div>
    );
  };

  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-[#020617] text-slate-200 overflow-x-hidden">
        <nav className="relative z-10 max-w-7xl mx-auto p-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="text-emerald-500 w-8 h-8" />
            <span className="text-xl font-black italic tracking-tighter">LIGA<span className="text-emerald-500 font-black">MASTER</span></span>
          </div>
          <button 
            onClick={() => setView('wizard')}
            className="hidden md:block bg-white/5 border border-white/10 hover:bg-white/10 text-white px-6 py-2 rounded-full text-sm font-bold transition-all"
          >
            Acessar Engine
          </button>
        </nav>
        <section className="relative z-10 max-w-5xl mx-auto px-6 pt-20 pb-32 text-center">
          <h1 className="text-5xl md:text-7xl font-black text-white leading-tight mb-8 tracking-tighter italic">
            GESTOR DE <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-500">TORNEIOS IA</span>
          </h1>
          <p className="text-lg text-slate-400 max-w-3xl mx-auto mb-12">
            Transforme regras em linguagem natural em campeonatos de elite instantaneamente.
          </p>
          <button 
            onClick={() => setView('wizard')}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-10 py-5 rounded-2xl font-black text-lg shadow-2xl transition-all flex items-center justify-center gap-3 mx-auto"
          >
            CRIAR CAMPEONATO <ChevronRight />
          </button>
        </section>
      </div>
    );
  }

  if (view === 'wizard') {
    return (
      <div className="min-h-screen bg-[#020617] text-slate-200 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[40px] shadow-2xl">
            {wizardStep === 1 && (
              <div className="space-y-6">
                <h2 className="text-3xl font-black italic">Qual o nome da Liga?</h2>
                <input 
                  autoFocus
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-5 text-xl font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={wizardData.name}
                  onChange={(e) => setWizardData({...wizardData, name: e.target.value})}
                />
                <button 
                  disabled={!wizardData.name}
                  onClick={() => setWizardStep(2)}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 py-5 rounded-2xl font-black flex items-center justify-center gap-3"
                >
                  PRÓXIMO <ArrowRight />
                </button>
              </div>
            )}
            {wizardStep === 2 && (
              <div className="space-y-6">
                <h2 className="text-3xl font-black italic">Equipes e Formato</h2>
                <div className="grid grid-cols-2 gap-4">
                  {[4, 8, 16, 20].map(n => (
                    <button 
                      key={n}
                      onClick={() => setWizardData({...wizardData, teamsCount: n})}
                      className={`py-4 rounded-xl font-bold border-2 ${wizardData.teamsCount === n ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-800'}`}
                    >
                      {n} Equipes
                    </button>
                  ))}
                </div>
                <div className="flex gap-4">
                  <button onClick={() => setWizardStep(1)} className="flex-1 bg-slate-800 py-4 rounded-xl">Voltar</button>
                  <button onClick={() => setWizardStep(3)} className="flex-1 bg-emerald-600 py-4 rounded-xl">Próximo</button>
                </div>
              </div>
            )}
            {wizardStep === 3 && (
              <div className="space-y-6">
                <h2 className="text-3xl font-black italic">Defina as Regras</h2>
                <textarea 
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-6 h-40 outline-none"
                  placeholder="Ex: 3 pontos por vitória, returno e mata-mata..."
                  value={naturalInput}
                  onChange={(e) => setNaturalInput(e.target.value)}
                />
                <button 
                  onClick={startAnalysis}
                  className="w-full bg-emerald-600 py-5 rounded-2xl font-black flex items-center justify-center gap-3"
                >
                  ANALISAR REGRAS <Zap />
                </button>
              </div>
            )}
            {wizardStep === 5 && (
              <div className="space-y-6">
                <h2 className="text-3xl font-black italic">Esclarecimentos</h2>
                {isAnalyzing ? <Loader2 className="animate-spin mx-auto w-10 h-10" /> : (
                  <div className="space-y-4">
                    {questions.map((q, i) => (
                      <div key={i} className="space-y-2">
                        <label className="text-sm text-slate-400">{q}</label>
                        <input 
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3"
                          onChange={(e) => setAnswers({...answers, [q]: e.target.value})}
                        />
                      </div>
                    ))}
                    <button onClick={handleProcessRules} className="w-full bg-emerald-600 py-5 rounded-2xl font-black">
                      {isProcessing ? <Loader2 className="animate-spin inline" /> : 'GERAR TORNEIO'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0f172a] text-slate-200">
      <header className="bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center">
        <h1 className="text-xl font-black italic">LIGA<span className="text-emerald-500">MASTER</span></h1>
        {quotaExceeded && <div className="text-amber-500 flex items-center gap-1 text-[10px] font-bold uppercase"><AlertCircle size={14}/> Cota de Escudos IA Excedida</div>}
      </header>

      <main className="flex-1 p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-7xl mx-auto w-full">
        <div className="lg:col-span-4 space-y-6">
           <div className="bg-slate-800/40 p-6 rounded-3xl border border-slate-700">
              <h2 className="font-bold uppercase text-sm mb-4">Painel de Controle</h2>
              <div className="space-y-4">
                 <div className="bg-slate-950 p-3 rounded-xl">
                    <p className="text-[10px] text-slate-500 uppercase font-black">Liga</p>
                    <p className="font-bold">{state?.rules.name}</p>
                 </div>
                 <div className="bg-slate-950 p-3 rounded-xl">
                    <p className="text-[10px] text-slate-500 uppercase font-black">Equipes</p>
                    <p className="font-bold">{state?.teams.length}</p>
                 </div>
              </div>
           </div>
           {state && (
             <div className="bg-slate-800/20 p-6 rounded-3xl border border-slate-700 overflow-y-auto max-h-[500px]">
                <h3 className="font-bold uppercase text-xs mb-4">Equipes</h3>
                <div className="space-y-3">
                  {state.teams.map(team => (
                    <div key={team.id} className="flex items-center justify-between bg-slate-900/50 p-3 rounded-xl">
                      <div className="flex items-center gap-3">
                        {renderShield(team.shield, "w-8 h-8")}
                        <span className="text-xs font-bold truncate max-w-[120px]">{team.name}</span>
                      </div>
                      <button onClick={() => setEditingTeamId(team.id)} className="p-2 hover:bg-slate-800 rounded-lg"><Edit2 size={12}/></button>
                    </div>
                  ))}
                </div>
             </div>
           )}
        </div>

        <div className="lg:col-span-8">
           <div className="flex gap-2 mb-6 bg-slate-900 p-1 rounded-2xl">
              {['matches', 'table', 'logs'].map(tab => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`flex-1 py-3 rounded-xl font-bold uppercase text-[10px] ${activeTab === tab ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}
                >
                  {tab}
                </button>
              ))}
           </div>
           
           <div className="bg-slate-900/50 min-h-[500px] rounded-3xl p-6 border border-slate-800">
              {activeTab === 'matches' && state && (
                <div className="space-y-6">
                  {state.matches.map(match => (
                    <div key={match.id} className="bg-slate-800 p-4 rounded-2xl flex items-center justify-between">
                       <div className="flex-1 flex items-center gap-2">
                          {renderShield(state.teams.find(t => t.id === match.homeTeamId)?.shield || '', "w-6 h-6")}
                          <span className="text-sm font-bold truncate">{state.teams.find(t => t.id === match.homeTeamId)?.name}</span>
                       </div>
                       <div className="flex gap-2 mx-4">
                          <input 
                            className="w-10 bg-slate-950 text-center rounded-lg font-black"
                            defaultValue={match.homeScore}
                            onBlur={(e) => updateScore(match.id, parseInt(e.target.value) || 0, match.awayScore || 0)}
                          />
                          <span>-</span>
                          <input 
                            className="w-10 bg-slate-950 text-center rounded-lg font-black"
                            defaultValue={match.awayScore}
                            onBlur={(e) => updateScore(match.id, match.homeScore || 0, parseInt(e.target.value) || 0)}
                          />
                       </div>
                       <div className="flex-1 flex flex-row-reverse items-center gap-2">
                          {renderShield(state.teams.find(t => t.id === match.awayTeamId)?.shield || '', "w-6 h-6")}
                          <span className="text-sm font-bold truncate">{state.teams.find(t => t.id === match.awayTeamId)?.name}</span>
                       </div>
                    </div>
                  ))}
                </div>
              )}
              {activeTab === 'table' && (
                <table className="w-full text-xs">
                   <thead>
                      <tr className="text-slate-500 uppercase font-black border-b border-slate-800">
                         <th className="p-3">Pos</th>
                         <th className="p-3 text-left">Time</th>
                         <th className="p-3">Pts</th>
                         <th className="p-3">PJ</th>
                      </tr>
                   </thead>
                   <tbody>
                      {standings.map((t, i) => (
                        <tr key={t.id} className="border-b border-slate-800/30">
                           <td className="p-3 text-center">{i+1}</td>
                           <td className="p-3 flex items-center gap-2">
                              {renderShield(t.shield, "w-6 h-6")}
                              {t.name}
                           </td>
                           <td className="p-3 text-center font-bold text-emerald-500">{t.points}</td>
                           <td className="p-3 text-center">{t.played}</td>
                        </tr>
                      ))}
                   </tbody>
                </table>
              )}
              {activeTab === 'logs' && state && (
                <div className="space-y-4">
                   {state.logs.map((log, i) => (
                     <div key={i} className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                        <p className="text-[9px] font-black uppercase text-emerald-500">{log.action}</p>
                        <p className="text-sm font-bold mt-1 italic">{log.reason}</p>
                        <p className="text-xs text-slate-500 mt-1">{log.impact}</p>
                     </div>
                   ))}
                </div>
              )}
           </div>
        </div>
      </main>
    </div>
  );
};

export default App;
