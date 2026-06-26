import { useEffect, useMemo, useRef, useState } from 'react';
import { loadAllData, insertRonda, upsertUsers, syncAllData, uploadAudio, authenticateUser } from './lib/database';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export type UserRole = 'admin' | 'tecnico';
export type User = { id: string; name: string; email: string; role: UserRole; password: string; active: boolean };
export type OccurrenceCategory = 'Briga' | 'Cerca/Muro' | 'Bullying' | 'Pátio' | 'Área de Alimentação' | 'Cozinha' | 'Portão' | 'Celular';
export type Ronda = {
  id: string; schoolId: string; tecnicoId: string; tecnicoName: string; date: string;
  categories: OccurrenceCategory[]; audioBlobUrl?: string | null; audioDescription: string;
  observacoes: string; status: 'registrada' | 'encaminhada' | 'concluida'; prioridade: 'Baixa' | 'Média' | 'Alta' | 'Crítica';
};
export type Encaminhamento = {
  id: string; rondaId: string; schoolName: string; titulo: string; categorias: OccurrenceCategory[];
  date: string; status: 'Pendente' | 'Em Andamento' | 'Concluído';
  notas: { date: string; author: string; text: string }[];
};

const SCHOOLS = [
  { id: 'cei-lf', name: 'CEI LUIZ FELIPE', bairro: 'Vila Nova' },
  { id: 'cei-sc', name: 'CEI SAO CRISTOVAO', bairro: 'Centro' },
  { id: 'cei-ai', name: 'CEI ARCO IRIS', bairro: 'Jd. América' },
  { id: 'cei-bl', name: 'CEI BRUNO LEONARDO', bairro: 'São José' },
  { id: 'cei-df', name: 'CEI DOM FRANCO', bairro: 'Vila Real' },
  { id: 'cei-mj', name: 'CEI MENINO JESUS', bairro: 'Bela Vista' },
  { id: 'cei-nl', name: 'CEI NOSSO LAR', bairro: 'Santa Cruz' },
  { id: 'cei-vp', name: 'CEI VASCO PAPA', bairro: 'Industrial' },
  { id: 'cei-cf', name: 'CEI CRIANÇA FELIZ', bairro: 'Alvorada' },
  { id: 'cem-g', name: 'CEM GUILHERME', bairro: 'Centro' },
  { id: 'cem-op', name: 'CEM ORLANDO PEREIRA', bairro: 'União' },
  { id: 'em-mh', name: 'EM MARIA HILDA', bairro: 'Boa Vista' },
  { id: 'em-pf', name: 'EM PAULO FREIRE', bairro: 'Campestre' },
  { id: 'em-ja', name: 'EM JOSE ANCHIETA', bairro: 'Leste' },
  { id: 'erm-aa', name: 'ERM ALVARES AZEVEDO', bairro: 'Rural Norte' },
  { id: 'erm-cc', name: 'ERM CORA CORALINA', bairro: 'Rural Sul' },
  { id: 'erm-ec', name: 'ERM EUCLIDES CUNHA', bairro: 'Rural Leste' },
  { id: 'erm-oc', name: 'ERM OSVALDO CRUZ', bairro: 'Vila Verde' },
  { id: 'erm-vm', name: 'ERM VINICIUS DE MORAIS', bairro: 'Rural Oeste' },
];

const CATEGORIAS: { key: OccurrenceCategory; hint: string }[] = [
  { key: 'Briga', hint: 'Conflito entre alunos' },
  { key: 'Cerca/Muro', hint: 'Danos / invasão' },
  { key: 'Bullying', hint: 'Sit. de intimidação' },
  { key: 'Pátio', hint: 'Infra / fluxo' },
  { key: 'Área de Alimentação', hint: 'Refeitório' },
  { key: 'Cozinha', hint: 'Normas / equipamentos' },
  { key: 'Portão', hint: 'Controle de acesso' },
  { key: 'Celular', hint: 'Uso indevido / apreensão' },
];

const INIT_USERS: User[] = [
  { id: 'u1', name: 'Pedro', email: 'admin', role: 'admin', password: 'Admin123', active: true },
  { id: 'u2', name: 'Ana Técnica', email: 'tecnico', role: 'tecnico', password: 'Tec123', active: true },
];

const genInitialRondas = (): Ronda[] => {
  const now = Date.now();
  const sample: Omit<Ronda, 'id' | 'date'>[] = [
    { schoolId: 'em-pf', tecnicoId: 'u1', tecnicoName: 'Pedro', categories: ['Portão', 'Pátio'], audioBlobUrl: null, audioDescription: 'Portão leste com trinco solto. Fluxo intenso na saída.', observacoes: 'Solicitado reparo emergencial.', status: 'encaminhada', prioridade: 'Alta' },
    { schoolId: 'cei-ai', tecnicoId: 'u1', tecnicoName: 'Pedro', categories: ['Área de Alimentação'], audioBlobUrl: null, audioDescription: 'Refeitório ok.', observacoes: 'Rotina tranquila.', status: 'registrada', prioridade: 'Baixa' },
    { schoolId: 'em-ja', tecnicoId: 'u1', tecnicoName: 'Pedro', categories: ['Bullying', 'Briga'], audioBlobUrl: null, audioDescription: 'Ocorrência no 8º ano. Relato gravado.', observacoes: 'Pedagógico acionado.', status: 'encaminhada', prioridade: 'Crítica' },
    { schoolId: 'erm-cc', tecnicoId: 'u1', tecnicoName: 'Pedro', categories: ['Cerca/Muro'], audioBlobUrl: null, audioDescription: 'Cerca rural 12m danificada.', observacoes: 'Risco de animais.', status: 'encaminhada', prioridade: 'Média' },
    { schoolId: 'cei-sc', tecnicoId: 'u1', tecnicoName: 'Pedro', categories: ['Cozinha'], audioBlobUrl: null, audioDescription: 'Cozinha em conformidade.', observacoes: '-', status: 'concluida', prioridade: 'Baixa' },
    { schoolId: 'erm-oc', tecnicoId: 'u1', tecnicoName: 'Pedro', categories: ['Portão', 'Cerca/Muro'], audioBlobUrl: null, audioDescription: 'Portaria precisa de iluminação.', observacoes: 'Solicitado à manutenção.', status: 'registrada', prioridade: 'Média' },
    { schoolId: 'cei-mj', tecnicoId: 'u1', tecnicoName: 'Pedro', categories: ['Pátio'], audioBlobUrl: null, audioDescription: 'Piso solto próximos ao parque.', observacoes: 'Sinalizado.', status: 'encaminhada', prioridade: 'Alta' },
  ];
  return sample.map((s, i) => ({ ...s, id: `r${i + 1}`, date: new Date(now - (i + 1) * 1000 * 60 * 60 * 26).toISOString() }));
};
const genInitialEncaminhamentos = (rondas: Ronda[]): Encaminhamento[] => {
  const encRondas = rondas.filter(r => r.status !== 'registrada').slice(0, 5);
  return encRondas.map((r, i) => ({
    id: `enc-${r.id}`,
    rondaId: r.id,
    schoolName: SCHOOLS.find(s => s.id === r.schoolId)?.name ?? '',
    titulo: r.categories.join(' · '),
    categorias: r.categories,
    date: r.date,
    status: (['Pendente', 'Em Andamento', 'Concluído'] as const)[i % 3],
    notas: [{ date: r.date, author: 'NISE Coordenação', text: 'Encaminhamento aberto automaticamente após o registro da ronda.' }]
  }));
};

function useLocalStore() {
  const [users, setUsers] = useState<User[]>(() => {
    const raw = localStorage.getItem('nise_users_v5');
    return raw ? JSON.parse(raw) : INIT_USERS;
  });
  const [rondas, setRondas] = useState<Ronda[]>(() => {
    const raw = localStorage.getItem('nise_rondas_v5');
    return raw ? JSON.parse(raw) : genInitialRondas();
  });
  const [encaminhamentos, setEncaminhamentos] = useState<Encaminhamento[]>(() => {
    const raw = localStorage.getItem('nise_enc_v5');
    if (raw) return JSON.parse(raw);
    const rond = localStorage.getItem('nise_rondas_v5');
    return genInitialEncaminhamentos(rond ? JSON.parse(rond) : genInitialRondas());
  });
  const [dbLoaded, setDbLoaded] = useState(false);

  // Load from Supabase on mount (overwrites localStorage seed data)
  useEffect(() => {
    loadAllData().then((data) => {
      if (data.users.length) setUsers(data.users);
      if (data.rondas.length) setRondas(data.rondas);
      if (data.encaminhamentos.length) setEncaminhamentos(data.encaminhamentos);
    }).finally(() => setDbLoaded(true));
  }, []);

  // Local cache
  useEffect(() => { localStorage.setItem('nise_users_v5', JSON.stringify(users)); }, [users]);
  useEffect(() => { localStorage.setItem('nise_rondas_v5', JSON.stringify(rondas)); }, [rondas]);
  useEffect(() => { localStorage.setItem('nise_enc_v5', JSON.stringify(encaminhamentos)); }, [encaminhamentos]);

  // Sync to Supabase (debounced, only after initial load)
  useEffect(() => {
    if (!dbLoaded) return;
    const timer = setTimeout(() => syncAllData(users, rondas, encaminhamentos), 600);
    return () => clearTimeout(timer);
  }, [users, rondas, encaminhamentos, dbLoaded]);

  return { users, setUsers, rondas, setRondas, encaminhamentos, setEncaminhamentos };
}

/* --- ICONS --- */
const I = {
  shield: (p:any)=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M12 3l7 3v6c0 5-3.4 7.7-7 8.4-3.6-.7-7-3.4-7-8.4V6l7-3Z"/></svg>,
  layout:(p:any)=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>,
  list:(p:any)=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></svg>,
  clip:(p:any)=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>,
  file:(p:any)=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>,
  users:(p:any)=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  map:(p:any)=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M14.5 2H6a2 2 0 0 0-2 2v16"/><path d="M18 2h-3.5l-6 20H12a2 2 0 0 0 2-2V2Z"/></svg>,
  mic:(p:any)=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z"/><path d="M19 10a7 7 0 0 1-14 0"/><path d="M12 19v4M8 23h8"/></svg>,
  check:(p:any)=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M20 6 9 17l-5-5"/></svg>,
  search:(p:any)=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  bell:(p:any)=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  logout:(p:any)=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>,
  x:(p:any)=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M18 6 6 18M6 6l12 12"/></svg>,
  menu:(p:any)=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M4 6h16M4 12h16M4 18h16"/></svg>,
};

