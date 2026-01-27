
import React, { useState } from 'react';
import { 
  Trophy, 
  Settings, 
  Users, 
  Calendar, 
  Activity, 
  MessageSquare, 
  Play,
  CheckCircle,
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
  Star,
  ArrowRight,
  ArrowLeft,
  LayoutGrid,
  GitBranch,
  Layers,
  Dices,
  HelpCircle,
  Loader2,
  Sparkles
} from 'lucide-react';
import { Team, Match, TournamentRules, TournamentState, DecisionLog, TournamentFormat } from './types';
import { parseTournamentRules, identifyAmbiguities } from './services/geminiService';
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

  const [state, setState] = useState<TournamentState | null>(null);
  const [activeTab, setActiveTab] = useState<'setup' | 'matches' | 'table' | 'logs'>('setup');
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);

  // Etapa 4 -> 5: Analisar prompt e gerar perguntas
  const startAnalysis = async () => {
    setIsAnalyzing(true);
    setWizardStep(5);
    try {
      const qs = await identifyAmbiguities(wizardData, naturalInput);
      setQuestions(qs);
    } catch (e) {
      setQuestions(["Como os empates em eliminatórias devem ser resolvidos?", "Qual o principal critério de desempate na tabela?"]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Etapa Final: Consolidar tudo e gerar o torneio
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
      
      let finalTeams = INITIAL_TEAMS.slice(0, parsedRules.teamsCount);
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
    } catch (error) {
      console.error(error);
      alert("Erro ao processar as regras inteligentes. Verifique sua conexão.");
    } finally {
      setIsProcessing(false);
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

  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-[#020617] text-slate-200 overflow-x-hidden">
        <div className="fixed top-0 left-0 w-full h-full pointer-events-none opacity-20 overflow-hidden">
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-600 rounded-full blur-[160px]" />
          <div className="absolute top-1/2 -right-40 w-80 h-80 bg-blue-600 rounded-full blur-[160px]" />
        </div>

        <nav className="relative z-10 max-w-7xl mx-auto p-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="text-emerald-500 w-8 h-8" />
            <span className="text-xl font-black italic tracking-tighter">LIGA<span className="text-emerald-500 font-black">MASTER</span></span>
          </div>
          <button 
            onClick={() => setView('wizard')}
            className="hidden md:block bg-white/5 border border-white/10 hover:bg-white/10 text-white px-6 py-2 rounded-full text-sm font-bold transition-all"
          >
            Entrar no Engine
          </button>
        </nav>

        <section className="relative z-10 max-w-5xl mx-auto px-6 pt-20 pb-32 text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5 rounded-full mb-8 animate-bounce">
            <Zap className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Powered by Gemini AI</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black text-white leading-tight mb-8 tracking-tighter italic">
            A NOVA ERA DA <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-500">GESTÃO DE FUTEBOL</span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-400 max-w-3xl mx-auto mb-12 font-medium leading-relaxed">
            Transforme regras em linguagem natural em campeonatos profissionais. Nossa IA gera tabelas, define identidades visuais e automatiza a lógica de pontuação instantaneamente.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <button 
              onClick={() => setView('wizard')}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white px-10 py-5 rounded-2xl font-black text-lg shadow-2xl shadow-emerald-600/20 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
            >
              COMECE AGORA SEU CAMPEONATO
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </section>

        <section className="relative z-10 max-w-7xl mx-auto px-6 py-20 border-t border-white/5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="bg-white/5 border border-white/10 p-8 rounded-[32px] hover:border-emerald-500/30 transition-all group">
              <div className="w-14 h-14 bg-emerald-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <MessageSquare className="text-emerald-400 w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Linguagem Natural</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Não perca tempo configurando tabelas. Apenas diga como quer o torneio e a IA cuida do resto.</p>
            </div>

            <div className="bg-white/5 border border-white/10 p-8 rounded-[32px] hover:border-blue-500/30 transition-all group">
              <div className="w-14 h-14 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Palette className="text-blue-400 w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Identidade Pro</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Cores tri-colores, escudos customizados e identidades visuais automáticas para cada equipe.</p>
            </div>

            <div className="bg-white/5 border border-white/10 p-8 rounded-[32px] hover:border-purple-500/30 transition-all group">
              <div className="w-14 h-14 bg-purple-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Cpu className="text-purple-400 w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Motor Lógico</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Logs de decisões auditáveis. Entenda exatamente como cada critério de desempate foi aplicado.</p>
            </div>
          </div>
        </section>

        <footer className="relative z-10 p-12 text-center border-t border-white/5">
          <p className="text-[10px] text-slate-600 font-black uppercase tracking-[0.4em]">LigaMaster AI © 2024 - Sistema de Gerenciamento Esportivo Inteligente</p>
        </footer>
      </div>
    );
  }

  if (view === 'wizard') {
    return (
      <div className="min-h-screen bg-[#020617] text-slate-200 flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-10">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500 rounded-full blur-[140px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600 rounded-full blur-[140px]" />
        </div>

        <div className="max-w-2xl w-full relative z-10">
          <div className="mb-10 flex items-center justify-between">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('landing')}>
              <Trophy className="text-emerald-500 w-6 h-6" />
              <span className="text-lg font-black italic tracking-tighter">LIGA<span className="text-emerald-500 font-black">MASTER</span></span>
            </div>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(s => (
                <div key={s} className={`h-1.5 w-10 rounded-full transition-all ${wizardStep >= s ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-800'}`} />
              ))}
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 p-8 md:p-12 rounded-[40px] shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-500">
            {wizardStep === 1 && (
              <div className="space-y-8 animate-in slide-in-from-right-10 duration-500">
                <div className="space-y-2">
                  <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">Primeiro, o nome.</h2>
                  <p className="text-slate-500 font-medium">Como se chamará a sua nova liga de elite?</p>
                </div>
                <input 
                  autoFocus
                  placeholder="Ex: Premier League de Inverno"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-5 text-xl font-bold text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder:text-slate-700"
                  value={wizardData.name}
                  onChange={(e) => setWizardData({...wizardData, name: e.target.value})}
                  onKeyDown={(e) => e.key === 'Enter' && wizardData.name && setWizardStep(2)}
                />
                <button 
                  disabled={!wizardData.name}
                  onClick={() => setWizardStep(2)}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white font-black py-5 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95"
                >
                  PRÓXIMO PASSO <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {wizardStep === 2 && (
              <div className="space-y-8 animate-in slide-in-from-right-10 duration-500">
                <div className="space-y-2">
                  <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">Quantas equipes?</h2>
                  <p className="text-slate-500 font-medium">A escala do seu campeonato define o nível da disputa.</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[4, 8, 12, 16, 20, 24, 32].map(num => (
                    <button
                      key={num}
                      onClick={() => setWizardData({...wizardData, teamsCount: num})}
                      className={`py-4 rounded-2xl font-black text-xl transition-all border-2 ${
                        wizardData.teamsCount === num 
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' 
                        : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                  <div className="relative">
                    <input 
                      type="number"
                      placeholder="Outro"
                      className="w-full h-full py-4 bg-slate-950 border-2 border-slate-800 rounded-2xl text-center font-black text-xl text-white outline-none focus:border-emerald-500"
                      onChange={(e) => setWizardData({...wizardData, teamsCount: parseInt(e.target.value) || 4})}
                    />
                  </div>
                </div>
                <div className="flex gap-4">
                  <button onClick={() => setWizardStep(1)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-black py-5 rounded-2xl transition-all flex items-center justify-center gap-3"><ArrowLeft className="w-5 h-5" /> VOLTAR</button>
                  <button onClick={() => setWizardStep(3)} className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white font-black py-5 rounded-2xl transition-all flex items-center justify-center gap-3">PRÓXIMO <ArrowRight className="w-5 h-5" /></button>
                </div>
              </div>
            )}

            {wizardStep === 3 && (
              <div className="space-y-8 animate-in slide-in-from-right-10 duration-500">
                <div className="space-y-2">
                  <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">Formato de Competição</h2>
                  <p className="text-slate-500 font-medium">Escolha a alma tática do seu torneio.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { id: TournamentFormat.ROUND_ROBIN, label: 'Liga (Pontos)', icon: LayoutGrid, desc: 'Todos contra todos' },
                    { id: TournamentFormat.CHAMPIONS, label: 'Liga + Playoffs', icon: Layers, desc: 'Grupos e mata-mata' },
                    { id: TournamentFormat.KNOCKOUT, label: 'Mata-Mata', icon: GitBranch, desc: 'Eliminação direta' },
                    { id: TournamentFormat.WORLD_CUP, label: 'Grupos x Grupos', icon: Globe, desc: 'Estilo Copa do Mundo' },
                    { id: TournamentFormat.CUSTOM, label: 'Personalizado', icon: Dices, desc: 'Você define as regras' }
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setWizardData({...wizardData, format: f.id})}
                      className={`p-6 rounded-3xl text-left transition-all border-2 flex gap-4 items-start ${
                        wizardData.format === f.id 
                        ? 'bg-emerald-500/10 border-emerald-500 ring-4 ring-emerald-500/10' 
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className={`p-3 rounded-xl ${wizardData.format === f.id ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-slate-500'}`}>
                        <f.icon className="w-6 h-6" />
                      </div>
                      <div>
                        <p className={`font-black uppercase tracking-tight ${wizardData.format === f.id ? 'text-emerald-400' : 'text-white'}`}>{f.label}</p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">{f.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="flex gap-4 pt-4">
                  <button onClick={() => setWizardStep(2)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-black py-5 rounded-2xl transition-all flex items-center justify-center gap-3"><ArrowLeft className="w-5 h-5" /> VOLTAR</button>
                  <button onClick={() => setWizardStep(4)} className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white font-black py-5 rounded-2xl transition-all flex items-center justify-center gap-3">PRÓXIMO <ArrowRight className="w-5 h-5" /></button>
                </div>
              </div>
            )}

            {wizardStep === 4 && (
              <div className="space-y-8 animate-in slide-in-from-right-10 duration-500">
                <div className="space-y-2">
                  <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">Suas Regras Personalizadas</h2>
                  <p className="text-slate-500 font-medium">Descreva detalhes como pontuação, data ou critérios de desempate.</p>
                </div>
                <div className="bg-emerald-500/5 p-6 rounded-[28px] border border-emerald-500/20 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-500" />
                    <p className="text-sm font-bold text-slate-300">Como funciona o seu torneio?</p>
                  </div>
                  <textarea 
                    autoFocus
                    placeholder="Ex: 3 pontos por vitória. Empates em playoffs vão para os pênaltis. Times inspirados em heróis gregos..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-4 text-md text-white h-36 focus:ring-2 focus:ring-emerald-500 outline-none resize-none transition-all"
                    value={naturalInput}
                    onChange={(e) => setNaturalInput(e.target.value)}
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button onClick={() => setWizardStep(3)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-black py-5 rounded-2xl transition-all flex items-center justify-center gap-3"><ArrowLeft className="w-5 h-5" /> VOLTAR</button>
                  <button 
                    disabled={!naturalInput.trim()}
                    onClick={startAnalysis} 
                    className="flex-[2] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white font-black py-5 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/20"
                  >
                    ANALISAR REGRAS <Zap className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {wizardStep === 5 && (
              <div className="space-y-8 animate-in slide-in-from-right-10 duration-500">
                <div className="space-y-2">
                  <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">Esclarecimento de IA</h2>
                  <p className="text-slate-500 font-medium">Nossa IA analisou seu pedido e precisa definir estes pontos lógicos.</p>
                </div>

                {isAnalyzing ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-4 text-emerald-500">
                    <Loader2 className="w-12 h-12 animate-spin" />
                    <p className="text-xs font-black uppercase tracking-widest animate-pulse">Processando Ambigüidades...</p>
                  </div>
                ) : (
                  <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {questions.map((q, i) => (
                      <div key={i} className="bg-slate-950 p-6 rounded-[28px] border border-slate-800 space-y-3 group hover:border-emerald-500/30 transition-all">
                        <div className="flex items-center gap-2">
                          <HelpCircle className="w-4 h-4 text-emerald-500" />
                          <p className="text-sm font-bold text-slate-300">{q}</p>
                        </div>
                        <input 
                          placeholder="Sua resposta rápida..."
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                          value={answers[q] || ''}
                          onChange={(e) => setAnswers({...answers, [q]: e.target.value})}
                        />
                      </div>
                    ))}
                    
                    {questions.length === 0 && (
                      <div className="text-center py-10 space-y-4">
                         <div className="inline-flex p-4 bg-emerald-500/20 rounded-full">
                            <CheckCircle className="w-8 h-8 text-emerald-500" />
                         </div>
                         <p className="text-sm font-bold text-slate-400">Tudo parece perfeito! Nenhuma dúvida identificada.</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-4 pt-4">
                  <button onClick={() => setWizardStep(4)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-black py-5 rounded-2xl transition-all flex items-center justify-center gap-3"><ArrowLeft className="w-5 h-5" /> VOLTAR</button>
                  <button 
                    disabled={isProcessing || isAnalyzing}
                    onClick={handleProcessRules} 
                    className="flex-[2] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white font-black py-5 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/20"
                  >
                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                    {isProcessing ? 'COMPILANDO LÓGICA...' : 'GERAR CAMPEONATO'}
                  </button>
                </div>
              </div>
            )}
          </div>
          <p className="text-center mt-8 text-slate-600 text-[10px] font-black uppercase tracking-[0.3em]">LigaMaster Engine Wizard v1.1</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0f172a] text-slate-200">
      <header className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setView('landing')} className="bg-emerald-600 p-2 rounded-xl shadow-lg shadow-emerald-900/20 hover:scale-105 transition-transform">
              <Trophy className="text-white w-6 h-6" />
            </button>
            <div>
              <h1 className="text-xl font-black tracking-tighter text-white uppercase italic cursor-pointer" onClick={() => setView('landing')}>
                LIGA<span className="text-emerald-500">MASTER</span> <span className="text-[10px] not-italic font-mono bg-slate-800 px-2 py-0.5 rounded ml-2 text-slate-400 border border-slate-700">PRO_ENGINE</span>
              </h1>
            </div>
          </div>
          <div className="text-right hidden md:block">
            {state && (
              <div className="flex flex-col items-end">
                <p className="text-xs font-bold text-white uppercase tracking-widest px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  {state.rules.name}
                </p>
                <p className="text-[9px] text-slate-500 font-mono mt-1 uppercase">Sistema Ativo</p>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-800/40 rounded-3xl border border-slate-700/50 p-6 backdrop-blur-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
               <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <Zap className="text-emerald-400 w-5 h-5" />
                </div>
                <h2 className="font-bold text-white tracking-tight uppercase text-sm">Painel IA</h2>
              </div>
              <button onClick={() => setView('wizard')} className="text-[10px] font-black text-emerald-500 hover:text-emerald-400">REINICIAR</button>
            </div>
            
            <div className="mb-6 space-y-3 bg-slate-950/30 p-4 rounded-2xl border border-white/5">
              <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-500 tracking-widest">
                <span>Resumo da Liga</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800">
                  <p className="text-[8px] text-slate-500 uppercase">Status</p>
                  <p className="text-[10px] font-bold text-emerald-400 uppercase">Operacional</p>
                </div>
                <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800">
                  <p className="text-[8px] text-slate-500 uppercase">Equipes</p>
                  <p className="text-[10px] font-bold text-white">{state?.rules.teamsCount || wizardData.teamsCount}</p>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 font-bold uppercase mb-2 ml-1">Refinar Motor Lógico</p>
            <textarea
              className="w-full h-36 bg-slate-950/50 border border-slate-700 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all placeholder:text-slate-600 text-slate-200 font-medium resize-none shadow-inner"
              placeholder="Ex: 'Adicione mais uma rodada de returno...' ou 'Troque o escudo do Arsenal por um canhão...'"
              value={naturalInput}
              onChange={(e) => setNaturalInput(e.target.value)}
            />

            <button
              onClick={handleProcessRules}
              disabled={isProcessing}
              className="w-full mt-6 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:grayscale text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-emerald-900/40 active:scale-95 group"
            >
              {isProcessing ? (
                <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Target className="w-5 h-5 group-hover:rotate-45 transition-transform" />
              )}
              ATUALIZAR REGRAS IA
            </button>
          </div>

          {state && (
            <div className="bg-slate-800/20 rounded-3xl border border-slate-700/30 p-6 space-y-6 animate-in slide-in-from-left-4 duration-500">
               <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Settings className="text-slate-500 w-4 h-4" />
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Configuração</h3>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                      <label className="text-[9px] text-slate-500 font-bold uppercase block mb-1">Título</label>
                      <input 
                        className="w-full bg-transparent border-none p-0 text-sm font-bold text-white focus:ring-0"
                        value={state.rules.name}
                        onChange={(e) => updateRules({ name: e.target.value })}
                      />
                    </div>
                  </div>
               </div>

               <div className="space-y-4 pt-4 border-t border-slate-800">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="text-slate-500 w-4 h-4" />
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Equipes</h3>
                  </div>
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                    {state.teams.map(team => (
                      <div key={team.id} className="bg-slate-900/50 p-3 rounded-2xl border border-slate-800 flex flex-col gap-3 group transition-all hover:border-slate-600">
                        {editingTeamId === team.id ? (
                          <div className="space-y-4 animate-in fade-in duration-300">
                             <div className="flex gap-2 items-center">
                                <input 
                                   className="w-12 bg-slate-950 border border-slate-700 rounded-lg text-center text-lg py-1"
                                   value={team.shield}
                                   onChange={(e) => updateTeam(team.id, { shield: e.target.value })}
                                />
                                <input 
                                   className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1 text-sm text-white font-bold"
                                   value={team.name}
                                   onChange={(e) => updateTeam(team.id, { name: e.target.value })}
                                />
                             </div>
                             
                             <div className="space-y-2">
                               {['primary', 'secondary', 'accent'].map((type) => (
                                 <div key={type} className="flex items-center justify-between gap-2">
                                   <span className="text-[9px] uppercase text-slate-500 font-bold">{type}</span>
                                   <div className="flex flex-wrap gap-1 justify-end">
                                      {COLOR_PRESETS.map(color => (
                                        <button
                                          key={color}
                                          onClick={() => updateTeamColor(team.id, type as any, color)}
                                          className={`w-4 h-4 rounded-full border border-white/10 ${team.colors[type as keyof typeof team.colors] === color ? 'ring-2 ring-emerald-500 scale-110 shadow-lg' : ''}`}
                                          style={{ backgroundColor: color }}
                                        />
                                      ))}
                                   </div>
                                 </div>
                               ))}
                             </div>

                             <button 
                                onClick={() => setEditingTeamId(null)}
                                className="w-full text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl flex items-center justify-center gap-2"
                             >
                               <Save className="w-3 h-3" /> SALVAR
                             </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-xl drop-shadow-md">{team.shield}</span>
                              <div className="flex flex-col">
                                <span className="text-xs font-black text-white truncate max-w-[140px] italic">{team.name}</span>
                                <div className="flex gap-1 mt-1">
                                  <div className="w-3 h-1 rounded-full shadow-inner" style={{ backgroundColor: team.colors.primary }} />
                                  <div className="w-3 h-1 rounded-full shadow-inner" style={{ backgroundColor: team.colors.secondary }} />
                                </div>
                              </div>
                            </div>
                            <button 
                              onClick={() => setEditingTeamId(team.id)}
                              className="p-2 opacity-0 group-hover:opacity-100 hover:bg-slate-800 rounded-xl transition-all"
                            >
                              <Edit2 className="w-3 h-3 text-emerald-500" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
               </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-8 space-y-6">
          {!state ? (
            <div className="h-full min-h-[500px] flex flex-col items-center justify-center bg-slate-800/10 rounded-[40px] border-4 border-dashed border-slate-800/50 text-slate-600 p-12">
              <div className="p-8 bg-slate-800/50 rounded-full mb-6 border border-slate-700 shadow-2xl">
                <Dices className="w-20 h-20 text-slate-700 animate-spin-slow" />
              </div>
              <h3 className="text-3xl font-black text-slate-500 uppercase tracking-tighter italic">Engine Stand-by</h3>
              <p className="text-sm font-bold mt-2 max-w-sm text-center opacity-60">Complete o wizard inteligente para ativar o motor de simulação e geração de confrontos.</p>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
              <div className="flex p-1.5 bg-slate-900/80 backdrop-blur-xl rounded-[28px] border border-slate-800 shadow-2xl sticky top-20 z-40">
                {[
                  { id: 'matches', label: 'Jogos', icon: Calendar },
                  { id: 'table', label: 'Tabela', icon: Users },
                  { id: 'logs', label: 'Relatório', icon: Info },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-[22px] transition-all text-[10px] font-black uppercase tracking-[0.1em] ${
                      activeTab === tab.id 
                      ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-900/40 border border-emerald-500/50' 
                      : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="min-h-[600px]">
                {activeTab === 'matches' && (
                  <div className="space-y-10 pb-20">
                    {Array.from(new Set(state.matches.map(m => m.round))).sort((a: number, b: number) => a - b).map(round => (
                      <div key={round} className="space-y-4">
                        <div className="flex items-center gap-4">
                           <div className="bg-slate-800 px-4 py-1 rounded-full border border-slate-700">
                              <h3 className="text-white text-[10px] font-black uppercase tracking-widest italic">Rodada {round}</h3>
                           </div>
                           <div className="flex-1 h-px bg-gradient-to-r from-slate-800 to-transparent" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          {state.matches.filter(m => m.round === round).map(match => {
                            const home = state.teams.find(t => t.id === match.homeTeamId);
                            const away = state.teams.find(t => t.id === match.awayTeamId);
                            return (
                              <div 
                                key={match.id}
                                className="bg-slate-800/30 border border-slate-700/50 rounded-[28px] p-6 hover:bg-slate-800/50 transition-all border-l-[6px] group shadow-xl relative overflow-hidden"
                                style={{ borderLeftColor: home?.colors.primary }}
                              >
                                <div className="space-y-4 relative z-10">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 flex-1 overflow-hidden">
                                       <span className="text-2xl">{home?.shield}</span>
                                       <span className="text-sm font-black text-slate-100 truncate italic">{home?.name}</span>
                                    </div>
                                    <input 
                                      type="number"
                                      className="w-14 bg-slate-950/80 border border-slate-700 rounded-2xl text-center text-lg font-black py-3 focus:ring-2 focus:ring-emerald-500 outline-none text-emerald-400 shadow-inner"
                                      defaultValue={match.homeScore}
                                      onBlur={(e) => updateScore(match.id, parseInt(e.target.value) || 0, match.awayScore || 0)}
                                    />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 flex-1 overflow-hidden">
                                       <span className="text-2xl">{away?.shield}</span>
                                       <span className="text-sm font-black text-slate-100 truncate italic">{away?.name}</span>
                                    </div>
                                    <input 
                                      type="number"
                                      className="w-14 bg-slate-950/80 border border-slate-700 rounded-2xl text-center text-lg font-black py-3 focus:ring-2 focus:ring-emerald-500 outline-none text-emerald-400 shadow-inner"
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

                {activeTab === 'table' && (
                  <div className="bg-slate-900/50 border border-slate-800 rounded-[32px] overflow-hidden shadow-2xl backdrop-blur-sm">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-950/40 text-slate-500 text-[9px] uppercase font-black tracking-[0.2em]">
                          <th className="p-6 w-20 text-center">Pos</th>
                          <th className="p-6">Time Identity</th>
                          <th className="p-6 text-center">Pts</th>
                          <th className="p-6 text-center">PJ</th>
                          <th className="p-6 text-center">SG</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {standings.map((team, idx) => (
                          <tr key={team.id} className={`hover:bg-slate-800/40 transition-all ${idx < 4 ? 'bg-emerald-500/[0.03]' : ''} group cursor-default`}>
                            <td className="p-6 text-center">
                              <span className={`text-sm font-black ${idx < 4 ? 'text-emerald-400' : 'text-slate-500'} group-hover:scale-110 transition-transform inline-block`}>
                                {idx + 1}
                              </span>
                            </td>
                            <td className="p-6">
                               <div className="flex items-center gap-4">
                                  <span className="text-2xl grayscale group-hover:grayscale-0 transition-all scale-110">{team.shield}</span>
                                  <div className="flex flex-col">
                                     <span className="text-sm font-black text-white uppercase italic tracking-tight group-hover:text-emerald-400 transition-colors">
                                        {team.name}
                                     </span>
                                     <div className="flex gap-1 mt-1 opacity-60">
                                        <div className="w-4 h-1 rounded-full shadow-sm" style={{ backgroundColor: team.colors.primary }} />
                                        <div className="w-4 h-1 rounded-full shadow-sm" style={{ backgroundColor: team.colors.secondary }} />
                                     </div>
                                  </div>
                               </div>
                            </td>
                            <td className="p-6 text-center font-black text-emerald-500 text-lg">{team.points}</td>
                            <td className="p-6 text-center text-slate-400 font-mono text-xs">{team.played}</td>
                            <td className="p-6 text-center font-mono text-xs font-black text-slate-100 italic">
                               {team.goalDiff > 0 ? `+${team.goalDiff}` : team.goalDiff}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeTab === 'logs' && (
                  <div className="space-y-6">
                    {state.logs.map((log, idx) => (
                      <div key={idx} className="bg-slate-900/40 border border-slate-800 p-8 rounded-[32px] flex gap-6 hover:border-emerald-500/40 transition-all group shadow-xl">
                        <div className="flex flex-col items-center">
                           <div className={`w-3 h-3 rounded-full shadow-lg ${log.action === 'VAL_ERROR' ? 'bg-red-500' : 'bg-emerald-500 shadow-emerald-500/50'}`} />
                           <div className="flex-1 w-px bg-slate-800 my-2" />
                        </div>
                        <div className="flex-1 space-y-3">
                           <div className="flex justify-between items-center">
                              <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">{log.action}</span>
                              <span className="text-[10px] text-slate-600 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
                           </div>
                           <p className="text-md font-black text-white italic">{log.reason}</p>
                           <div className="flex items-center gap-3 text-xs text-slate-400 italic bg-slate-950/80 p-4 rounded-2xl border border-slate-800/60 shadow-inner">
                              <ChevronRight className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                              {log.impact}
                           </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="p-10 text-center bg-slate-950 border-t border-slate-900">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center opacity-40">
           <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.4em]">
              LIGAMASTER PRO IDENTITY & REGULATORY ENGINE
           </p>
           <p className="text-[8px] text-slate-600 font-mono">
              BUILD: 2024.05.FINAL
           </p>
        </div>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.3);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e293b;
          border-radius: 10px;
          border: 1px solid #334155;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 12s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default App;
