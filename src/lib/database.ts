import { supabase } from './supabase'
import type { User, Ronda, Encaminhamento } from '../App'

function mapUser(raw: any): User {
  return { id: raw.id, name: raw.name, email: raw.email, role: raw.role, password: raw.password ?? '123', active: raw.active ?? true }
}
function mapRonda(raw: any): Ronda {
  return { id: raw.id, schoolId: raw.school_id, tecnicoId: raw.tecnico_id, tecnicoName: raw.tecnico_name, date: raw.date, categories: raw.categories ?? [], audioBlobUrl: raw.audio_blob_url ?? null, audioDescription: raw.audio_description ?? '', observacoes: raw.observacoes ?? '', status: raw.status, prioridade: raw.prioridade }
}
function mapEncaminhamento(raw: any): Encaminhamento {
  return { id: raw.id, rondaId: raw.ronda_id, schoolName: raw.school_name, titulo: raw.titulo, categorias: raw.categorias ?? [], date: raw.date, status: raw.status, notas: raw.notas ?? [] }
}

function toRondaDB(r: Ronda) {
  return { id: r.id, school_id: r.schoolId, tecnico_id: r.tecnicoId, tecnico_name: r.tecnicoName, date: r.date, categories: r.categories, audio_blob_url: r.audioBlobUrl, audio_description: r.audioDescription, observacoes: r.observacoes, status: r.status, prioridade: r.prioridade }
}
function toEncDB(e: Encaminhamento) {
  return { id: e.id, ronda_id: e.rondaId, school_name: e.schoolName, titulo: e.titulo, categorias: e.categorias, date: e.date, status: e.status, notas: e.notas }
}

function noop() { return { data: null, error: null } as any }
const db = supabase ?? { from: () => ({ select: noop, upsert: noop, insert: noop, order: noop, maybeSingle: noop, eq: () => ({ maybeSingle: noop }) }), storage: { from: () => ({ upload: async () => ({ data: null, error: new Error('Supabase não disponível') }), getPublicUrl: () => ({ data: { publicUrl: null } }) }) } }

/* ------ Users ------ */
export async function fetchUsers(): Promise<User[]> {
  const { data } = await db.from('nise_users').select('*').order('name')
  return (data ?? []).map(mapUser)
}

export async function upsertUsers(users: User[]): Promise<void> {
  const { error } = await db.from('nise_users').upsert(users.map(u => ({
    id: u.id, name: u.name, email: u.email, role: u.role, password: u.password, active: u.active
  })), { onConflict: 'id' })
  if (error) console.error('upsertUsers error:', error)
}

/* ------ Rondas ------ */
export async function fetchRondas(): Promise<Ronda[]> {
  const { data } = await db.from('rondas').select('*').order('date', { ascending: false })
  return (data ?? []).map(mapRonda)
}

export async function upsertRondas(rondas: Ronda[]): Promise<void> {
  if (rondas.length === 0) return
  const { error } = await db.from('rondas').upsert(rondas.map(toRondaDB), { onConflict: 'id' })
  if (error) console.error('upsertRondas error:', error)
}

export async function insertRonda(ronda: Ronda): Promise<void> {
  const { error } = await db.from('rondas').insert(toRondaDB(ronda))
  if (error) console.error('insertRonda error:', error)
}

/* ------ Encaminhamentos ------ */
export async function fetchEncaminhamentos(): Promise<Encaminhamento[]> {
  const { data } = await db.from('encaminhamentos').select('*').order('date', { ascending: false })
  return (data ?? []).map(mapEncaminhamento)
}

export async function upsertEncaminhamentos(enc: Encaminhamento[]): Promise<void> {
  if (enc.length === 0) return
  const { error } = await db.from('encaminhamentos').upsert(enc.map(toEncDB), { onConflict: 'id' })
  if (error) console.error('upsertEncaminhamentos error:', error)
}

export async function insertEncaminhamento(enc: Encaminhamento): Promise<void> {
  const { error } = await db.from('encaminhamentos').insert(toEncDB(enc))
  if (error) console.error('insertEncaminhamento error:', error)
}

/* ------ Audio storage ------ */
export async function uploadAudio(blob: Blob, rondaId: string): Promise<string | null> {
  const fileName = `audio-${rondaId}-${Date.now()}.webm`
  const { data, error } = await db.storage.from('nise-audio').upload(fileName, blob, {
    contentType: 'audio/webm',
    cacheControl: '3600',
  })
  if (error) { console.error('uploadAudio error:', error); return null }
  const { data: urlData } = db.storage.from('nise-audio').getPublicUrl(data.path)
  return urlData.publicUrl
}

/* ------ Auth ------ */
function matchUser(users: User[], login: string, password: string): User | undefined {
  const lower = login.toLowerCase().trim();
  return users.find(u =>
    u.active &&
    u.password === password &&
    (u.email.toLowerCase() === lower || u.name.toLowerCase() === lower)
  );
}

const DEFAULT_USERS: User[] = [
  { id: 'u1', name: 'Pedro', email: 'admin', role: 'admin', password: 'Admin123', active: true },
  { id: 'u2', name: 'Ana Técnica', email: 'tecnico', role: 'tecnico', password: 'Tec123', active: true },
];

export async function authenticateUser(login: string, password: string): Promise<{ user: User | null; error: string | null }> {
  // Seed localStorage with default users (keeps extra users from admin panel)
  try {
    const raw = localStorage.getItem('nise_users_v5');
    const existing: User[] = raw ? JSON.parse(raw) : [];
    const extra = existing.filter(u => !DEFAULT_USERS.some(d => d.id === u.id));
    localStorage.setItem('nise_users_v5', JSON.stringify([...DEFAULT_USERS, ...extra]));
  } catch {
    localStorage.setItem('nise_users_v5', JSON.stringify(DEFAULT_USERS));
  }

  // Find user in localStorage
  const localUsers: User[] = JSON.parse(localStorage.getItem('nise_users_v5')!);
  const found = matchUser(localUsers, login, password);
  if (found) return { user: found, error: null };

  // Try Supabase if available
  if (supabase) {
    const { data, error } = await db
      .from('nise_users')
      .select('*')
      .eq('email', login)
      .maybeSingle()
    if (!error && data && data.password === password && data.active) {
      return { user: mapUser(data), error: null }
    }
  }
  return { user: null, error: 'Usuário ou senha inválidos.' }
}

/* ------ Sync helpers ------ */
export async function loadAllData(): Promise<{ users: User[]; rondas: Ronda[]; encaminhamentos: Encaminhamento[] }> {
  const [users, rondas, encaminhamentos] = await Promise.all([
    fetchUsers(),
    fetchRondas(),
    fetchEncaminhamentos(),
  ])
  return { users, rondas, encaminhamentos }
}

export async function syncAllData(users: User[], rondas: Ronda[], encaminhamentos: Encaminhamento[]): Promise<void> {
  await Promise.all([
    upsertUsers(users),
    upsertRondas(rondas),
    upsertEncaminhamentos(encaminhamentos),
  ])
}