/* --- Shell --- */
function AppShell() {
  const store = useLocalStore();
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const raw = localStorage.getItem('nise_session');
    return raw ? JSON.parse(raw) : null;
  });
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      authenticateUser(currentUser.email, currentUser.password)
        .then(({ user, error }) => {
          if (!user || error) {
            localStorage.removeItem('nise_session');
            setCurrentUser(null);
          }
        })
        .catch(() => {
          localStorage.removeItem('nise_session');
          setCurrentUser(null);
        })
        .finally(() => setAuthLoading(false));
    } else {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser) localStorage.setItem('nise_session', JSON.stringify(currentUser));
    else localStorage.removeItem('nise_session');
  }, [currentUser]);

  if (authLoading) return (
    <div className="min-h-screen bg-[#f6f0e5] flex items-center justify-center">
      <div className="flex items-center gap-3 text-[#8d725a]">
        <svg className="animate-spin h-6 w-6 text-[#c7481f]" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        Verificando sessão...
      </div>
    </div>
  );

  if (!currentUser) return <LoginScreen onLogin={setCurrentUser} />;
  if (currentUser.role === 'admin') return <AdminApp currentUser={currentUser} onLogout={() => { setCurrentUser(null); localStorage.removeItem('nise_session'); }} store={store} />;
  return <TecnicoApp currentUser={currentUser} onLogout={() => { setCurrentUser(null); localStorage.removeItem('nise_session'); }} store={store} />;
}

/* ---------- LOGIN ---------- */
function LoginScreen({ onLogin }: { onLogin: (u: User) => void }) {
  const [email, setEmail] = useState('admin');
  const [pass, setPass] = useState('Admin123');
  const [rolePick, setRolePick] = useState<UserRole>('admin');
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoginError(null);
    const { user, error } = await authenticateUser(email, pass);
    if (user) { toast.success(`Bem-vinda, ${user.name.split(' ')[0]}.`); onLogin(user); }
    else { setLoginError(error ?? 'Usuário ou senha inválidos.'); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#f6f0e5] text-[#182924] relative overflow-hidden" style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>
      <div className="absolute inset-0 opacity-[0.035]" style={{backgroundImage:`url("data:image/svg+xml,%3Csvg width='120' height='120' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`}}/>
      <div className="max-w-[1160px] mx-auto px-6 md:px-12 lg:px-14 py-14 md:py-20 relative">
        <header className="flex items-center justify-between mb-16 md:mb-24">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-[13px] bg-[#153330] flex items-center justify-center text-[#f1e3c9] shadow-sm">
              <I.shield className="w-[21px] h-[21px]" />
            </div>
            <div>
              <div className="text-[11.6px] tracking-wider text-[#8a7260]" style={{ fontFamily: 'Fragment Mono, monospace' }}>SME • 2026</div>
              <div className="text-[15.5px] font-[700] tracking-tight -mt-[1px]">NISE</div>
            </div>
          </div>
          <div className="hidden sm:block text-[11.5px] text-[#9a7f66]" style={{ fontFamily: 'Fragment Mono, monospace' }}>NÚCLEO DE INTELIGÊNCIA • v3.4</div>
        </header>

        <div className="grid lg:grid-cols-[1.12fr_.88fr] gap-14 xl:gap-20 items-center">
          {/* Left copy */}
          <div>
            <div className="text-[11.7px] tracking-widest text-[#ca4a1f] font-[700]" style={{ fontFamily: 'Fragment Mono, monospace' }}>NÚCLEO DE INTELIGÊNCIA E SEGURANÇA ESCOLAR</div>
            <h1 className="mt-4 text-[52px] md:text-[70px] lg:text-[78px] leading-[0.92] tracking-[-0.035em] text-[#162721]" style={{ fontFamily: 'Fraunces, serif', fontWeight: 700 }}>
              Ronda técnica,<br/>resposta rápida.
            </h1>
            <p className="mt-7 text-[18.7px] leading-relaxed text-[#4b5d58] max-w-[540px]">
              Plataforma tática para monitoramento contínuo das 19 unidades escolares municipais. Registro de ocorrências, áudio de campo e encaminhamentos em tempo real.
            </p>

            <div className="mt-12 rounded-[26px] bg-[#fffaf1]/90 ring-1 ring-[#e3c9aa] p-5 md:p-6 shadow-[0_18px_48px_rgba(111,70,35,0.11)] max-w-[560px]">
              <div className="text-[11px] tracking-wider text-[#a06f4d]" style={{ fontFamily: 'Fragment Mono, monospace' }}>MAPA DE COBERTURA • REDE MUNICIPAL</div>
              <div className="mt-3 relative rounded-[16px] bg-[#f3e5cf] ring-1 ring-[#e1c49f] h-[168px] overflow-hidden">
                <div className="absolute inset-0 opacity-[0.55]" style={{backgroundImage: `radial-gradient(circle at 18% 60%, #d9b98e 0px, transparent 18px),
                  radial-gradient(circle at 44% 38%, #d9b98e 0 14px, transparent 15px),
                  radial-gradient(circle at 67% 65%, #d9b98e 0 13px, transparent 14px),
                  radial-gradient(circle at 81% 33%, #d9b98e 0 12px, transparent 13px)`}}/>
                {/* school dots */}
                {[
                  [20,54],[28,38],[35,66],[46,28],[53,55],[60,42],[66,70],[73,49],[82,34],[30,76],[52,79],[70,22],[22,22],[88,60],[11,42],[42,17],[92,77],[79,80],[58,13]
                ].map(([x,y],i)=>(
                  <div key={i} className="absolute w-[7px] h-[7px] bg-[#1b3b36] rounded-full shadow" style={{left:`${x}%`, top:`${y}%`}} />
                ))}
                <div className="absolute bottom-3 left-4 text-[11px] text-[#6e5a42] font-[600]">19 escolas ativas • 3 regiones de ronda</div>
              </div>
              <div className="mt-3 grid grid-cols-3 text-[13.5px] text-[#50635d]">
                <div><span className="text-[24px] text-[#16332e]" style={{ fontFamily: 'Fraunces, serif', fontWeight: 700 }}>19</span><br/>unidades</div>
                <div><span className="text-[24px] text-[#16332e]" style={{ fontFamily: 'Fraunces, serif', fontWeight: 700 }}>7</span><br/>categorias</div>
                <div><span className="text-[24px] text-[#16332e]" style={{ fontFamily: 'Fraunces, serif', fontWeight: 700 }}>24h</span><br/>SLA</div>
              </div>
            </div>

            <div className="mt-8 text-[11.8px] text-[#927562] flex flex-wrap gap-8" style={{ fontFamily: 'Fragment Mono, monospace' }}>
              <span>CEI • CEM • EM • ERM</span>
              <span>CRIPTO ATIVO</span>
              <span>LGPD CONFORME</span>
            </div>
          </div>

          {/* Right auth */}
          <div className="relative">
            <div className="absolute -inset-6 bg-gradient-to-br from-[#edcfaf]/80 to-transparent rounded-[36px] blur-[28px]" />
            <div className="relative rounded-[30px] bg-[#fffcf6] ring-1 ring-[#dfc3a3] shadow-[0_32px_80px_rgba(84,54,26,0.21)] px-8 md:px-10 py-10">
              <div className="text-[11px] tracking-[0.18em] text-[#c75020]" style={{ fontFamily: 'Fragment Mono, monospace' }}>ACESSO AUTORIZADO</div>
              <h2 className="mt-2 text-[32px] tracking-tight text-[#1a2c27]" style={{ fontFamily: 'Fraunces, serif', fontWeight: 700 }}>Entrar no NISE</h2>

              <form onSubmit={handle} className="mt-7 space-y-5">
                <div className="flex gap-1.5 p-1 rounded-full bg-[#f3e5cf] ring-1 ring-[#e3c8a7]">
                  {(['admin','tecnico'] as UserRole[]).map(r=>(
                    <button key={r} type="button"
                      onClick={()=>{ setRolePick(r); setEmail(r === 'admin' ? 'admin' : 'tecnico'); setPass(r === 'admin' ? 'Admin123' : 'Tec123'); }}
                      className={`flex-1 px-4 py-2.5 rounded-full text-[13.4px] font-[650] transition ${rolePick===r ? 'bg-white text-[#1a2e29] shadow-sm' : 'text-[#7f6851]'}`}>
                      {r === 'admin' ? 'Administrador' : 'Técnico de Ronda'}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="text-[11px] tracking-wider text-[#7b6554]" style={{ fontFamily: 'Fragment Mono, monospace' }}>USUÁRIO</label>
                  <input value={email} onChange={e=>setEmail(e.target.value)}
                    className="mt-1.5 w-full bg-[#f8f1e4] ring-1 ring-[#e1c7a4] rounded-[14px] px-4 py-3.5 outline-none focus:ring-2 focus:ring-[#d86b35]/30 text-[15px]"
                    placeholder="admin ou e-mail institucional" />
                </div>
                <div>
                  <label className="text-[11px] tracking-wider text-[#7b6554]" style={{ fontFamily: 'Fragment Mono, monospace' }}>SENHA</label>
                  <input type="password" value={pass} onChange={e=>setPass(e.target.value)}
                    className="mt-1.5 w-full bg-[#f8f1e4] ring-1 ring-[#e1c7a4] rounded-[14px] px-4 py-3.5 outline-none focus:ring-2 focus:ring-[#d86b35]/30 text-[15px]" />
                </div>
                {loginError && (
                  <div className="text-[12.8px] text-[#b34e22] bg-[#fde8e0] rounded-[12px] px-4 py-3">{loginError}</div>
                )}
                <button type="submit" disabled={loading}
                  className="w-full rounded-[14px] bg-[#17332f] hover:bg-[#1e413c] text-[#f1e0c7] py-3.5 font-[750] text-[15px] transition shadow-[0_10px_26px_rgba(22,51,47,0.24)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {loading && <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                  {loading ? 'Validando...' : 'Entrar no sistema →'}
                </button>
              </form>
            </div>
            <div className="mt-4 text-center text-[11.8px] text-[#a38669]">Acesso restrito. Sessão auditada.</div>
          </div>
        </div>

        <footer className="mt-20 text-[12.4px] text-[#a18465]">Desenvolvido pelo Departamento de Tecnologia da SME • Núcleo de Inteligência e Segurança Escolar</footer>
      </div>
    </div>
  );
}

/* ---------- ADMIN APP ---------- */
function AdminApp({ currentUser, onLogout, store }: { currentUser: User; onLogout: () => void; store: ReturnType<typeof useLocalStore> }) {
  const [view, setView] = useState<'dashboard'|'rondas'|'encaminhamentos'|'relatorios'|'usuarios'|'monitoramento'>('dashboard');
  const [mobileMenu, setMobileMenu] = useState(false);

  const nav = [
    { k: 'dashboard', label: 'Painel Tático', icon: I.layout },
    { k: 'monitoramento', label: 'Monitoramento', icon: I.bell },
    { k: 'rondas', label: 'Rondas', icon: I.list },
    { k: 'encaminhamentos', label: 'Encaminhamentos', icon: I.clip },
    { k: 'relatorios', label: 'Relatórios PDF', icon: I.file },
    { k: 'usuarios', label: 'Usuários', icon: I.users },
  ] as const;

  return (
    <div className="min-h-screen bg-[#f7f0e5] text-[#1e2c28]" style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>
      <Toaster richColors position="top-right" />

      {/* Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-[264px] bg-[#fdf8ef] border-r border-[#e4cfb4] flex-col z-40">
        <div className="px-7 pt-7 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[12px] bg-[#17332f] text-[#f0dcc0] flex items-center justify-center"><I.shield className="w-[20px] h-[20px]" /></div>
            <div>
              <div className="text-[15.8px] font-[780] tracking-tight">NISE</div>
              <div className="text-[11.3px] text-[#86705d] -mt-[2px]" style={{ fontFamily: 'Fragment Mono, monospace' }}>SME • Seg. Escolar</div>
            </div>
          </div>
        </div>

        <nav className="px-4 flex-1">
          <div className="text-[10.8px] tracking-widest text-[#b1845e] px-3 mb-2" style={{ fontFamily: 'Fragment Mono, monospace' }}>NAVEGAÇÃO</div>
          <div className="space-y-1.5">
            {nav.map(n=>{
              const active = view===n.k;
              return (
                <button key={n.k} onClick={()=>setView(n.k as any)}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-[14px] transition text-[13.8px] ${active ? 'bg-[#1a3531] text-[#f2e0c4] shadow-[0_8px_22px_rgba(21,46,42,0.2)]' : 'text-[#42514c] hover:bg-[#f2e4cf]'}`}>
                  <n.icon className="w-[18px] h-[18px] opacity-90" />
                  <span className={`${active ? 'font-[700]' : 'font-[560]'}`}>{n.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="px-5 pb-6 pt-4 border-t border-[#ebd2b6]">
          <div className="rounded-[16px] bg-[#f3e5cf] ring-1 ring-[#dfc0a0] px-4 py-3 text-[12.5px] text-[#5c4b39]">
            <div className="font-[700]">Rede sincronizada</div>
            <div className="text-[#7a6550]">Última ronda há 3h</div>
          </div>
          <div className="mt-3 text-[11.7px] text-[#9b7e63]">Desenvolvido pelo Depto. de Tecnologia da SME</div>
        </div>
      </aside>

      {/* Main column */}
      <div className="lg:pl-[264px]">
        {/* Top bar */}
        <header className="sticky top-0 z-30 backdrop-blur bg-[#f7f0e5]/84 border-b border-[#e5cfb4]">
          <div className="h-[70px] px-5 md:px-9 flex items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <button onClick={()=>setMobileMenu(true)} className="lg:hidden p-2 rounded-xl bg-white ring-1 ring-[#e3c9a9]"><I.menu className="w-[18px] h-[18px]" /></button>
              <div className="hidden md:flex items-center gap-2 text-[12.8px] text-[#7b6a57]">
                <span style={{ fontFamily: 'Fragment Mono, monospace' }}>PAINEL</span>
                <span className="opacity-50">/</span>
                <span className="font-[670] text-[#24342f]">{nav.find(n=>n.k===view)?.label}</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button className="hidden md:inline-flex items-center gap-2 text-[12.8px] px-3 py-2 rounded-full bg-white ring-1 ring-[#e3c8a8] text-[#5e4d39]">
                <I.bell className="w-4 h-4" /> 3 alertas
              </button>
              <div className="hidden sm:block text-right leading-tight">
                <div className="text-[13.2px] font-[680]">{currentUser.name}</div>
                <div className="text-[11.5px] text-[#7c6e60]">Administrador</div>
              </div>

              <button onClick={onLogout} className="text-[12.4px] px-3 py-1.5 rounded-full bg-white ring-1 ring-[#e4cab1] hover:bg-[#fdf7ef] text-[#5a4632] flex items-center gap-1.5"><I.logout className="w-[15px] h-[15px]" /> Sair</button>
            </div>
          </div>
        </header>

        {/* Mobile drawer */}
        <AnimatePresence>
          {mobileMenu && (
            <>
              <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/30 z-[60] lg:hidden" onClick={()=>setMobileMenu(false)} />
              <motion.aside initial={{x:-300}} animate={{x:0}} exit={{x:-300}} className="fixed left-0 top-0 h-full w-[280px] bg-[#fcf7ee] border-r border-[#e8d0b2] z-[70] p-6 lg:hidden">
                <div className="flex items-center justify-between mb-5">
                  <div className="font-[740]">NISE • Menu</div>
                  <button onClick={()=>setMobileMenu(false)} className="p-2 rounded-lg bg-white ring-1 ring-[#e3c9a8]"><I.x className="w-4 h-4"/></button>
                </div>
                <div className="space-y-1.5">
                  {nav.map(n=>(
                    <button key={n.k} onClick={()=>{ setView(n.k as any); setMobileMenu(false); }}
                      className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-[13px] text-[14px] ${view===n.k ? 'bg-[#1a3531] text-[#f1ddc1]' : 'hover:bg-[#f1e0c8] text-[#37443f]'}`}>
                      <n.icon className="w-[18px] h-[18px]" /> {n.label}
                    </button>
                  ))}
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <main className="px-5 md:px-9 py-8 md:py-11 max-w-[1240px]">
          <AnimatePresence mode="wait">
            <motion.div key={view} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .22 }}>
              {view === 'dashboard' && <AdminDashboard store={store} onOpenEnc={()=>setView('encaminhamentos')} />}
              {view === 'rondas' && <RondasList store={store} admin />}
              {view === 'monitoramento' && <MonitoramentoBoard store={store} />}
              {view === 'encaminhamentos' && <EncaminhamentosBoard store={store} />}
              {view === 'relatorios' && <RelatoriosView store={store} />}
              {view === 'usuarios' && <UsuariosView store={store} />}
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="px-5 md:px-9 py-8 text-[12.2px] text-[#a78968] border-t border-[#e8cfb1] bg-[#fbf6ec]">Desenvolvido pelo Departamento de Tecnologia da SME</footer>
      </div>
    </div>
  );
}

/* ---------- Admin Dashboard ---------- */
function AdminDashboard({ store, onOpenEnc }: { store: ReturnType<typeof useLocalStore>; onOpenEnc: ()=>void }) {
  const { rondas, encaminhamentos } = store;
  const kpis = useMemo(() => {
    const last30 = rondas.filter(r => +new Date(r.date) > Date.now() - 30*86400000);
    const visitadas = new Set(last30.map(r => r.schoolId)).size;
    const pendentes = encaminhamentos.filter(e => e.status !== 'Concluído').length;
    const totalOcc = last30.flatMap(r => r.categories).length;
    return [
      { label: 'Ocorrências (30d)', value: totalOcc, sub: '+4 vs. período anterior', tone: 'amber' },
      { label: 'Escolas visitadas', value: `${visitadas}/19`, sub: `${Math.round(visitadas/19*100)}% da rede`, tone: 'green' },
      { label: 'Encaminhamentos ativos', value: pendentes, sub: 'Tempo médio 1,8d', tone: 'orange' },
      { label: 'Taxa de resolução', value: '86%', sub: 'Meta SME: 82%', tone: 'forest' },
    ];
  }, [rondas, encaminhamentos]);

  const catData = useMemo(() => {
    const counts: Record<OccurrenceCategory, number> = {
      'Briga':0,'Cerca/Muro':0,'Bullying':0,'Pátio':0,'Área de Alimentação':0,'Cozinha':0,'Portão':0,'Celular':0
    };
    rondas.forEach(r => r.categories.forEach(c => counts[c]++));
    return Object.entries(counts).map(([name, v]) => ({ name, v }));
  }, [rondas]);

  const escolaData = useMemo(()=>{
    return SCHOOLS.map(s => {
      const rs = rondas.filter(r=>r.schoolId===s.id);
      return { name: s.name.replace(/^(CEI|CEM|EM|ERM)\s+/, ''), ocorr: rs.flatMap(r=>r.categories).length };
    }).sort((a,b)=>b.ocorr-a.ocorr).slice(0,7);
  }, [rondas]);

  const lineData = [
    { m: 'Jan', v: 11 },{ m: 'Fev', v: 14 },{ m: 'Mar', v: 9 },{ m: 'Abr', v: 18 },{ m: 'Mai', v: 15 },{ m: 'Jun', v: 21 },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11.6px] tracking-widest text-[#c34b20] font-[700]" style={{ fontFamily: 'Fragment Mono, monospace' }}>PAINEL TÁTICO • SEMANA 24</div>
          <h1 className="text-[40px] md:text-[46px] tracking-[-0.022em] text-[#152925]" style={{ fontFamily: 'Fraunces, serif', fontWeight: 700 }}>
            Segurança Escolar
          </h1>
          <div className="text-[14.6px] text-[#596a64] mt-1">Visão consolidada das 19 unidades • atualizada há 3h</div>
        </div>
        <div className="flex items-center gap-3 text-[12.4px] text-[#7a6452]">
          <span className="h-[9px] w-[9px] rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.19)]" />
          Rede sincronizada
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="rounded-[22px] bg-[#fffdf8] ring-1 ring-[#e2c6a7] px-5 py-5 shadow-[0_10px_28px_rgba(103,62,28,0.08)]">
            <div className="text-[12px] text-[#8a7360]">{k.label}</div>
            <div className="text-[34px] tracking-tight text-[#1d2f2b]" style={{ fontFamily: 'Fraunces, serif', fontWeight: 700 }}>{k.value}</div>
            <div className="text-[12.3px] text-[#63746e]">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts grid */}
      <div className="grid lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 rounded-[26px] bg-white ring-1 ring-[#e1c7a6] p-6 shadow-[0_16px_44px_rgba(105,67,29,0.09)]">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[15.6px] font-[750] text-[#253a35]">Ocorrências por categoria</div>
            <div className="text-[11.4px] text-[#a57852]" style={{ fontFamily: 'Fragment Mono, monospace' }}>ÚLTIMOS 60 DIAS</div>
          </div>
          <div className="h-[286px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={catData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ebd5bb" />
                <XAxis dataKey="name" tick={{ fontSize: 11.5, fill: '#7c6652' }} interval={0} angle={-18} textAnchor="end" height={60}/>
                <YAxis tick={{ fontSize: 12, fill: '#7b6b57' }} />
                <Tooltip cursor={{ fill: '#f8efe0' }} />
                <Bar dataKey="v" radius={[9,9,6,6]} fill="#cf5427" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 rounded-[26px] bg-[#fdf9f1] ring-1 ring-[#e1c7a6] p-6 shadow-[0_16px_44px_rgba(105,67,29,0.07)]">
          <div className="text-[15.6px] font-[750] text-[#253a35] mb-2">Evolução de rondas</div>
          <div className="h-[164px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ebd4b9" />
                <XAxis dataKey="m" tick={{ fontSize: 11, fill: '#8a7360' }} />
                <YAxis hide />
                <Tooltip />
                <Line type="monotone" dataKey="v" stroke="#1f413b" strokeWidth={2.7} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-3 text-center text-[12.2px] text-[#5c6b65]">
            <div><b className="text-[#1d322d]">88</b><br/>rondas / semestre</div>
            <div><b className="text-[#1d322d]">2,1d</b><br/>SLA médio</div>
            <div><b className="text-[#1d322d]">100%</b><br/>rede coberta</div>
          </div>
        </div>

        <div className="lg:col-span-7 rounded-[26px] bg-white ring-1 ring-[#e1c7a6] p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[15.4px] font-[750] text-[#243935]">Escolas com mais ocorrências</div>
            <button className="text-[12.8px] text-[#ba4b1d] hover:underline" onClick={onOpenEnc}>Ver encaminhamentos →</button>
          </div>
          <div className="h-[248px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={escolaData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ebd6be" horizontal={false}/>
                <XAxis type="number" hide/>
                <YAxis dataKey="name" type="category" width={138} tick={{ fontSize: 11.8, fill: '#695847' }}/>
                <Tooltip />
                <Bar dataKey="ocorr" radius={[0,9,9,0]} fill="#264a42" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 rounded-[26px] bg-[#fcf7ee] ring-1 ring-[#e1c7a6] p-6">
          <div className="text-[15.4px] font-[750] text-[#243935] mb-3">Status de encaminhamentos</div>
          <div className="h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={[{name:'Concluído',value:21},{name:'Em Andamento',value:9},{name:'Pendente',value:5}]} innerRadius={50} outerRadius={70} paddingAngle={3} dataKey="value">
                  <Cell fill="#1f3f39" /><Cell fill="#e4a84f" /><Cell fill="#d1532b" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-5 text-[11.8px] text-[#6b5945] justify-center">
            <span>● Concluído</span><span>● Em Andamento</span><span>● Pendente</span>
          </div>
        </div>
      </div>

      {/* Latest table */}
      <div className="rounded-[26px] bg-[#fffdf8] ring-1 ring-[#e2c5a5] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[15.4px] font-[750]">Últimas rondas registradas</div>
          <div className="text-[11.7px] text-[#a37b58]" style={{ fontFamily: 'Fragment Mono, monospace' }}>ÁUDIO DISPONÍVEL QUANDO INDICADO</div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-[13.5px]">
            <thead className="text-[#8e7260] text-[11.7px]">
              <tr><th className="text-left py-2 font-[650]">Escola</th><th className="text-left py-2 font-[650]">Categorias</th><th className="text-left py-2 font-[650]">Técnico</th><th className="text-left py-2 font-[650]">Prioridade</th><th className="text-left py-2 font-[650]">Áudio</th><th className="text-left py-2 font-[650]">Quando</th><th className="text-left py-2 font-[650]">Status</th></tr>
            </thead>
            <tbody>
              {store.rondas.slice(0,6).map(r => {
                const school = SCHOOLS.find(s=>s.id===r.schoolId);
                return (
                  <tr key={r.id} className="border-t border-[#ebd3b7]">
                    <td className="py-3 pr-6 font-[670] text-[#273630]">{school?.name}</td>
                    <td className="py-3 pr-6 text-[#55645f]">{r.categories.join(', ')}</td>
                    <td className="py-3 pr-6">{r.tecnicoName.split(' ')[0]}</td>
                    <td className="py-3 pr-6"><PriorityPill p={r.prioridade}/></td>
                    <td className="py-3 pr-6 max-w-[180px]">
                      {r.audioBlobUrl ? (
                        <audio controls src={r.audioBlobUrl} className="h-7 w-28" />
                      ) : (
                        <span className="text-[11.4px] text-[#9a8268]">—</span>
                      )}
                      {r.audioDescription && <div className="text-[11px] text-[#6f5f4e] mt-1 line-clamp-2 italic">{r.audioDescription}</div>}
                    </td>
                    <td className="py-3 pr-6 text-[#6e7c77]">{timeAgo(r.date)}</td>
                    <td className="py-3"><span className="text-[11.4px] px-2.5 py-1 rounded-full bg-[#f2e5d2] text-[#68513a]">{r.status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PriorityPill({ p }: { p: Ronda['prioridade'] }) {
  const map: Record<Ronda['prioridade'], string> = {
    'Baixa': 'bg-[#e7f0e4] text-[#256041]',
    'Média':'bg-[#f6e7c9] text-[#94541b]',
    'Alta':'bg-[#f8ddd0] text-[#b73b18]',
    'Crítica':'bg-[#f2cdcd] text-[#a91d1d]'
  };
  return <span className={`text-[11.4px] px-2.5 py-[4px] rounded-full font-[650] ${map[p]}`}>{p}</span>;
}

/* ---------- Rondas List ---------- */
function RondasList({ store, admin }: { store: ReturnType<typeof useLocalStore>; admin?: boolean }) {
  const [q, setQ] = useState('');
  const [fechandoId, setFechandoId] = useState<string | null>(null);
  const [obsFechamento, setObsFechamento] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ categories: OccurrenceCategory[]; prioridade: Ronda['prioridade']; observacoes: string; audioDescription: string } | null>(null);

  const filtered = store.rondas.filter(r => {
    const s = SCHOOLS.find(x=>x.id===r.schoolId);
    return !q || s?.name.toLowerCase().includes(q.toLowerCase()) || r.tecnicoName.toLowerCase().includes(q.toLowerCase());
  });

  const concluirRonda = (id: string) => {
    store.setRondas(rs => rs.map(r => r.id === id ? { ...r, status: 'concluida', observacoes: obsFechamento || r.observacoes } : r));
    setFechandoId(null);
    setObsFechamento('');
    toast.success('Ronda concluída com sucesso.');
  };

  const openEdit = (r: Ronda) => {
    setEditId(r.id);
    setEditForm({ categories: [...r.categories], prioridade: r.prioridade, observacoes: r.observacoes, audioDescription: r.audioDescription });
  };
  const cancelEdit = () => { setEditId(null); setEditForm(null); };
  const saveEdit = () => {
    if (!editId || !editForm) return;
    store.setRondas(rs => rs.map(r => r.id === editId ? { ...r, ...editForm } : r));
    setEditId(null); setEditForm(null);
    toast.success('Ronda atualizada.');
  };
  const toggleEditCat = (c: OccurrenceCategory) => {
    if (!editForm) return;
    setEditForm({ ...editForm, categories: editForm.categories.includes(c) ? editForm.categories.filter(x => x !== c) : [...editForm.categories, c] });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[34px] tracking-tight" style={{ fontFamily: 'Fraunces, serif', fontWeight: 700 }}>Rondas registradas</h2>
          <div className="text-[13.7px] text-[#5a6b65] mt-1">Todas as unidades • histórico completo com áudio quando gravado</div>
        </div>
        <div className="relative">
          <I.search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9d8265]" />
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar por escola ou técnico…"
            className="pl-10 min-w-[300px] bg-white ring-1 ring-[#dfc2a1] rounded-[14px] px-4 py-2.5 outline-none text-[13.7px]" />
        </div>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(r => {
          const school = SCHOOLS.find(s=>s.id===r.schoolId);
          return (
            <div key={r.id} className="rounded-[22px] bg-white ring-1 ring-[#e2c6a6] p-5 shadow-[0_10px_28px_rgba(106,64,31,0.08)] hover:shadow-[0_16px_40px_rgba(106,64,31,0.12)] transition">
              <div className="flex items-center justify-between">
                <div className="text-[11.3px] tracking-wider text-[#9c7a5a]" style={{ fontFamily: 'Fragment Mono, monospace' }}>{new Date(r.date).toLocaleDateString('pt-BR')}</div>
                <PriorityPill p={r.prioridade}/>
              </div>
              <div className="mt-2.5 font-[740] text-[#253630] text-[15.6px]">{school?.name}</div>
              <div className="text-[12.5px] text-[#61716b]">{school?.bairro}</div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {r.categories.map(c => <span key={c} className="text-[11.2px] px-2 py-1 rounded-full bg-[#f1e2cf] text-[#694a2f]">{c}</span>)}
              </div>
              {editId === r.id && editForm ? (
                <div className="mt-2 space-y-2.5">
                  <div>
                    <div className="text-[11px] text-[#7a6552] font-[600] mb-1">Categorias</div>
                    <div className="flex flex-wrap gap-1.5">
                      {CATEGORIAS.map(c => (
                        <button key={c.key} type="button" onClick={()=>toggleEditCat(c.key)}
                          className={`text-[11px] px-2 py-1 rounded-full transition ${editForm.categories.includes(c.key) ? 'bg-[#193835] text-[#f4e4c9]' : 'bg-[#f1e2cf] text-[#694a2f]'}`}>
                          {c.key}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#7a6552] font-[600] mb-1">Prioridade</div>
                    <select value={editForm.prioridade} onChange={e=>setEditForm({...editForm, prioridade: e.target.value as Ronda['prioridade']})}
                      className="w-full bg-[#f8f1e4] ring-1 ring-[#dfc4a2] rounded-[10px] px-3 py-2 text-[13px] outline-none">
                      <option>Baixa</option><option>Média</option><option>Alta</option><option>Crítica</option>
                    </select>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#7a6552] font-[600] mb-1">Descrição do áudio</div>
                    <textarea value={editForm.audioDescription} onChange={e=>setEditForm({...editForm, audioDescription: e.target.value})} rows={2}
                      className="w-full bg-[#f8f1e4] ring-1 ring-[#dfc4a2] rounded-[10px] px-3 py-2 text-[13px] outline-none" />
                  </div>
                  <div>
                    <div className="text-[11px] text-[#7a6552] font-[600] mb-1">Observações</div>
                    <textarea value={editForm.observacoes} onChange={e=>setEditForm({...editForm, observacoes: e.target.value})} rows={2}
                      className="w-full bg-[#f8f1e4] ring-1 ring-[#dfc4a2] rounded-[10px] px-3 py-2 text-[13px] outline-none" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveEdit}
                      className="flex-1 px-3 py-2 rounded-[10px] bg-[#1a3430] text-[#f2e0c5] text-[12.8px] font-[700]">Salvar</button>
                    <button onClick={cancelEdit}
                      className="px-4 py-2 rounded-[10px] ring-1 ring-[#dbb58a] text-[#a64b26] text-[12.8px]">Cancelar</button>
                  </div>
                </div>
              ) : (
                <>
                  {r.audioDescription && (
                    <div className="mt-2.5 text-[12.8px] text-[#4c5f59] italic bg-[#f6efe0] rounded-[10px] px-3 py-2 ring-1 ring-[#e5cdaf]">
                      "{r.audioDescription}"
                    </div>
                  )}
                  {r.audioBlobUrl && (
                    <div className="mt-2.5">
                      <audio controls src={r.audioBlobUrl} className="w-full h-9 rounded-lg" />
                    </div>
                  )}
                  <div className="mt-2 text-[13.2px] text-[#3f514b] line-clamp-2">{r.observacoes || '—'}</div>

                  {fechandoId === r.id ? (
                    <div className="mt-3 space-y-2">
                      <textarea value={obsFechamento} onChange={e=>setObsFechamento(e.target.value)} rows={2}
                        placeholder="Observações de fechamento…"
                        className="w-full bg-[#f8f1e4] ring-1 ring-[#dfc4a2] rounded-[12px] px-3 py-2 text-[13px] outline-none" />
                      <div className="flex gap-2">
                        <button onClick={() => concluirRonda(r.id)}
                          className="flex-1 px-3 py-2 rounded-[10px] bg-[#1a3430] text-[#f2e0c5] text-[12.8px] font-[700]">Confirmar</button>
                        <button onClick={() => { setFechandoId(null); setObsFechamento(''); }}
                          className="px-4 py-2 rounded-[10px] ring-1 ring-[#dbb58a] text-[#a64b26] text-[12.8px]">Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    admin && r.status !== 'concluida' && (
                      <div className="mt-3 flex gap-2">
                        <button onClick={() => openEdit(r)}
                          className="flex-1 py-2 rounded-[10px] bg-[#f6efe0] ring-1 ring-[#dfc4a2] text-[#4a5b55] text-[12.8px] font-[650] hover:bg-[#efe3cf] transition">
                          Editar
                        </button>
                        <button onClick={() => setFechandoId(r.id)}
                          className="flex-1 py-2 rounded-[10px] bg-[#f6efe0] ring-1 ring-[#dfc4a2] text-[#4a5b55] text-[12.8px] font-[650] hover:bg-[#efe3cf] transition">
                          Concluir
                        </button>
                      </div>
                    )
                  )}
                </>
              )}

              <div className="mt-3 flex items-center justify-between text-[12.2px] text-[#77857f] border-t border-[#f0d8ba] pt-3">
                <span>{r.tecnicoName}</span>
                <span>{r.status === 'concluida' ? 'Concluída' : timeAgo(r.date)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Encaminhamentos ---------- */
function EncaminhamentosBoard({ store }: { store: ReturnType<typeof useLocalStore> }) {
  const { encaminhamentos, setEncaminhamentos, rondas } = store;
  const [selected, setSelected] = useState<Encaminhamento | null>(encaminhamentos[0] ?? null);
  const [nota, setNota] = useState('');
  const [concluirObs, setConcluirObs] = useState('');

  const cols: Encaminhamento['status'][] = ['Pendente', 'Em Andamento', 'Concluído'];

  const move = (id: string, status: Encaminhamento['status']) => {
    if (status === 'Concluído' && !concluirObs.trim()) {
      toast.error('Escreva as observações de conclusão.');
      return;
    }
    setEncaminhamentos(enc => enc.map(e => e.id === id ? {
      ...e, status,
      notas: status === 'Concluído' && concluirObs.trim()
        ? [{ date: new Date().toISOString(), author: 'Administrador', text: 'Concluído: ' + concluirObs.trim() }, ...e.notas]
        : e.notas
    } : e));
    setSelected(s => s && s.id === id ? { ...s, status } : s);
    setConcluirObs('');
    toast.success(status === 'Concluído' ? 'Chamado concluído.' : 'Status atualizado.');
  };
  const addNota = () => {
    if (!selected || !nota.trim()) return;
    setEncaminhamentos(enc => enc.map(e => e.id === selected.id ? {
      ...e, notas: [{ date: new Date().toISOString(), author: 'Administrador', text: nota.trim() }, ...e.notas]
    } : e));
    setNota('');
    toast.success('Nota adicionada.');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[34px] tracking-tight" style={{ fontFamily: 'Fraunces, serif', fontWeight: 700 }}>Encaminhamentos</h2>
        <div className="text-[13.7px] text-[#576863]">Kanban de tratamento das ocorrências registradas pelos técnicos</div>
      </div>
      <div className="grid lg:grid-cols-[1.16fr_0.84fr] gap-6">
        <div className="grid md:grid-cols-3 gap-4">
          {cols.map(col => (
            <div key={col} className="rounded-[22px] bg-[#fffdf8] ring-1 ring-[#e2c6a6] p-4 min-h-[460px]">
              <div className="text-[12.8px] font-[740] text-[#3c4944] mb-3">{col} • {encaminhamentos.filter(e=>e.status===col).length}</div>
              <div className="space-y-3">
                {encaminhamentos.filter(e=>e.status===col).map(e => (
                  <button key={e.id} onClick={()=>setSelected(e)}
                    className={`w-full text-left rounded-[16px] bg-white ring-1 p-3.5 transition hover:ring-[#d6a87a] ${selected?.id===e.id ? 'ring-[#c94d21] shadow-[0_8px_22px_rgba(176,63,24,0.11)]' : 'ring-[#ead0b4]'}`}>
                    <div className="text-[13px] font-[720] text-[#2a3531] line-clamp-1">{e.schoolName}</div>
                    <div className="text-[12.2px] text-[#5f706a] line-clamp-1">{e.titulo}</div>
                    <div className="text-[11.4px] text-[#8e7a63] mt-1.5">{timeAgo(e.date)}</div>
                  </button>
                ))}
                {encaminhamentos.filter(e=>e.status===col).length===0 && (
                  <div className="text-[12.4px] text-[#9d8670]">Nenhum item nesta coluna.</div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-[24px] bg-white ring-1 ring-[#e2c6a6] p-6 shadow-[0_16px_38px_rgba(108,63,27,0.1)] h-fit sticky top-[92px]">
          {!selected ? (
            <div className="h-[320px] flex items-center justify-center text-[#9a8268] text-[14px]">Selecione um encaminhamento.</div>
          ) : (
            <div>
              <div className="text-[11.4px] tracking-wider text-[#ba4a22]" style={{ fontFamily: 'Fragment Mono, monospace' }}>ENCAMINHAMENTO {selected.id.toUpperCase()}</div>
              <div className="text-[23px] mt-1.5" style={{ fontFamily: 'Fraunces, serif', fontWeight: 700 }}>{selected.schoolName}</div>
              <div className="text-[13.7px] text-[#53645e] mb-2">{selected.titulo}</div>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {selected.categorias.map(c=> <span key={c} className="text-[11.2px] bg-[#f1e1cc] text-[#68482d] px-2 py-1 rounded-full">{c}</span>)}
              </div>
              <div className="flex flex-wrap gap-2 mb-5">
                {cols.map(s=>(
                  selected.status !== 'Concluído' && s === 'Concluído' ? (
                    <div key={s} className="w-full space-y-2">
                      <textarea value={concluirObs} onChange={e=>setConcluirObs(e.target.value)} rows={2}
                        placeholder="Observações de conclusão…"
                        className="w-full bg-[#f8f1e4] ring-1 ring-[#dfbd98] rounded-[11px] px-3 py-2 text-[13px] outline-none" />
                      <button onClick={()=>move(selected.id, s)}
                        className="w-full px-3.5 py-2 rounded-full bg-[#1a3531] text-[#f1dec2] text-[12.4px] font-[680] transition hover:bg-[#244a43]">
                        Concluir chamado
                      </button>
                    </div>
                  ) : (
                    <button key={s} onClick={()=>move(selected.id, s)}
                      className={`text-[12.4px] px-3.5 py-2 rounded-full ring-1 transition ${selected.status===s ? 'bg-[#1a3531] text-[#f1dec2] ring-[#1a3531]' : 'bg-[#fdf6ea] text-[#5a4531] ring-[#dec0a0] hover:bg-white'}`}>
                      {s}
                    </button>
                  )
                ))}
              </div>
              <div className="rounded-[16px] bg-[#fbf2e2] ring-1 ring-[#e7ccaa] p-4">
                <div className="text-[12.8px] font-[720] mb-2">Notas do encaminhamento</div>
                <div className="space-y-2.5 max-h-[190px] overflow-auto pr-1">
                  { (encaminhamentos.find(e=>e.id===selected.id)?.notas ?? selected.notas).map((n, i)=>(
                    <div key={i} className="text-[12.7px] text-[#485551]"><b>{n.author}</b> • {timeAgo(n.date)}<br/>{n.text}</div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <input value={nota} onChange={e=>setNota(e.target.value)} placeholder="Adicionar nota / comentário…"
                    className="flex-1 bg-white ring-1 ring-[#dfbd98] rounded-[11px] px-3 py-2 outline-none text-[13.2px]" />
                  <button onClick={addNota} className="px-3.5 py-2 rounded-[11px] bg-[#1b3b35] text-[#f2e0c4] text-[12.7px] font-[680]">Salvar</button>
                </div>
              </div>
              <div className="mt-4 text-[12.4px] text-[#5f7069]">
                Ronda vinculada: {selected.rondaId} • {new Date(selected.date).toLocaleString('pt-BR')}
                <br />
                {(() => {
                  const r = rondas.find(r=>r.id===selected.rondaId);
                  return r ? <>Técnico: {r.tecnicoName} • Prioridade: {r.prioridade}</> : null
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Relatórios ---------- */
function RelatoriosView({ store }: { store: ReturnType<typeof useLocalStore> }) {
  const [school, setSchool] = useState<string>('todas');
  const [categoria, setCategoria] = useState<string>('todas');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');

  const filtered = store.rondas.filter(r => {
    if (school !== 'todas' && r.schoolId !== school) return false;
    if (categoria !== 'todas' && !r.categories.includes(categoria as OccurrenceCategory)) return false;
    if (de && +new Date(r.date) < +new Date(de)) return false;
    if (ate && +new Date(r.date) > +new Date(ate + 'T23:59')) return false;
    return true;
  });

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFont('helvetica','bold'); doc.setFontSize(16);
    doc.text('NISE - Relatorio de Rondas', 14, 20);
    doc.setFontSize(10); doc.setFont('helvetica','normal');
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 28);
    doc.text(`Filtro: Escola = ${school === 'todas' ? 'Todas' : SCHOOLS.find(s=>s.id===school)?.name} | Categoria = ${categoria}`, 14, 34);

    autoTable(doc, {
      startY: 42,
      head: [['Data','Escola','Categorias','Tecnico','Prioridade','Status']],
      body: filtered.map(r => [
        new Date(r.date).toLocaleDateString('pt-BR'),
        SCHOOLS.find(s=>s.id===r.schoolId)?.name ?? r.schoolId,
        r.categories.join(', '),
        r.tecnicoName,
        r.prioridade,
        r.status
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [23, 51, 47] }
    });
    doc.save(`nise-relatorio-${Date.now()}.pdf`);
    toast.success('Relatório PDF exportado.');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[34px] tracking-tight" style={{ fontFamily: 'Fraunces, serif', fontWeight: 700 }}>Relatórios</h2>
        <div className="text-[13.7px] text-[#576863]">Gere PDFs oficiais para a coordenação e Secretária</div>
      </div>

      <div className="rounded-[24px] bg-white ring-1 ring-[#e2c6a6] p-5 md:p-6 shadow-sm">
        <div className="grid md:grid-cols-5 gap-3 items-end">
          <div>
            <div className="text-[11.4px] text-[#846b53]">Escola</div>
            <select value={school} onChange={e=>setSchool(e.target.value)} className="mt-1.5 w-full bg-[#f8f0e2] ring-1 ring-[#e0c5a4] rounded-[12px] px-3 py-2.5 text-[13.6px] outline-none">
              <option value="todas">Todas as escolas</option>
              {SCHOOLS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[11.4px] text-[#846b53]">Categoria</div>
            <select value={categoria} onChange={e=>setCategoria(e.target.value)} className="mt-1.5 w-full bg-[#f8f0e2] ring-1 ring-[#e0c5a4] rounded-[12px] px-3 py-2.5 text-[13.6px] outline-none">
              <option value="todas">Todas</option>
              {CATEGORIAS.map(c => <option key={c.key} value={c.key}>{c.key}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[11.4px] text-[#846b53]">De</div>
            <input type="date" value={de} onChange={e=>setDe(e.target.value)} className="mt-1.5 w-full bg-[#f8f0e2] ring-1 ring-[#e0c5a4] rounded-[12px] px-3 py-2.5 text-[13.6px] outline-none" />
          </div>
          <div>
            <div className="text-[11.4px] text-[#846b53]">Até</div>
            <input type="date" value={ate} onChange={e=>setAte(e.target.value)} className="mt-1.5 w-full bg-[#f8f0e2] ring-1 ring-[#e0c5a4] rounded-[12px] px-3 py-2.5 text-[13.6px] outline-none" />
          </div>
          <button onClick={exportPDF} className="rounded-[12px] bg-[#183631] hover:bg-[#1d413b] text-[#f2dec1] py-3 font-[740] text-[13.8px] shadow">Gerar PDF</button>
        </div>

        <div className="mt-4 text-[12.8px] text-[#7d6a55]">Resultados: <b>{filtered.length}</b> rondas</div>

        <div className="mt-3 overflow-auto rounded-[16px] ring-1 ring-[#edd1b3]">
          <table className="w-full text-[13.2px]">
            <thead className="bg-[#fbf2e2] text-[#826751]">
              <tr>
                <th className="py-2.5 px-3 text-left">Data</th>
                <th className="py-2.5 px-3 text-left">Escola</th>
                <th className="py-2.5 px-3 text-left">Ocorrências</th>
                <th className="py-2.5 px-3 text-left">Prioridade</th>
                <th className="py-2.5 px-3 text-left">Técnico</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const s = SCHOOLS.find(x=>x.id===r.schoolId);
                return (
                  <tr key={r.id} className="border-t border-[#f0d7b8]">
                    <td className="py-2.5 px-3">{new Date(r.date).toLocaleDateString('pt-BR')}</td>
                    <td className="py-2.5 px-3 font-[630]">{s?.name}</td>
                    <td className="py-2.5 px-3">{r.categories.join(', ')}</td>
                    <td className="py-2.5 px-3">{r.prioridade}</td>
                    <td className="py-2.5 px-3">{r.tecnicoName}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td className="px-3 py-7 text-[#9d8368]" colSpan={5}>Nenhum registro com os filtros atuais.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---------- Usuários ---------- */
function UsuariosView({ store }: { store: ReturnType<typeof useLocalStore> }) {
  const { users, setUsers } = store;
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<{ name: string; role: UserRole; password: string }>({ name: '', role: 'tecnico', password: '' });

  const genEmail = (name: string) => name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  const save = () => {
    if (!form.name || !form.password) { toast.error('Preencha nome e senha.'); return; }
    const userData = { name: form.name, email: genEmail(form.name), role: form.role, password: form.password, active: true };
    if (editing) { setUsers(us => us.map(u => u.id === editing.id ? { ...u, ...userData } : u)); toast.success('Usuário atualizado.'); }
    else { setUsers(us => [...us, { id: `u${Date.now()}`, ...userData }]); toast.success('Usuário cadastrado.'); }
    setEditing(null);
    setForm({ name: '', role: 'tecnico', password: '' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[34px] tracking-tight" style={{ fontFamily: 'Fraunces, serif', fontWeight: 700 }}>Gestão de usuários</h2>
        <div className="text-[13.7px] text-[#576863]">Técnicos de ronda e administradores • controle de acesso</div>
      </div>

      <div className="grid lg:grid-cols-[1.18fr_0.82fr] gap-6 items-start">
        <div className="rounded-[24px] bg-white ring-1 ring-[#e2c6a6] overflow-hidden shadow-sm">
          <table className="w-full text-[13.5px]">
            <thead className="bg-[#fbf2e2] text-[#826751]">
              <tr>
                <th className="text-left py-2.5 px-4">Nome</th>
                <th className="text-left py-2.5 px-4">Perfil</th>
                <th className="text-left py-2.5 px-4">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-t border-[#ecd2b4]">
                  <td className="py-3 px-4 font-[640]">{u.name}</td>
                  <td className="py-3 px-4">{u.role === 'admin' ? 'Administrador' : 'Técnico'}</td>
                  <td className="py-3 px-4">
                    <div className="flex gap-3">
                      <button onClick={()=>{ setEditing(u); setForm({ name: u.name, role: u.role, password: u.password }); }} className="text-[#c34b22] text-[12.7px] font-[600]">Editar</button>
                      <button onClick={()=>{ setUsers(us => us.filter(x => x.id !== u.id)); }} className="text-[#b34e22] text-[12.7px] font-[600]">Remover</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

          <div className="rounded-[24px] bg-[#fffdf8] ring-1 ring-[#e2c6a6] p-5 md:p-6 h-fit sticky top-[92px] shadow-[0_12px_30px_rgba(108,63,27,0.09)]">
            <div className="text-[18.5px] font-[740] mb-3" style={{ fontFamily: 'Fraunces, serif' }}>{editing ? 'Editar usuário' : 'Novo usuário'}</div>
            <div className="space-y-3">
              <Field label="Nome completo" value={form.name} onChange={v=>setForm(f=>({...f,name:v}))}/>
              <div>
                <div className="text-[11.4px] text-[#7a6551]">Perfil</div>
                <select value={form.role} onChange={e=>setForm(f=>({...f, role: e.target.value as UserRole}))}
                  className="w-full bg-[#f8f0e2] ring-1 ring-[#dfc5a3] rounded-[12px] px-3 py-2.5 text-[13.6px] outline-none mt-1.5">
                  <option value="tecnico">Técnico</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <Field label="Senha" value={form.password} onChange={v=>setForm(f=>({...f,password:v}))} type="password"/>
              <div className="flex gap-2 pt-1">
                <button onClick={save} className="flex-1 rounded-[12px] bg-[#1b3a35] text-[#f0e1c7] py-2.5 font-[720] text-[13.6px]">Salvar</button>
                {editing && <button onClick={()=>{ setEditing(null); setForm({ name:'', role:'tecnico', password:'' }); }} className="px-4 rounded-[12px] ring-1 ring-[#dfbd97] text-[#5a4633] text-[13px]">Cancelar</button>}
              </div>
            </div>
          </div>
      </div>
    </div>
  );
}
function Field({ label, value, onChange, type }: { label: string; value: string; onChange: (v:string)=>void; type?: string }) {
  return (
    <div>
      <div className="text-[11.4px] text-[#7a6551]">{label}</div>
      <input type={type ?? 'text'} value={value} onChange={e=>onChange(e.target.value)} className="mt-1.5 w-full bg-[#f8f0e2] ring-1 ring-[#dfc5a3] rounded-[12px] px-3 py-2.5 text-[13.6px] outline-none"/>
    </div>
  );
}

/* ---------- Monitoramento (Técnico) ---------- */
function MonitoramentoBoard({ store }: { store: ReturnType<typeof useLocalStore> }) {
  const { encaminhamentos, setEncaminhamentos, rondas } = store;
  const [selected, setSelected] = useState<Encaminhamento | null>(null);
  const [nota, setNota] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [newSchool, setNewSchool] = useState(SCHOOLS[0].id);
  const [newTitulo, setNewTitulo] = useState('');
  const [newCats, setNewCats] = useState<OccurrenceCategory[]>([]);

  const cols: Encaminhamento['status'][] = ['Pendente', 'Em Andamento', 'Concluído'];

  const move = (id: string, status: Encaminhamento['status']) => {
    setEncaminhamentos(enc => enc.map(e => e.id === id ? { ...e, status } : e));
    setSelected(s => s && s.id === id ? { ...s, status } : s);
    toast.success('Status atualizado.');
  };
  const addNota = () => {
    if (!selected || !nota.trim()) return;
    setEncaminhamentos(enc => enc.map(e => e.id === selected.id ? {
      ...e, notas: [{ date: new Date().toISOString(), author: 'Monitoramento', text: nota.trim() }, ...e.notas]
    } : e));
    setNota('');
    toast.success('Nota adicionada.');
  };
  const criarChamado = () => {
    if (!newTitulo.trim()) { toast.error('Digite um título para o chamado.'); return; }
    const escola = SCHOOLS.find(s => s.id === newSchool);
    const enc: Encaminhamento = {
      id: `enc-${Date.now()}`,
      rondaId: '',
      schoolName: escola?.name ?? '',
      titulo: newTitulo.trim(),
      categorias: newCats,
      date: new Date().toISOString(),
      status: 'Pendente',
      notas: [{ date: new Date().toISOString(), author: 'Sistema', text: `Chamado aberto para ${escola?.name}` }]
    };
    setEncaminhamentos(es => [enc, ...es]);
    setNewTitulo('');
    setNewCats([]);
    setShowForm(false);
    toast.success('Chamado aberto com sucesso.');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[28px] tracking-tight" style={{ fontFamily: 'Fraunces, serif', fontWeight: 700 }}>Monitoramento</h2>
          <div className="text-[13.2px] text-[#576863]">Chamados abertos • acompanhe e atenda as ocorrências</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[11.8px] text-[#8a735f]" style={{ fontFamily: 'Fragment Mono, monospace' }}>{encaminhamentos.filter(e=>e.status!=='Concluído').length} ATIVOS</div>
          <button onClick={()=>setShowForm(!showForm)}
            className="text-[12.8px] px-4 py-2 rounded-full bg-[#1a3531] text-[#f1dec2] font-[680] hover:bg-[#244a43] transition">
            {showForm ? 'Cancelar' : '+ Novo chamado'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="rounded-[22px] bg-[#fffdf8] ring-1 ring-[#e2c6a6] p-5 md:p-6">
          <div className="text-[15.8px] font-[740] mb-4" style={{ fontFamily: 'Fraunces, serif' }}>Abrir chamado</div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="text-[11.4px] text-[#7a6551] mb-1.5">Escola</div>
              <select value={newSchool} onChange={e=>setNewSchool(e.target.value)}
                className="w-full bg-[#f8f0e2] ring-1 ring-[#dfc5a3] rounded-[12px] px-3 py-2.5 text-[13.6px] outline-none">
                {SCHOOLS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <div className="text-[11.4px] text-[#7a6551] mb-1.5">Título do chamado</div>
              <input value={newTitulo} onChange={e=>setNewTitulo(e.target.value)}
                className="w-full bg-[#f8f0e2] ring-1 ring-[#dfc5a3] rounded-[12px] px-3 py-2.5 text-[13.6px] outline-none"
                placeholder="Ex: Problema no portão" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-[11.4px] text-[#7a6551] mb-1.5">Categorias</div>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIAS.map(c => (
                <button key={c.key} type="button" onClick={()=>setNewCats(cs => cs.includes(c.key) ? cs.filter(x=>x!==c.key) : [...cs, c.key])}
                  className={`text-[11.8px] px-3 py-1.5 rounded-full transition ${newCats.includes(c.key) ? 'bg-[#1a3531] text-[#f1dec2]' : 'bg-[#f1e2cf] text-[#694a2f]'}`}>
                  {c.key}
                </button>
              ))}
            </div>
          </div>
          <button onClick={criarChamado}
            className="mt-4 px-6 py-2.5 rounded-[12px] bg-[#1b3b35] text-[#f0e1c7] font-[700] text-[13.6px] hover:bg-[#244a43] transition">
            Abrir chamado
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-[1.16fr_0.84fr] gap-6">
        <div className="grid md:grid-cols-3 gap-4">
          {cols.map(col => (
            <div key={col} className="rounded-[22px] bg-[#fffdf8] ring-1 ring-[#e2c6a6] p-4 min-h-[400px]">
              <div className="text-[12.8px] font-[740] text-[#3c4944] mb-3">{col} • {encaminhamentos.filter(e=>e.status===col).length}</div>
              <div className="space-y-3">
                {encaminhamentos.filter(e=>e.status===col).map(e => (
                  <button key={e.id} onClick={()=>setSelected(e)}
                    className={`w-full text-left rounded-[16px] bg-white ring-1 p-3.5 transition hover:ring-[#d6a87a] ${selected?.id===e.id ? 'ring-[#c94d21] shadow-[0_8px_22px_rgba(176,63,24,0.11)]' : 'ring-[#ead0b4]'}`}>
                    <div className="text-[13px] font-[720] text-[#2a3531] line-clamp-1">{e.schoolName}</div>
                    <div className="text-[12.2px] text-[#5f706a] line-clamp-1">{e.titulo}</div>
                    <div className="text-[11.4px] text-[#8e7a63] mt-1.5">{timeAgo(e.date)}</div>
                  </button>
                ))}
                {encaminhamentos.filter(e=>e.status===col).length===0 && (
                  <div className="text-[12.4px] text-[#9d8670]">Nenhum item.</div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-[24px] bg-white ring-1 ring-[#e2c6a6] p-6 shadow-[0_16px_38px_rgba(108,63,27,0.1)] h-fit sticky top-[92px]">
          {!selected ? (
            <div className="h-[320px] flex items-center justify-center text-[#9a8268] text-[14px]">Selecione um chamado.</div>
          ) : (
            <div>
              <div className="text-[11.4px] tracking-wider text-[#ba4a22]" style={{ fontFamily: 'Fragment Mono, monospace' }}>CHAMADO {selected.id.toUpperCase()}</div>
              <div className="text-[23px] mt-1.5" style={{ fontFamily: 'Fraunces, serif', fontWeight: 700 }}>{selected.schoolName}</div>
              <div className="text-[13.7px] text-[#53645e] mb-2">{selected.titulo}</div>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {selected.categorias.map(c=> <span key={c} className="text-[11.2px] bg-[#f1e1cc] text-[#68482d] px-2 py-1 rounded-full">{c}</span>)}
              </div>
              <div className="flex flex-wrap gap-2 mb-5">
                {cols.map(s=>(
                  <button key={s} onClick={()=>move(selected.id, s)}
                    className={`text-[12.4px] px-3.5 py-2 rounded-full ring-1 transition ${selected.status===s ? 'bg-[#1a3531] text-[#f1dec2] ring-[#1a3531]' : 'bg-[#fdf6ea] text-[#5a4531] ring-[#dec0a0] hover:bg-white'}`}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="rounded-[16px] bg-[#fbf2e2] ring-1 ring-[#e7ccaa] p-4">
                <div className="text-[12.8px] font-[720] mb-2">Notas</div>
                <div className="space-y-2.5 max-h-[190px] overflow-auto pr-1">
                  { (encaminhamentos.find(e=>e.id===selected.id)?.notas ?? selected.notas).map((n, i)=>(
                    <div key={i} className="text-[12.7px] text-[#485551]"><b>{n.author}</b> • {timeAgo(n.date)}<br/>{n.text}</div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <input value={nota} onChange={e=>setNota(e.target.value)} placeholder="Adicionar nota…"
                    className="flex-1 bg-white ring-1 ring-[#dfbd98] rounded-[11px] px-3 py-2 outline-none text-[13.2px]" />
                  <button onClick={addNota} className="px-3.5 py-2 rounded-[11px] bg-[#1b3b35] text-[#f2e0c4] text-[12.7px] font-[680]">Salvar</button>
                </div>
              </div>
              <div className="mt-4 text-[12.4px] text-[#5f7069]">
                {selected.rondaId ? <>Ronda: {selected.rondaId} • {new Date(selected.date).toLocaleString('pt-BR')}</> : <>Aberto em {new Date(selected.date).toLocaleString('pt-BR')}</>}
                <br />
                {(() => {
                  if (!selected.rondaId) return null;
                  const r = rondas.find(r=>r.id===selected.rondaId);
                  return r ? <>Técnico: {r.tecnicoName} • Prioridade: <PriorityPill p={r.prioridade} /></> : null
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- TECNICO APP ---------- */
function TecnicoApp({ currentUser, onLogout, store }: { currentUser: User; onLogout: () => void; store: ReturnType<typeof useLocalStore> }) {
  const [tab, setTab] = useState<'nova' | 'historico' | 'monitoramento'>('nova');

  return (
    <div className="min-h-screen bg-[#f7f0e5] text-[#20312d]" style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>
      <Toaster richColors position="top-center" />
      <header className="border-b border-[#e4cfb8] bg-[#faf4ea]/92 backdrop-blur sticky top-0 z-30">
        <div className="max-w-[1000px] mx-auto px-5 md:px-8 h-[66px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-[#17332f] text-[#f0ddc1] flex items-center justify-center"><I.shield className="w-[18px] h-[18px]" /></div>
            <div>
              <div className="text-[13.8px] font-[720] tracking-tight">NISE • Ronda Técnica</div>
              <div className="text-[11.2px] text-[#7d6854]" style={{ fontFamily: 'Fragment Mono, monospace' }}>Técnico em campo</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right leading-tight">
              <div className="text-[12.8px] font-[640]">{currentUser.name}</div>
              <div className="text-[11.4px] text-[#7c6f61]">{currentUser.role === 'admin' ? 'Administrador' : 'Técnico de Ronda'}</div>
            </div>
            <button onClick={onLogout} className="text-[12.2px] px-3 py-1.5 rounded-full bg-white ring-1 ring-[#e4cfb7]">Sair</button>
          </div>
        </div>
        <div className="max-w-[1000px] mx-auto px-5 md:px-8 pb-3 flex gap-7 text-[13.7px]">
          <button onClick={()=>setTab('nova')} className={tab==='nova' ? 'font-[740] text-[#17322c]' : 'text-[#6b5b49]'}>Nova ronda</button>
          <button onClick={()=>setTab('historico')} className={tab==='historico' ? 'font-[740] text-[#17322c]' : 'text-[#6b5b49]'}>Histórico</button>
          <button onClick={()=>setTab('monitoramento')} className={tab==='monitoramento' ? 'font-[740] text-[#17322c]' : 'text-[#6b5b49]'}>Monitoramento</button>
        </div>
      </header>

      <main className="max-w-[1000px] mx-auto px-5 md:px-8 py-8 md:py-11">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            {tab === 'nova' ? <NovaRonda store={store} currentUser={currentUser} onSaved={()=>setTab('historico')} /> :
             tab === 'historico' ? <RondasList store={{ ...store, rondas: store.rondas.filter(r => r.tecnicoId === currentUser.id) }} /> :
             <MonitoramentoBoard store={store} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="border-t border-[#ead2b7] py-6 text-center text-[12px] text-[#a78968] bg-[#fcf8ef]">Desenvolvido pelo Departamento de Tecnologia da SME</footer>
    </div>
  );
}

function NovaRonda({ store, currentUser, onSaved }: { store: ReturnType<typeof useLocalStore>; currentUser: User; onSaved: ()=>void }) {
  const [schoolId, setSchoolId] = useState(SCHOOLS[0].id);
  const [selectedCats, setSelectedCats] = useState<OccurrenceCategory[]>([]);
  const [observacoes, setObservacoes] = useState('');
  const [audioDescription, setAudioDescription] = useState('');
  const [prioridade, setPrioridade] = useState<Ronda['prioridade']>('Baixa');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<number | null>(null);
  const speechRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef<string>('');
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);

  const speechSupported = !!window.SpeechRecognition || !!window.webkitSpeechRecognition;

  const toggleCat = (c: OccurrenceCategory) =>
    setSelectedCats(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  const startRec = async () => {
    try {
      setTranscribing(false);
      setTranscribeError(null);
      setAudioDescription('');
      if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null); }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 48000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';
      const rec = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 128000 });
      recRef.current = rec; chunksRef.current = [];
      rec.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        audioBlobRef.current = blob;
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t=>t.stop());
      };
      rec.start(); setRecording(true); setSeconds(0);
      transcriptRef.current = '';
      timerRef.current = window.setInterval(()=> setSeconds(s=>s+1), 1000);

      if (speechSupported) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition!;
        const sr: any = new SpeechRecognition();
        sr.lang = 'pt-BR';
        sr.continuous = true;
        sr.interimResults = true;
        sr.onresult = (e: any) => {
          let final = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const t = e.results[i][0].transcript;
            if (e.results[i].isFinal) final += (final ? ' ' : '') + t;
          }
          if (final) {
            transcriptRef.current += (transcriptRef.current ? ' ' : '') + final;
            setAudioDescription(transcriptRef.current);
          }
        };
        sr.onend = () => {
          if (transcriptRef.current) {
            transcriptRef.current = '';
            setTranscribing(false);
          } else {
            setTranscribeError('Nenhum áudio válido foi detectado.');
            setTranscribing(false);
          }
        };
        sr.onerror = (e: any) => {
          setTranscribeError(
            e.error === 'no-speech'
              ? 'Nenhum áudio válido foi detectado.'
              : 'Não foi possível transcrever o áudio. Tente novamente.'
          );
          setTranscribing(false);
        };
        sr.start();
        speechRef.current = sr;
      }
    } catch {
      toast.error('Não foi possível acessar o microfone. Verifique as permissões do navegador.');
    }
  };
  const stopRec = () => {
    recRef.current?.stop();
    setRecording(false);
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (speechSupported) {
      setTranscribing(true);
      setTranscribeError(null);
    }
    if (speechRef.current) {
      speechRef.current.stop();
      speechRef.current = null;
    }
  };

  const blobToDataURL = (blob: Blob): Promise<string> =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });

  const submit = async () => {
    if (!selectedCats.length) { toast.error('Selecione ao menos uma categoria de ocorrência.'); return; }
    if (transcribing) { toast.error('Aguardando transcrição do áudio...'); return; }
    const id = `r${Date.now()}`;
    let audioUrlFinal: string | null = audioUrl;
    const blob = audioBlobRef.current;
    if (blob) {
      audioUrlFinal = await uploadAudio(blob, id) ?? await blobToDataURL(blob);
    }
    const ronda: Ronda = {
      id, schoolId, tecnicoId: currentUser.id, tecnicoName: currentUser.name,
      date: new Date().toISOString(), categories: selectedCats, audioBlobUrl: audioUrlFinal,
      audioDescription, observacoes, prioridade, status: 'registrada'
    };
    store.setRondas(rs => [ronda, ...rs]);
    // Auto-criar chamado no monitoramento
    const escola = SCHOOLS.find(s => s.id === schoolId);
    const enc: Encaminhamento = {
      id: `enc-${Date.now()}`,
      rondaId: id,
      schoolName: escola?.name ?? '',
      titulo: selectedCats.join(' · '),
      categorias: selectedCats,
      date: new Date().toISOString(),
      status: 'Pendente',
      notas: [{ date: new Date().toISOString(), author: currentUser.name, text: `Ronda registrada: ${observacoes || audioDescription || 'Sem descrição'}` }]
    };
    store.setEncaminhamentos(es => [enc, ...es]);
    await upsertUsers(store.users);
    await insertRonda(ronda);
    toast.success('Ronda enviada — chamado aberto na coordenação.');
    setSelectedCats([]); setObservacoes(''); setAudioDescription(''); setAudioUrl(null); setPrioridade('Baixa');
    onSaved();
  };

  const school = SCHOOLS.find(s=>s.id===schoolId)!;

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <div className="rounded-[22px] bg-[#fffdf7] ring-1 ring-[#e2c6a6] px-5 md:px-6 py-4 flex flex-wrap items-center gap-4 text-[12.8px] text-[#5e6a65]">
        <span className="font-[720] text-[#24413a]">Fluxo de ronda</span>
        <span>1. Escola</span><span className="opacity-50">→</span>
        <span>2. Ocorrências</span><span className="opacity-50">→</span>
        <span>3. Áudio</span><span className="opacity-50">→</span>
        <span className="text-[#b64a20] font-[680]">4. Enviar</span>
      </div>

      <div className="grid lg:grid-cols-[1.03fr_0.97fr] gap-6 items-start">
        {/* Left form */}
        <div className="rounded-[28px] bg-white ring-1 ring-[#e2c6a6] p-6 md:p-8 shadow-[0_22px_56px_rgba(94,60,25,0.11)]">
          <div className="text-[11.5px] tracking-widest text-[#c44a1c]" style={{ fontFamily: 'Fragment Mono, monospace' }}>LANÇAMENTO DE RONDA</div>
          <h1 className="text-[34px] mt-1 tracking-tight" style={{ fontFamily: 'Fraunces, serif', fontWeight: 700 }}>Registrar ocorrência</h1>

          <div className="mt-7 space-y-7">
            <div>
              <div className="text-[12px] text-[#7a6552] font-[600]">1. Unidade escolar</div>
              <select value={schoolId} onChange={e => setSchoolId(e.target.value)} className="mt-2 w-full bg-[#f7f0e3] ring-1 ring-[#dfc4a2] rounded-[14px] px-4 py-3.5 text-[15px] outline-none">
                {SCHOOLS.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
              </select>
              <div className="text-[12.5px] text-[#667872] mt-1.5">Bairro: {school.bairro}</div>
            </div>

            <div>
              <div className="text-[12px] text-[#7a6552] font-[600]">2. Categorias de ocorrência</div>
              <div className="grid sm:grid-cols-2 gap-2.5 mt-2.5">
                {CATEGORIAS.map(c => (
                  <button type="button" key={c.key} onClick={()=>toggleCat(c.key)}
                    className={`text-left rounded-[14px] px-4 py-3 ring-1 transition ${selectedCats.includes(c.key) ? 'bg-[#193835] text-[#f4e4c9] ring-[#193835] shadow-[0_8px_20px_rgba(22,52,46,0.18)]' : 'bg-[#f8f1e4] text-[#3d3228] ring-[#e3c8a7] hover:bg-[#f3e5ce]'}`}>
                    <div className="font-[720] text-[13.9px] flex items-center gap-2">
                      {selectedCats.includes(c.key) && <I.check className="w-4 h-4" />} {c.key}
                    </div>
                    <div className="text-[12.2px] opacity-80">{c.hint}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <div className="text-[12px] text-[#7a6552] font-[600]">Prioridade técnica</div>
                <select value={prioridade} onChange={e=>setPrioridade(e.target.value as any)} className="mt-2 w-full bg-[#f7f0e3] ring-1 ring-[#dfc4a2] rounded-[14px] px-4 py-3 text-[14.3px] outline-none">
                  <option>Baixa</option><option>Média</option><option>Alta</option><option>Crítica</option>
                </select>
              </div>
              <div>
                <div className="text-[12px] text-[#7a6552] font-[600]">Técnico responsável</div>
                <input value={currentUser.name} readOnly className="mt-2 w-full bg-[#f7f0e3] ring-1 ring-[#dfc4a2] rounded-[14px] px-4 py-3 text-[14.3px] outline-none text-[#5b6d67]" />
              </div>
            </div>

            <div>
              <div className="text-[12px] text-[#7a6552] font-[600]">3. Observações gerais</div>
              <textarea value={observacoes} onChange={e=>setObservacoes(e.target.value)} rows={3}
                placeholder="Descreva o contexto da ronda, medidas tomadas em campo…"
                className="mt-2 w-full bg-[#f7f0e3] ring-1 ring-[#dfc4a2] rounded-[14px] px-4 py-3 text-[14px] outline-none" />
            </div>
          </div>
        </div>

        {/* Right: Audio */}
        <div className="space-y-5">
          <div className="rounded-[26px] bg-[#fdf9f0] ring-1 ring-[#e2c6a6] px-6 py-6 shadow-sm">
            <div className="flex items-center gap-2 text-[12px] text-[#7a6552] font-[600]">
              <I.mic className="w-[17px] h-[17px]" /> 4. Gravação de áudio
            </div>

            <div className="mt-3 rounded-[20px] bg-[#f4e5cf] ring-1 ring-[#e0bf97] px-5 py-5">
              <div className="flex items-center justify-between">
                <div className="text-[15.2px] font-[730] text-[#253630]">
                  {recording ? 'Gravando…' : transcribing ? 'Transcrevendo áudio…' : audioUrl ? 'Áudio salvo' : 'Pronto para gravar'}
                </div>
                <div className="text-[12.8px] text-[#6a595f]" style={{ fontFamily: 'Fragment Mono, monospace' }}>{formatSec(seconds)}</div>
              </div>

              <div className="mt-3 h-[54px] rounded-[13px] bg-[#eeddbe] ring-1 ring-[#ddb98c] flex items-center px-3 overflow-hidden relative">
                {transcribing ? (
                  <div className="flex items-center gap-3 text-[13px] text-[#8d725a]">
                    <svg className="animate-spin h-5 w-5 text-[#c7481f]" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Transcrevendo...
                  </div>
                ) : (
                  <div className="w-full flex gap-[5px] items-center">
                    {Array.from({ length: 34 }).map((_,i)=>(
                      <div key={i} className="w-[4.4px] rounded-full bg-[#ce6c33]"
                        style={{ height: 8 + Math.abs(Math.sin((seconds*4+i)/1.55)) * ((recording||audioUrl)?24:7) }} />
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center gap-3">
                {!recording && !audioUrl && !transcribing && (
                  <button onClick={startRec} className="px-4 py-2.5 rounded-[12px] bg-[#1a3430] text-[#f2e0c5] text-[13.6px] font-[720] shadow">● Gravar áudio</button>
                )}
                {recording && (
                  <button onClick={stopRec} className="px-4 py-2.5 rounded-[12px] bg-[#c7481f] text-white text-[13.6px] font-[720]">■ Parar</button>
                )}
                {audioUrl && (
                  <div className="flex items-center gap-2 flex-1">
                    <audio controls src={audioUrl} className="h-9 flex-1" />
                    <button onClick={() => { URL.revokeObjectURL(audioUrl!); setAudioUrl(null); audioBlobRef.current = null; setSeconds(0); setAudioDescription(''); setTranscribeError(null); }}
                      className="px-3 py-2 rounded-[10px] ring-1 ring-[#dbb58a] text-[#a64b26] text-[12.5px] font-[650] hover:bg-[#fde8e0] transition">Remover</button>
                  </div>
                )}
              </div>
              <div className="text-[11.8px] text-[#8d725a] mt-2">
                {recording && 'Gravando… Fale claramente. A transcrição aparecerá automaticamente ao parar.'}
                {transcribing && 'Processando o áudio e gerando transcrição...'}
                {!recording && !transcribing && audioUrl && 'Áudio salvo. Edite a transcrição se necessário.'}
                {!recording && !transcribing && !audioUrl && 'Clique em "Gravar áudio" para começar.'}
              </div>
              {transcribeError && (
                <div className="mt-2 text-[12.5px] text-[#b34e22] bg-[#fde8e0] rounded-[10px] px-3 py-2">
                  {transcribeError}
                </div>
              )}
            </div>

            <div className="mt-4">
              <div className="text-[12px] text-[#7a6552] font-[600]">Descrição do áudio</div>
              <textarea value={audioDescription} readOnly rows={3}
                placeholder="A transcrição será inserida automaticamente."
                className="mt-2 w-full bg-[#f4ece0] ring-1 ring-[#dfc4a2] rounded-[14px] px-4 py-3 text-[14px] outline-none cursor-default" />
            </div>
          </div>

          <div className="rounded-[26px] bg-white ring-1 ring-[#e2c6a6] px-6 py-6">
            <div className="text-[12.5px] text-[#756456]" style={{ fontFamily: 'Fragment Mono, monospace' }}>RESUMO DA RONDA</div>
            <div className="mt-2 text-[18px] font-[750] text-[#253630]">{school.name}</div>
            <div className="mt-2 text-[13.6px] text-[#52635d] leading-relaxed">
              Categorias: {selectedCats.length ? selectedCats.join(', ') : '—'}<br/>
              Prioridade: {prioridade}<br/>
              Áudio: {audioUrl ? 'Salvo' : transcribing ? 'Transcrevendo' : recording ? 'Gravando' : 'Sem áudio'}<br/>
              Transcrição: {transcribing ? <span className="text-[#c7481f]">Em andamento...</span> : audioDescription.trim() ? 'OK' : '—'}
            </div>
            <button onClick={submit}
              disabled={transcribing}
              className="mt-4 w-full rounded-[14px] bg-[#d45524] hover:bg-[#bd471c] transition text-white py-3.5 font-[800] text-[15.5px] shadow-[0_12px_30px_rgba(199,71,28,0.30)] disabled:opacity-50 disabled:cursor-not-allowed">
              Finalizar ronda e enviar
            </button>
            <div className="text-[11.7px] text-[#917762] text-center mt-2">A ronda será encaminhada automaticamente para a coordenação NISE.</div>
          </div>

          <div className="text-[12.2px] text-[#967f66] text-center">Modo técnico • GPS ativo • Carimbo de tempo automático</div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Utils ---------- */
function timeAgo(iso: string) {
  const diff = Date.now() - +new Date(iso);
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 24) return `${hrs}h atrás`;
  const days = Math.floor(hrs/24);
  return `${days}d atrás`;
}
function formatSec(s: number) {
  const m = Math.floor(s/60).toString().padStart(2,'0');
  const ss = (s%60).toString().padStart(2,'0');
  return `${m}:${ss}`;
}

export default function App() {
  return (
    <>
      <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700;9..144,800&family=Fragment+Mono:ital@0;1&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap');
      html, body { background:#f7f0e5; }
      `}</style>
      <AppShell />
    </>
  );
}