import { watch } from 'chokidar'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import {
  ensureDir,
  readJson,
  writeJsonAtomic,
  writeTextAtomic,
  tsCompact,
  tsMinute,
  randomId,
  truncate,
  semverLt,
  sh,
} from './shared.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ENGINE_DIR = path.resolve(__dirname, '..')
const TEMPLATES_DIR = path.join(ENGINE_DIR, 'templates')

const DEFAULT_CURSOR_BIN = 'cursor' + '-agent'
const DEFAULT_OPENCODE_BIN = 'open' + 'code'

const CURSOR_BIN = (process.env.PILOT_CURSOR_BIN || '').trim() || DEFAULT_CURSOR_BIN
const OPENCODE_BIN = (process.env.PILOT_OPENCODE_BIN || '').trim() || DEFAULT_OPENCODE_BIN

const ORCH_INLINE_MESSAGE = 'Read the attached file and output JSON only.'
const LOG_ROTATE_BYTES = 2 * 1024 * 1024

const BASELINE_FORBIDDEN = [
  '.env*',
  '**/*.pem',
  '**/*id_rsa*',
  '**/*secret*',
  '**/*token*',
  '.git/**',
  'node_modules/**',
  'dist/**',
  'build/**',
]

const ORCHESTRATOR_ALLOWED_WRITES = ['pilot/STATE.json', 'pilot/TASK.json', 'pilot/BLOCKED.json']

/** Canonicalize orchestrator write key to allowed path or return null if invalid/forbidden. */
function canonicalizeWriteKey(k: string): string | null {
  // Normalize slashes and trim
  let p = (k || '').replace(/\\/g, '/').trim()
  // Security: reject path traversal, absolute, home, or null bytes
  if (p.includes('\0')) return null
  if (p.startsWith('/') || p.startsWith('~')) return null
  if (p.split('/').includes('..')) return null

  // Map shorthand to canonical
  const CANONICAL_MAP: Record<string, string> = {
    'STATE.json': 'pilot/STATE.json',
    'TASK.json': 'pilot/TASK.json',
    'BLOCKED.json': 'pilot/BLOCKED.json',
    'pilot/STATE.json': 'pilot/STATE.json',
    'pilot/TASK.json': 'pilot/TASK.json',
    'pilot/BLOCKED.json': 'pilot/BLOCKED.json',
  }
  return CANONICAL_MAP[p] ?? null
}

const RUNNER_INVARIANT_VERIFY = ['git diff --check']

type PromptTransport = 'prompt-file' | 'stdin' | 'file-attachment'

export interface RunOptions {
  workspaceDir?: string
  runOnce?: boolean
}

interface Manifest {
  pilotFolderVersion: string
  stateSchemaVersion: number
  managedFiles: string[]
  hashes: Record<string, string>
}

interface State {
  project: string
  status: 'active' | 'waiting_human' | 'complete'
  current_task: string | null
  retry_count: number
  last_completed_task: string | null
  task_started_at: number | null
  flags?: { allowLargeDiffOnce?: boolean }
  run?: { id?: string; started_at?: number; history_dir?: string }
  config: {
    orchestratorModel: string
    builderTimeout: number
    orchestratorTimeout: number
    verifyTimeout: number
    watchdogTimeout: number
    verifyCommands: string[]
    tools?: {
      builder?: 'cursor'
      cursor?: { mode?: 'prompt-file' | 'stdin' }
      opencode?: { mode?: 'file-attachment'; format?: 'default' | 'json' }
    }
    capabilities?: { promptTransport?: PromptTransport }
    safety?: {
      largeDiff?: { maxFiles?: number; maxLines?: number }
      cleanUntrackedOnRollback?: boolean
      allowDirtyWorkspace?: boolean
    }
  }
  git: { lkg: string | null }
}

interface Task {
  id: string
  status: 'ready' | 'in_progress'
  title: string
  description: string
  acceptance?: string[]
  scope: { allowed: string[]; forbidden: string[] }
}

interface Report {
  task_id: string
  status: 'done' | 'blocked' | 'failed' | 'timeout'
  summary: string[]
  error?: string
  partial_progress?: string
  files_changed?: string[]
  questions: string[]
}

interface RecentItem {
  id: string
  title: string
  completed_at: number
  commit: string
  summary: string[]
  files_changed: string[]
  diffstat?: string
}

interface RecentFile {
  items: RecentItem[]
  max_items: number
}

interface ContextBundle {
  meta: {
    run_id: string
    created_at: number
    project_root: string
    git: { branch: string | null; head: string | null; lkg: string | null }
  }
  state_min: {
    project: string
    status: 'active' | 'waiting_human' | 'complete'
    current_task: string | null
    retry_count: number
    last_completed_task: string | null
  }
  task: Task
  roadmap_window: { next: any[]; tail: any[] }
  recent_window: { last_completed: RecentItem[] }
  last_report: Report | null
  constraints: {
    baseline_forbidden: string[]
    orchestrator_allowed_writes: string[]
    diff_guardrail: { maxFiles: number; maxLines: number }
  }
}

function resolveWorkspaceDir(workspaceDir?: string): string {
  const ws = workspaceDir || process.env.PILOT_WORKSPACE || 'pilot'
  return path.resolve(process.cwd(), ws)
}

function getPromptPath(workspaceDir: string, name: 'build' | 'orchestrate'): string {
  const override = path.join(workspaceDir, 'overrides', 'prompts', `${name}.md`)
  if (fs.existsSync(override)) return override
  return path.join(TEMPLATES_DIR, 'prompts', `${name}.md`)
}

function rotateLogIfNeeded(logPath: string) {
  try {
    if (!fs.existsSync(logPath)) return
    const stat = fs.statSync(logPath)
    if (stat.size < LOG_ROTATE_BYTES) return
    const rotated = `${logPath}.${tsCompact()}`
    fs.renameSync(logPath, rotated)
  } catch {
    // ignore
  }
}

function isAuthError(s: string): boolean {
  const authPatterns = [
    /unauthorized/i,
    /401/,
    /403/,
    /token.*expired/i,
    /authentication.*failed/i,
    /invalid.*token/i,
    /please.*login/i,
    /re-?auth/i,
  ]
  return authPatterns.some(p => p.test(s))
}

function isPlainObject(v: any): v is Record<string, any> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function deepMerge(base: any, patch: any): any {
  if (!isPlainObject(base) || !isPlainObject(patch)) return patch
  const out: any = { ...base }
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue
    const bv = (base as any)[k]
    if (v === null) out[k] = null
    else if (Array.isArray(v)) out[k] = v
    else out[k] = deepMerge(bv, v)
  }
  return out
}

function validateTaskShape(task: any): string[] {
  const errs: string[] = []
  if (!isPlainObject(task)) return ['TASK.json must be an object']
  if (typeof task.id !== 'string' || !task.id) errs.push('TASK.id must be a non-empty string')
  if (typeof task.title !== 'string' || !task.title) errs.push('TASK.title must be a non-empty string')
  if (typeof task.description !== 'string') errs.push('TASK.description must be a string')
  if (!isPlainObject(task.scope)) errs.push('TASK.scope must be an object')
  if (!Array.isArray(task.scope?.allowed)) errs.push('TASK.scope.allowed must be an array')
  if (!Array.isArray(task.scope?.forbidden)) errs.push('TASK.scope.forbidden must be an array')
  return errs
}

function validateReportShape(report: any): string[] {
  const errs: string[] = []
  if (!isPlainObject(report)) return ['REPORT.json must be an object']
  if (typeof report.task_id !== 'string' || !report.task_id) errs.push('REPORT.task_id must be a non-empty string')
  if (typeof report.status !== 'string') errs.push('REPORT.status must be a string')
  if (!Array.isArray(report.summary)) errs.push('REPORT.summary must be an array')
  if (!Array.isArray(report.questions)) errs.push('REPORT.questions must be an array')
  return errs
}

function validateRoadmapShape(roadmap: any): string[] {
  const errs: string[] = []
  if (!Array.isArray(roadmap)) return ['ROADMAP.json must be an array']
  for (let i = 0; i < Math.min(5, roadmap.length); i++) {
    const e = roadmap[i]
    if (!isPlainObject(e)) {
      errs.push(`ROADMAP[${i}] must be an object`)
      continue
    }
    if (typeof e.id !== 'string' || !e.id) errs.push(`ROADMAP[${i}].id must be a string`)
    if (typeof e.title !== 'string' || !e.title) errs.push(`ROADMAP[${i}].title must be a string`)
    if (typeof e.description !== 'string') errs.push(`ROADMAP[${i}].description must be a string`)
    if (!isPlainObject(e.scope)) errs.push(`ROADMAP[${i}].scope must be an object`)
    if (!Array.isArray(e.scope?.allowed)) errs.push(`ROADMAP[${i}].scope.allowed must be an array`)
    if (!Array.isArray(e.scope?.forbidden)) errs.push(`ROADMAP[${i}].scope.forbidden must be an array`)
  }
  return errs
}

function validateStateShape(state: any): string[] {
  const errs: string[] = []
  if (!isPlainObject(state)) return ['STATE.json must be an object']

  if (typeof state.project !== 'string') errs.push('STATE.project must be a string')
  if (state.status !== 'active' && state.status !== 'waiting_human' && state.status !== 'complete') {
    errs.push('STATE.status must be active|waiting_human|complete')
  }
  if (state.current_task !== null && typeof state.current_task !== 'string') errs.push('STATE.current_task must be string|null')
  if (typeof state.retry_count !== 'number') errs.push('STATE.retry_count must be a number')
  if (state.last_completed_task !== null && typeof state.last_completed_task !== 'string') {
    errs.push('STATE.last_completed_task must be string|null')
  }
  if (state.task_started_at !== null && typeof state.task_started_at !== 'number') errs.push('STATE.task_started_at must be number|null')

  if (!isPlainObject(state.config)) errs.push('STATE.config must be an object')
  if (isPlainObject(state.config)) {
    if (typeof state.config.orchestratorModel !== 'string') errs.push('STATE.config.orchestratorModel must be a string')
    if (typeof state.config.builderTimeout !== 'number') errs.push('STATE.config.builderTimeout must be a number')
    if (typeof state.config.orchestratorTimeout !== 'number') errs.push('STATE.config.orchestratorTimeout must be a number')
    if (typeof state.config.verifyTimeout !== 'number') errs.push('STATE.config.verifyTimeout must be a number')
    if (typeof state.config.watchdogTimeout !== 'number') errs.push('STATE.config.watchdogTimeout must be a number')
    if (!Array.isArray(state.config.verifyCommands)) errs.push('STATE.config.verifyCommands must be an array')
  }

  if (!isPlainObject(state.git)) errs.push('STATE.git must be an object')
  if (isPlainObject(state.git)) {
    if (state.git.lkg !== null && typeof state.git.lkg !== 'string') errs.push('STATE.git.lkg must be string|null')
  }

  return errs
}

function readValidatedJson<T>(state: State, filePath: string, label: string, validate: (v: any) => string[], snapshot: (label: string, filePath: string) => void, block: (reason: string, action: string, extra?: any) => void): T | null {
  if (!fs.existsSync(filePath)) return null
  const parsed = readJson<any>(filePath)
  if (parsed === null) {
    snapshot(`invalid/${tsCompact()}-${label}`, filePath)
    block(`Invalid ${label}: invalid JSON`, `cat "${filePath}"`)
    return null
  }
  const errs = validate(parsed)
  if (errs.length > 0) {
    snapshot(`invalid/${tsCompact()}-${label}`, filePath)
    block(`Invalid ${label}: ${errs[0]}`, `cat "${filePath}"`)
    return null
  }
  return parsed as T
}

function matchGlob(filepath: string, pattern: string): boolean {
  const regex = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '{{DOUBLESTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\{\{DOUBLESTAR\}\}/g, '.*')
  return new RegExp(`^${regex}$`).test(filepath)
}

function normalizeRelPath(p: string): string {
  let out = (p || '').replace(/\\/g, '/').trim()
  if (out.startsWith('./')) out = out.slice(2)
  while (out.startsWith('/')) out = out.slice(1)
  if (out.endsWith('/')) out = out.slice(0, -1)
  return out
}

function isAllowedByPrefixes(filePath: string, allowed: string[]): boolean {
  const file = normalizeRelPath(filePath)
  for (const raw of allowed ?? []) {
    const a = normalizeRelPath(String(raw))
    if (a === '' || a === '.' || a === './') return true
    if (file === a) return true
    if (file.startsWith(a + '/')) return true
  }
  return false
}

function isWorkspaceOperationalPath(changedPath: string, workspaceRelRaw: string): boolean {
  const p = changedPath.replace(/\\/g, '/')
  const rel = workspaceRelRaw.replace(/\\/g, '/')
  const prefix = rel === '' || rel === '.' ? '' : rel.replace(/\/$/, '') + '/'
  const atWorkspace = prefix === '' ? p : p.startsWith(prefix)
  if (!atWorkspace) return false

  const within = prefix === '' ? p : p.slice(prefix.length)
  if (
    within === 'STATE.json' ||
    within === 'TASK.json' ||
    within === 'REPORT.json' ||
    within === 'BLOCKED.json' ||
    within === 'run.log' ||
    within === 'MANIFEST.json' ||
    within === 'ROADMAP.json' ||
    within === '.gitignore'
  ) {
    return true
  }

  if (
    within.startsWith('history/') ||
    within.startsWith('overrides/') ||
    within.startsWith('.tmp/') ||
    within.startsWith('.backup/') ||
    within.startsWith('tools/')
  ) {
    return true
  }

  return false
}

function compactStringArray(arr: any, maxItems: number, maxItemLen: number): string[] {
  if (!Array.isArray(arr)) return []
  const out: string[] = []
  for (const v of arr) {
    if (typeof v !== 'string') continue
    out.push(truncate(v, maxItemLen))
    if (out.length >= maxItems) break
  }
  return out
}

function compactRoadmapEntry(entry: any): any {
  if (!entry || typeof entry !== 'object') return null
  const scope = entry.scope && typeof entry.scope === 'object' ? entry.scope : {}
  return {
    id: typeof entry.id === 'string' ? entry.id : null,
    title: typeof entry.title === 'string' ? truncate(entry.title, 120) : null,
    description: typeof entry.description === 'string' ? truncate(entry.description, 800) : null,
    acceptance: compactStringArray(entry.acceptance, 8, 160),
    scope: {
      allowed: compactStringArray(scope.allowed, 20, 160),
      forbidden: compactStringArray(scope.forbidden, 20, 160),
    },
  }
}

function readRecent(recentPath: string): RecentFile {
  const raw = readJson<any>(recentPath)
  const items = Array.isArray(raw?.items) ? raw.items : []
  const maxItems = typeof raw?.max_items === 'number' ? raw.max_items : 5
  const out: RecentItem[] = []
  for (const it of items) {
    if (!it || typeof it !== 'object') continue
    if (typeof it.id !== 'string' || typeof it.title !== 'string' || typeof it.commit !== 'string') continue
    out.push({
      id: it.id,
      title: truncate(it.title, 120),
      completed_at: typeof it.completed_at === 'number' ? it.completed_at : Date.now(),
      commit: it.commit,
      summary: compactStringArray(it.summary, 6, 160),
      files_changed: compactStringArray(it.files_changed, 20, 220),
      diffstat: typeof it.diffstat === 'string' ? truncate(it.diffstat, 600) : undefined,
    })
    if (out.length >= Math.max(5, maxItems)) break
  }
  return { items: out.slice(0, Math.min(5, maxItems)), max_items: Math.min(5, maxItems) }
}

function writeRecentAtomic(recentPath: string, recent: RecentFile) {
  writeJsonAtomic(recentPath, { items: recent.items.slice(0, recent.max_items), max_items: recent.max_items })
}

function updateRecentOnCommit(projectRoot: string, recentPath: string, taskId: string, taskTitle: string, reportSummary: string[], commitHash: string | null) {
  if (!commitHash) return
  const existing = readRecent(recentPath)

  let filesChanged: string[] = []
  try {
    const out = sh('git show --name-only --pretty="" HEAD', projectRoot).trimEnd()
    filesChanged = out ? out.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 20) : []
  } catch {
    filesChanged = []
  }

  let diffstat = ''
  try {
    const out = sh('git show --stat --oneline --no-color HEAD', projectRoot).trimEnd()
    diffstat = out ? out.split('\n').slice(0, 24).join('\n') : ''
  } catch {
    diffstat = ''
  }

  const nextItem: RecentItem = {
    id: taskId,
    title: truncate(taskTitle, 120),
    completed_at: Date.now(),
    commit: commitHash,
    summary: compactStringArray(reportSummary, 6, 160),
    files_changed: filesChanged,
    diffstat: diffstat || undefined,
  }

  const merged = [nextItem, ...existing.items.filter(i => i.id !== taskId)].slice(0, existing.max_items)
  writeRecentAtomic(recentPath, { items: merged, max_items: existing.max_items })
}

function buildContextBundle(runId: string, state: State, task: Task, lastReport: Report | null, roadmap: any[], projectRoot: string, recentPath: string): ContextBundle {
  const recent = readRecent(recentPath)
  const maxFiles = state.config?.safety?.largeDiff?.maxFiles ?? 8
  const maxLines = state.config?.safety?.largeDiff?.maxLines ?? 300

  let branch: string | null = null
  let head: string | null = null
  try {
    branch = sh('git rev-parse --abbrev-ref HEAD', projectRoot).trim()
  } catch {
    branch = null
  }
  try {
    head = sh('git rev-parse HEAD', projectRoot).trim()
  } catch {
    head = null
  }

  const next = Array.isArray(roadmap) ? roadmap.slice(0, 5).map(compactRoadmapEntry).filter(Boolean) : []
  const tail = Array.isArray(roadmap) ? roadmap.slice(Math.max(0, roadmap.length - 5)).map(compactRoadmapEntry).filter(Boolean) : []

  return {
    meta: {
      run_id: runId,
      created_at: Date.now(),
      project_root: path.relative(process.cwd(), projectRoot) || projectRoot,
      git: {
        branch,
        head,
        lkg: state.git?.lkg ?? null,
      },
    },
    state_min: {
      project: state.project,
      status: state.status,
      current_task: state.current_task,
      retry_count: state.retry_count,
      last_completed_task: state.last_completed_task,
    },
    task,
    roadmap_window: { next, tail },
    recent_window: { last_completed: recent.items },
    last_report: lastReport,
    constraints: {
      baseline_forbidden: BASELINE_FORBIDDEN.slice(),
      orchestrator_allowed_writes: ORCHESTRATOR_ALLOWED_WRITES.slice(),
      diff_guardrail: { maxFiles, maxLines },
    },
  }
}

function computeDiffStats(projectRoot: string): { fileCount: number; totalLines: number; hadBinary: boolean } {
  let hadBinary = false
  let totalLines = 0
  const fileSet = new Set<string>()

  const addNumstat = (cmd: string) => {
    try {
      const out = sh(cmd, projectRoot).trimEnd()
      if (!out) return
      for (const line of out.split('\n')) {
        const [a, d, f] = line.split('\t')
        if (!f) continue
        fileSet.add(f)
        if (a === '-' || d === '-') {
          hadBinary = true
          continue
        }
        totalLines += (Number(a) || 0) + (Number(d) || 0)
      }
    } catch {
      // ignore
    }
  }

  addNumstat('git diff --numstat')
  addNumstat('git diff --cached --numstat')

  try {
    const untracked = sh('git ls-files --others --exclude-standard', projectRoot).trimEnd()
    if (untracked) {
      for (const f of untracked.split('\n').filter(Boolean)) {
        fileSet.add(f)
        try {
          const full = path.join(projectRoot, f)
          const content = fs.readFileSync(full, 'utf8')
          totalLines += content.split('\n').length
        } catch {
          hadBinary = true
        }
      }
    }
  } catch {
    // ignore
  }

  return { fileCount: fileSet.size, totalLines, hadBinary }
}

function getDiffStatText(projectRoot: string): string {
  try {
    return sh('git diff --stat', projectRoot).trimEnd() + '\n'
  } catch {
    return ''
  }
}

function getChangedFiles(projectRoot: string): { files: string[]; untracked: Set<string> } {
  const untracked = new Set<string>()
  try {
    const out = sh('git status --porcelain', projectRoot).trimEnd()
    if (!out) return { files: [], untracked }

    const files = new Set<string>()
    for (const line of out.split('\n')) {
      const trimmed = line.trimEnd()
      if (trimmed.length < 4) continue
      const xy = trimmed.slice(0, 2)
      let file = trimmed.slice(3)
      const arrow = file.indexOf('->')
      if (arrow !== -1) file = file.slice(arrow + 2).trim()
      files.add(file)
      if (xy === '??') untracked.add(file)
    }
    return { files: [...files], untracked }
  } catch {
    return { files: [], untracked }
  }
}

function effectiveForbidden(task: Task): string[] {
  return [...new Set([...BASELINE_FORBIDDEN, ...(task.scope?.forbidden ?? [])])]
}

function snapshotRollbackArtifacts(projectRoot: string, historyDir: string, tag: string): string {
  const folder = `${tsCompact()}-${tag}`
  const base = path.join(historyDir, 'rollback', folder)
  ensureDir(base)

  let diff = ''
  let cached = ''
  let untracked = ''
  try { diff = sh('git diff', projectRoot) } catch { diff = '' }
  try { cached = sh('git diff --cached', projectRoot) } catch { cached = '' }
  try { untracked = sh('git ls-files --others --exclude-standard', projectRoot) } catch { untracked = '' }

  fs.writeFileSync(path.join(base, 'diff.patch'), diff)
  fs.writeFileSync(path.join(base, 'cached.patch'), cached)
  fs.writeFileSync(path.join(base, 'untracked.txt'), untracked)

  return base
}

function rollbackToLkg(state: State, projectRoot: string, historyDir: string, tag: string): { ok: boolean; patchDir: string } {
  const patchDir = snapshotRollbackArtifacts(projectRoot, historyDir, tag)
  const lkg = state.git?.lkg
  if (!lkg) return { ok: false, patchDir }
  try {
    sh(`git reset --hard ${lkg}`, projectRoot)
    if (state.config?.safety?.cleanUntrackedOnRollback) {
      sh('git clean -fd', projectRoot)
    }
    return { ok: true, patchDir }
  } catch {
    return { ok: false, patchDir }
  }
}

function enforceScopeAndForbidden(
  task: Task,
  state: State,
  projectRoot: string,
  workspaceDir: string,
  historyDir: string
): { ok: boolean; violations?: string[]; rollback_patch_dir?: string } {
  const { files, untracked } = getChangedFiles(projectRoot)
  if (files.length === 0) return { ok: true }

  const workspaceRel = path.relative(projectRoot, workspaceDir)
  const filteredFiles = files.filter(f => !isWorkspaceOperationalPath(f, workspaceRel))
  if (filteredFiles.length === 0) return { ok: true }

  const forb = effectiveForbidden(task)
  const violations: string[] = []
  const forbiddenFiles: string[] = []

  for (const f of filteredFiles) {
    for (const p of forb) {
      if (matchGlob(f, p)) {
        violations.push(`FORBIDDEN: ${f} matches ${p}`)
        forbiddenFiles.push(f)
        break
      }
    }

    const allowedPrefixes = task.scope?.allowed ?? []
    if (!isAllowedByPrefixes(f, allowedPrefixes)) {
      violations.push(`NOT ALLOWED: ${f} outside scope ${allowedPrefixes.join(', ')}`)
    }
  }

  if (violations.length === 0) return { ok: true }
  const rb = rollbackToLkg(state, projectRoot, historyDir, 'scope-or-forbidden')

  const forbiddenUntracked = forbiddenFiles.filter(f => untracked.has(f))
  if (forbiddenUntracked.length > 0) {
    const quoted = forbiddenUntracked.map(f => `"${f.replace(/"/g, '')}"`).join(' ')
    try {
      sh(`git clean -fd -- ${quoted}`, projectRoot)
    } catch {
      // ignore
    }
  }

  return { ok: false, violations, rollback_patch_dir: rb.patchDir }
}

function runCommandGroup(projectRoot: string, historyDir: string, group: string, commands: string[], timeout: number, log: (msg: string) => void): boolean {
  if (commands.length === 0) return true
  log(`🧪 Verifying (${group})...`)
  let i = 0
  for (const cmd of commands) {
    const label = `${group}-${String(i).padStart(2, '0')}.txt`
    try {
      const out = sh(`${cmd} 2>&1`, projectRoot, { timeout, stdio: 'pipe', encoding: 'utf8' })
      fs.writeFileSync(path.join(historyDir, 'verify', label), out)
      if (out) process.stdout.write(out)
      log(`  ✓ ${cmd}`)
    } catch (e: any) {
      const out =
        (e?.stdout?.toString?.() ?? '') +
        (e?.stderr?.toString?.() ?? '') +
        (e?.message ? `\n${String(e.message)}\n` : '')
      fs.writeFileSync(path.join(historyDir, 'verify', label), out)
      if (out) process.stdout.write(out)
      log(`  ✗ ${cmd}`)
      return false
    }
    i++
  }
  return true
}

function getOriginDefaultBranch(projectRoot: string): string | null {
  try {
    const ref = sh('git symbolic-ref refs/remotes/origin/HEAD', projectRoot).trim()
    const m = ref.match(/refs\/remotes\/origin\/(.+)$/)
    return m ? m[1] : null
  } catch {
    return null
  }
}

function isDirty(projectRoot: string): boolean {
  try {
    return sh('git status --porcelain', projectRoot).trim().length > 0
  } catch {
    return false
  }
}

function getBranch(projectRoot: string): string | null {
  try {
    const b = sh('git rev-parse --abbrev-ref HEAD', projectRoot).trim()
    return b === 'HEAD' ? null : b
  } catch {
    return null
  }
}

function ensureSessionBranchOrBlock(projectRoot: string, state: State, statePath: string, block: (reason: string, action: string, extra?: any) => void, snapshotText: (label: string, content: string) => void, log: (msg: string) => void): boolean {
  const originDefault = getOriginDefaultBranch(projectRoot)
  const current = getBranch(projectRoot)
  if (!current) {
    block('Detached HEAD', 'git checkout -b pilot/session-YYYYMMDD-HHMM')
    return false
  }

  const defaultCandidates = new Set<string>(['main', 'master'])
  if (originDefault) defaultCandidates.add(originDefault)

  const treatAsDefault = originDefault ? current === originDefault : defaultCandidates.has(current)
  if (!treatAsDefault) return true

  if (isDirty(projectRoot)) {
    const allowDirty = state.config?.safety?.allowDirtyWorkspace === true
    if (allowDirty) {
      // Skip dirty block; still create session branch below
      log(`⚠️  Working tree dirty on ${current} (allowDirtyWorkspace=true, proceeding)`)
    } else if (process.env.PILOT_AUTOSTASH === '1') {
      try {
        const msg = `pilot autostash ${state.run?.id ?? ''}`.trim()
        sh(`git stash push -u -m "${msg.replace(/"/g, '')}"`, projectRoot)
      } catch {
        block(`Working tree dirty on ${current}`, 'git stash -u')
        return false
      }
    } else {
      // Provide a one-liner action to flip allowDirtyWorkspace in STATE.json
      const escaped = statePath.replace(/'/g, "\\'")
      const oneLiner = `node -e "const fs=require('fs'),p='${escaped}',s=JSON.parse(fs.readFileSync(p,'utf8'));s.config=s.config||{};s.config.safety=s.config.safety||{};s.config.safety.allowDirtyWorkspace=true;fs.writeFileSync(p,JSON.stringify(s,null,2));" && echo 'Set allowDirtyWorkspace=true, rerun: pilot run --once'`
      block(`Working tree dirty on ${current}`, oneLiner)
      return false
    }
  }

  const base = `pilot/session-${tsMinute()}`
  const tryNames = [base, `${base}-${randomId(4)}`]
  for (const name of tryNames) {
    try {
      sh(`git checkout -b "${name}"`, projectRoot)
      snapshotText('git-branch.txt', name + '\n')
      log(`🌿 Switched to ${name}`)
      return true
    } catch {
      // next
    }
  }
  block('Failed to create session branch', 'git checkout -b pilot/session-YYYYMMDD-HHMM', { error: 'git checkout -b failed' })
  return false
}

function checkUpgradeOrBlock(workspaceDir: string, state: State, block: (reason: string, action: string, extra?: any) => void): boolean {
  const expected = readJson<Manifest>(path.join(TEMPLATES_DIR, 'MANIFEST.json'))
  if (!expected) return true
  const current = readJson<Manifest>(path.join(workspaceDir, 'MANIFEST.json'))
  if (!current) {
    block('Pilot workspace out of date (missing MANIFEST.json)', 'pilot upgrade')
    return false
  }
  if (semverLt(current.pilotFolderVersion, expected.pilotFolderVersion)) {
    block(`Pilot workspace out of date (${current.pilotFolderVersion} < ${expected.pilotFolderVersion})`, 'pilot upgrade')
    return false
  }
  return true
}

export async function runPilot(opts: RunOptions = {}) {
  const workspaceDir = resolveWorkspaceDir(opts.workspaceDir)
  // Workspace dir is the anchor for git detection. The actual git root is resolved after preflight.
  // This prevents false "Not a git repository" blocks when the caller runs from outside the repo.
  let projectRoot = workspaceDir

  const PATHS = {
    state: path.join(workspaceDir, 'STATE.json'),
    task: path.join(workspaceDir, 'TASK.json'),
    report: path.join(workspaceDir, 'REPORT.json'),
    roadmap: path.join(workspaceDir, 'ROADMAP.json'),
    blocked: path.join(workspaceDir, 'BLOCKED.json'),
    context: path.join(workspaceDir, 'CONTEXT.json'),
    recent: path.join(workspaceDir, 'RECENT.json'),
    manifest: path.join(workspaceDir, 'MANIFEST.json'),
    log: path.join(workspaceDir, 'run.log'),
    tmpDir: path.join(workspaceDir, '.tmp'),
    historyDir: path.join(workspaceDir, 'history'),
  }

  rotateLogIfNeeded(PATHS.log)

  const log = (msg: string) => {
    const ts = new Date().toISOString().slice(0, 19).replace('T', ' ')
    const line = `[${ts}] ${msg}`
    console.log(line)
    try {
      ensureDir(path.dirname(PATHS.log))
      fs.appendFileSync(PATHS.log, line + '\n')
    } catch {
      // ignore
    }
  }

  const notify = (title: string, msg: string) => {
    log(`⚠️  ${title}: ${msg}`)
    try {
      execSync(
        `terminal-notifier -title "Pilot: ${title}" -message "${msg.replace(/"/g, '\\"')}" -sound default`,
        { stdio: 'pipe' }
      )
    } catch {
      // ignore
    }
  }

  const runId = `run-${tsCompact()}-${randomId(6)}`
  const runHistoryDir = path.join(PATHS.historyDir, `${tsCompact()}-${runId}`)
  ensureDir(PATHS.tmpDir)
  ensureDir(PATHS.historyDir)
  ensureDir(runHistoryDir)
  ensureDir(path.join(runHistoryDir, 'verify'))

  const snapshotFile = (label: string, filePath: string) => {
    try {
      if (!fs.existsSync(filePath)) return
      const dest = path.join(runHistoryDir, label)
      ensureDir(path.dirname(dest))
      fs.copyFileSync(filePath, dest)
    } catch {
      // ignore
    }
  }

  const snapshotText = (label: string, content: string) => {
    try {
      const dest = path.join(runHistoryDir, label)
      ensureDir(path.dirname(dest))
      fs.writeFileSync(dest, content)
    } catch {
      // ignore
    }
  }

  const block = (reason: string, action: string, extra?: any) => {
    const payload = {
      reason,
      action,
      run: {
        id: runId,
        history_dir: path.relative(projectRoot, runHistoryDir),
      },
      ...extra,
    }
    snapshotFile('STATE.json', PATHS.state)
    snapshotFile('TASK.json', PATHS.task)
    snapshotFile('REPORT.json', PATHS.report)
    writeJsonAtomic(PATHS.blocked, payload)
    notify('Blocked', reason)
  }

  if (!fs.existsSync(PATHS.state)) {
    block('Missing pilot/STATE.json', 'pilot init')
    return
  }

  const parsedState = readJson<State>(PATHS.state)
  if (!parsedState) {
    block('Invalid STATE.json', `cat "${PATHS.state}"`)
    return
  }

  let state: State = parsedState

  state.run = {
    id: runId,
    started_at: Date.now(),
    history_dir: path.relative(projectRoot, runHistoryDir),
  }
  writeJsonAtomic(PATHS.state, state)

  snapshotFile('startup/STATE.json', PATHS.state)
  snapshotFile('startup/ROADMAP.json', PATHS.roadmap)

  if (!checkUpgradeOrBlock(workspaceDir, state, block)) {
    state.status = 'waiting_human'
    writeJsonAtomic(PATHS.state, state)
    return
  }

  // Preflight (deterministic)
  try {
    sh('git rev-parse --is-inside-work-tree', workspaceDir)
    projectRoot = sh('git rev-parse --show-toplevel', workspaceDir).trim()
  } catch {
    block('Not a git repository', 'git init')
    state.status = 'waiting_human'
    writeJsonAtomic(PATHS.state, state)
    return
  }

  let head: string | null = null
  try {
    head = sh('git rev-parse HEAD', projectRoot).trim()
  } catch {
    head = null
  }
  if (!head) {
    block('No commits yet (needed for rollback/LKG)', 'git commit --allow-empty -m "pilot: init"')
    state.status = 'waiting_human'
    writeJsonAtomic(PATHS.state, state)
    return
  }
  if (!state.git.lkg) state.git.lkg = head

  try {
    if (OPENCODE_BIN.includes('/')) {
      sh(`test -x "${OPENCODE_BIN.replace(/"/g, '')}"`, projectRoot)
    } else {
      sh(`command -v ${OPENCODE_BIN}`, projectRoot)
    }
  } catch {
    block(`${OPENCODE_BIN} not found`, 'Install OpenCode CLI (opencode) from https://opencode.ai/install, then rerun: pilot run --once')
    state.status = 'waiting_human'
    writeJsonAtomic(PATHS.state, state)
    return
  }
  try {
    if (CURSOR_BIN.includes('/')) {
      sh(`test -x "${CURSOR_BIN.replace(/"/g, '')}"`, projectRoot)
    } else {
      sh(`command -v ${CURSOR_BIN}`, projectRoot)
    }
  } catch {
    if (CURSOR_BIN === DEFAULT_CURSOR_BIN) {
      block(
        'cursor-agent not found',
        'Install Cursor Agent CLI (cursor-agent) from https://cursor.com/install OR set PILOT_CURSOR_BIN to a custom builder command, then rerun: pilot run --once'
      )
    } else {
      block(
        `${CURSOR_BIN} not found`,
        'Install Cursor Agent CLI (cursor-agent) from https://cursor.com/install OR set PILOT_CURSOR_BIN to a custom builder command, then rerun: pilot run --once'
      )
    }
    state.status = 'waiting_human'
    writeJsonAtomic(PATHS.state, state)
    return
  }

  if (!ensureSessionBranchOrBlock(projectRoot, state, PATHS.state, (r: string, a: string, e?: any) => {
    block(r, a, e)
    state.status = 'waiting_human'
    writeJsonAtomic(PATHS.state, state)
  }, snapshotText, log)) {
    return
  }

  // Startup reconcile
  if (fs.existsSync(PATHS.report)) {
    const report = readJson<Report>(PATHS.report)
    if (!state.current_task || (report && report.task_id !== state.current_task)) {
      snapshotFile(`startup/${tsCompact()}-REPORT.json`, PATHS.report)
      fs.unlinkSync(PATHS.report)
    }
  }
  if (state.task_started_at && !fs.existsSync(PATHS.report) && fs.existsSync(PATHS.task)) {
    const task = readJson<Task>(PATHS.task)
    if (task && task.status === 'in_progress') {
      snapshotFile(`startup/${tsCompact()}-TASK.json`, PATHS.task)
      task.status = 'ready'
      writeJsonAtomic(PATHS.task, task)
      state.task_started_at = null
      writeJsonAtomic(PATHS.state, state)
    }
  }
  if (!fs.existsSync(PATHS.task) && fs.existsSync(PATHS.roadmap)) {
    const roadmap = readJson<any[]>(PATHS.roadmap)
    if (roadmap && roadmap.length > 0) {
      const first = { ...roadmap[0], status: 'ready' }
      writeJsonAtomic(PATHS.task, first)
    }
  }

  const runOnce = !!opts.runOnce || process.env.PILOT_RUN_ONCE === '1'

  let warnedUnqualifiedModel = false

  let busy = false

  const runBuilderViaCursor = (promptPath: string): { ok: boolean; error?: string; transport?: PromptTransport } => {
    const mode = state.config?.tools?.cursor?.mode ?? 'prompt-file'
    try {
      if (mode === 'stdin') {
        sh(`${CURSOR_BIN} --force < "${promptPath}"`, projectRoot, { timeout: state.config.builderTimeout, stdio: 'inherit' })
        return { ok: true, transport: 'stdin' }
      }
      sh(`${CURSOR_BIN} --prompt-file "${promptPath}" --force`, projectRoot, { timeout: state.config.builderTimeout, stdio: 'inherit' })
      return { ok: true, transport: 'prompt-file' }
    } catch (e: any) {
      const errorMsg = e?.stderr?.toString?.() || e?.message || 'Unknown error'
      if (mode === 'prompt-file' && /unknown option|unknown flag|unrecognized option|prompt-file/i.test(errorMsg)) {
        return { ok: false, error: `${CURSOR_BIN} does not support --prompt-file` }
      }
      return { ok: false, error: errorMsg }
    }
  }

  const runBuilder = (task: Task): boolean => {
    log(`🔨 Builder: ${task.id} - ${task.title}`)
    const promptTplPath = getPromptPath(workspaceDir, 'build')
    const basePrompt = fs.readFileSync(promptTplPath, 'utf8')
    const fullPrompt = `${basePrompt}\n\n---\n\n## TASK.json:\n\n\`\`\`json\n${JSON.stringify(task, null, 2)}\n\`\`\`\n\nExecute now.\n`
    const promptPath = path.join(PATHS.tmpDir, `${runId}.build.prompt.md`)
    writeTextAtomic(promptPath, fullPrompt)

    const builder = state.config?.tools?.builder ?? 'cursor'
    if (builder !== 'cursor') {
      block(`Unsupported builder tool: ${builder}`, `Edit ${PATHS.state} config.tools.builder to "cursor"`)
      state.status = 'waiting_human'
      writeJsonAtomic(PATHS.state, state)
      return false
    }

    const res = runBuilderViaCursor(promptPath)
    if (res.ok) {
      state.config.capabilities = { ...(state.config.capabilities ?? {}), promptTransport: res.transport ?? 'prompt-file' }
      writeJsonAtomic(PATHS.state, state)
      log('✓ Builder finished')
      return true
    }

    const errorMsg = res.error ?? 'Unknown error'
    if (res.error === `${CURSOR_BIN} does not support --prompt-file`) {
      block(`${CURSOR_BIN} does not support --prompt-file`, `${CURSOR_BIN} --help`, { error: errorMsg })
      state.status = 'waiting_human'
      writeJsonAtomic(PATHS.state, state)
      return false
    }
    if (isAuthError(errorMsg)) {
      block(`Authentication required (${CURSOR_BIN})`, `${CURSOR_BIN} auth`, { error: errorMsg })
      state.status = 'waiting_human'
      writeJsonAtomic(PATHS.state, state)
      return false
    }

    // Write REPORT on failure if not written
    if (!fs.existsSync(PATHS.report)) {
      writeJsonAtomic(PATHS.report, {
        task_id: task.id,
        status: /timed out|timeout/i.test(errorMsg) ? 'timeout' : 'failed',
        summary: ['Builder failed'],
        error: truncate(String(errorMsg), 2000),
        partial_progress: 'Check git status/diff for any partial changes',
        files_changed: [],
        questions: [],
      })
    }
    return false
  }

  const validateOrchestratorOutput = (parsed: any): { valid: boolean; error?: string } => {
    if (!parsed || typeof parsed !== 'object') return { valid: false, error: 'Output is not an object' }
    if (!parsed.status || typeof parsed.status !== 'string') return { valid: false, error: 'Missing or invalid status string' }
    if (parsed.status !== 'ok' && parsed.status !== 'blocked' && parsed.status !== 'error') {
      return { valid: false, error: 'Invalid status value' }
    }
    if (parsed.writes !== undefined && (!parsed.writes || typeof parsed.writes !== 'object' || Array.isArray(parsed.writes))) {
      return { valid: false, error: 'Missing or invalid writes object' }
    }

    // normalize notes
    if (parsed.notes === undefined) {
      parsed.notes = []
    } else if (typeof parsed.notes === 'string') {
      parsed.notes = [parsed.notes]
    } else if (Array.isArray(parsed.notes)) {
      if (parsed.notes.some((n: any) => typeof n !== 'string')) {
        return { valid: false, error: 'Invalid notes' }
      }
    } else {
      return { valid: false, error: 'Invalid notes' }
    }

    return { valid: true }
  }

  const runOrchestrator = async (report: Report): Promise<boolean> => {
    log(`🎯 Orchestrator (${state.config.orchestratorModel})`)

    const task = readValidatedJson<Task>(state, PATHS.task, 'TASK.json', validateTaskShape, snapshotFile, (r, a, e) => {
      block(r, a, e)
      state.status = 'waiting_human'
      writeJsonAtomic(PATHS.state, state)
    })
    if (!task) return false

    const roadmap = readValidatedJson<any[]>(state, PATHS.roadmap, 'ROADMAP.json', validateRoadmapShape, snapshotFile, (r, a, e) => {
      block(r, a, e)
      state.status = 'waiting_human'
      writeJsonAtomic(PATHS.state, state)
    }) ?? []
    if (fs.existsSync(PATHS.blocked)) return false

    const context = buildContextBundle(runId, state, task, report ?? null, roadmap, projectRoot, PATHS.recent)
    writeJsonAtomic(PATHS.context, context)
    snapshotFile(`context/${tsCompact()}-CONTEXT.json`, PATHS.context)

    let stdout = ''
    try {
      const orchPromptPath = getPromptPath(workspaceDir, 'orchestrate')

      const configuredModel = String(state.config.orchestratorModel || '').trim()
      const modelArg = configuredModel.includes('/') ? ` --model "${configuredModel}"` : ''
      if (configuredModel && !configuredModel.includes('/') && !warnedUnqualifiedModel) {
        warnedUnqualifiedModel = true
        log(`⚠️  Ignoring unqualified orchestratorModel: ${configuredModel}`)
      }

      stdout = sh(
        // IMPORTANT (A1): no dynamic prompt content in argv. Only constant message + file paths.
        // IMPORTANT: opencode run positionals are the message; use `--` to prevent yargs from
        // consuming the message as an extra --file entry.
        `${OPENCODE_BIN} run --print-logs --log-level ERROR${modelArg} --format json --file "${orchPromptPath}" --file "${PATHS.context}" -- "${ORCH_INLINE_MESSAGE}"`,
        projectRoot,
        { timeout: state.config.orchestratorTimeout, stdio: 'pipe', encoding: 'utf8' }
      )
    } catch (e: any) {
      const err = e?.stderr?.toString?.() || e?.message || 'Unknown error'
      if (/unknown option|unknown flag|unrecognized option|--file/i.test(err)) {
        const rb = rollbackToLkg(state, projectRoot, runHistoryDir, 'orchestrator-unsupported')
        block(`${OPENCODE_BIN} does not support file attachments (--file)`, `${OPENCODE_BIN} upgrade`, {
          error: err,
          rollback_patch_dir: rb.patchDir,
        })
        state.status = 'waiting_human'
        writeJsonAtomic(PATHS.state, state)
        return false
      }
      if (isAuthError(err)) {
        block(`Authentication required (${OPENCODE_BIN})`, `${OPENCODE_BIN} auth login`, { error: err })
        state.status = 'waiting_human'
        writeJsonAtomic(PATHS.state, state)
        return false
      }
      const rb = rollbackToLkg(state, projectRoot, runHistoryDir, 'orchestrator-run-failed')
      block('Orchestrator failed to run', `${OPENCODE_BIN} run --help --print-logs`, {
        error: err,
        rollback_patch_dir: rb.patchDir,
      })
      state.status = 'waiting_human'
      writeJsonAtomic(PATHS.state, state)
      return false
    }

    snapshotText('orchestrator/raw-stdout.txt', stdout)
    const rawOutPath = path.join(runHistoryDir, 'orchestrator', 'raw-stdout.txt')
    ensureDir(path.dirname(rawOutPath))
    fs.writeFileSync(rawOutPath, stdout)

    const trimmed = stdout.trim()
    let parsed: any
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      const rb = rollbackToLkg(state, projectRoot, runHistoryDir, 'orchestrator-parse-failed')
      const first20 = trimmed.split('\n').slice(0, 20).join('\n')
      block('Orchestrator output was not valid JSON', `cat "${rawOutPath}"`, { first20, rollback_patch_dir: rb.patchDir })
      state.status = 'waiting_human'
      writeJsonAtomic(PATHS.state, state)
      return false
    }

    const validation = validateOrchestratorOutput(parsed)
    if (!validation.valid) {
      const rb = rollbackToLkg(state, projectRoot, runHistoryDir, 'orchestrator-output-rejected')
      block('Orchestrator output rejected', `cat "${rawOutPath}"`, { error: validation.error, rollback_patch_dir: rb.patchDir })
      state.status = 'waiting_human'
      writeJsonAtomic(PATHS.state, state)
      return false
    }
    const writes: Record<string, any> = parsed.writes && typeof parsed.writes === 'object' ? parsed.writes : {}

    // Validate and canonicalize all write keys first
    const canonicalWrites: Array<{ original: string; canonical: string; patch: any }> = []
    for (const [filepath, patch] of Object.entries(writes)) {
      const canonical = canonicalizeWriteKey(filepath)
      if (!canonical || !ORCHESTRATOR_ALLOWED_WRITES.includes(canonical)) {
        const rb = rollbackToLkg(state, projectRoot, runHistoryDir, 'orchestrator-forbidden-write')
        block('Orchestrator output rejected', `cat "${rawOutPath}"`, {
          error: `Orchestrator attempted forbidden write: ${filepath}`,
          rollback_patch_dir: rb.patchDir,
        })
        state.status = 'waiting_human'
        writeJsonAtomic(PATHS.state, state)
        return false
      }
      canonicalWrites.push({ original: filepath, canonical, patch })
    }

    // Apply merge-patch semantics for STATE/TASK; full replace for BLOCKED.
    for (const { original, canonical, patch } of canonicalWrites) {
      const destPath =
        canonical === 'pilot/STATE.json'
          ? PATHS.state
          : canonical === 'pilot/TASK.json'
            ? PATHS.task
            : PATHS.blocked
      const destName = path.basename(destPath)

      if (canonical === 'pilot/STATE.json') {
        const baseState = readJson<any>(PATHS.state) ?? {}
        const merged = deepMerge(baseState, patch)

        // Runner is source of truth: freeze config + git.
        merged.config = state.config
        merged.git = state.git

        const errs = validateStateShape(merged)
        if (errs.length > 0) {
          block('Orchestrator output rejected', `cat "${rawOutPath}"`, { error: errs[0] })
          state.status = 'waiting_human'
          writeJsonAtomic(PATHS.state, state)
          return false
        }

        writeJsonAtomic(destPath, merged)
        log(`  → patched ${original} => ${destName}`)
        continue
      }

      if (canonical === 'pilot/TASK.json') {
        const baseTask = readJson<any>(PATHS.task) ?? {}
        const merged = deepMerge(baseTask, patch)
        const errs = validateTaskShape(merged)
        if (errs.length > 0) {
          block('Orchestrator output rejected', `cat "${rawOutPath}"`, { error: errs[0] })
          state.status = 'waiting_human'
          writeJsonAtomic(PATHS.state, state)
          return false
        }
        writeJsonAtomic(destPath, merged)
        log(`  → patched ${original} => ${destName}`)
        continue
      }

      if (canonical === 'pilot/BLOCKED.json') {
        if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
          block('Orchestrator output rejected', `cat "${rawOutPath}"`, { error: 'pilot/BLOCKED.json must be an object' })
          state.status = 'waiting_human'
          writeJsonAtomic(PATHS.state, state)
          return false
        }
        if ('reason' in (patch as any) && typeof (patch as any).reason !== 'string') {
          block('Orchestrator output rejected', `cat "${rawOutPath}"`, { error: 'BLOCKED.reason must be a string' })
          state.status = 'waiting_human'
          writeJsonAtomic(PATHS.state, state)
          return false
        }
        writeJsonAtomic(destPath, patch)
        log(`  → wrote ${original} => ${destName}`)
        continue
      }
    }

    if (parsed.delete && Array.isArray(parsed.delete)) {
      for (const filepath of parsed.delete) {
        const fullPath = filepath.startsWith('/') ? filepath : path.join(projectRoot, filepath)
        try {
          fs.unlinkSync(fullPath)
        } catch {
          // ignore
        }
        log(`  → deleted ${filepath}`)
      }
    }
    log(`✓ ${parsed.status}`)
    return true
  }

  const handleTask = async () => {
    if (busy) return
    state = readJson<State>(PATHS.state) ?? state
    if (state.status !== 'active') return

    const task = readValidatedJson<Task>(state, PATHS.task, 'TASK.json', validateTaskShape, snapshotFile, (r, a, e) => {
      block(r, a, e)
      state.status = 'waiting_human'
      writeJsonAtomic(PATHS.state, state)
    })
    if (!task) return
    if (task.status !== 'ready') return

    busy = true
    try {
      task.status = 'in_progress'
      writeJsonAtomic(PATHS.task, task)
      state.current_task = task.id
      state.task_started_at = Date.now()
      writeJsonAtomic(PATHS.state, state)
      runBuilder(task)
    } finally {
      busy = false
    }
  }

  const handleReport = async () => {
    if (busy) return
    state = readJson<State>(PATHS.state) ?? state
    if (state.status !== 'active') return

    const report = readValidatedJson<Report>(state, PATHS.report, 'REPORT.json', validateReportShape, snapshotFile, (r, a, e) => {
      block(r, a, e)
      state.status = 'waiting_human'
      writeJsonAtomic(PATHS.state, state)
    })
    if (!report) return
    if (report.task_id !== state.current_task) {
      snapshotFile(`stale/${tsCompact()}-REPORT.json`, PATHS.report)
      try { fs.unlinkSync(PATHS.report) } catch {}
      return
    }

    busy = true
    try {
      state.task_started_at = null
      writeJsonAtomic(PATHS.state, state)

      const task = readValidatedJson<Task>(state, PATHS.task, 'TASK.json', validateTaskShape, snapshotFile, (r, a, e) => {
        block(r, a, e)
        state.status = 'waiting_human'
        writeJsonAtomic(PATHS.state, state)
      })
      if (!task) return

      if (report.status === 'done') {
        const res = enforceScopeAndForbidden(task, state, projectRoot, workspaceDir, runHistoryDir)
        if (!res.ok) {
          block('Scope/forbidden violation', 'Review changed files and adjust scope', {
            violations: res.violations ?? [],
            rollback_patch_dir: res.rollback_patch_dir,
          })
          state.status = 'waiting_human'
          writeJsonAtomic(PATHS.state, state)
          return
        }

        const maxFiles = state.config?.safety?.largeDiff?.maxFiles ?? 8
        const maxLines = state.config?.safety?.largeDiff?.maxLines ?? 300
        const stats = computeDiffStats(projectRoot)
        if (stats.hadBinary || stats.fileCount > maxFiles || stats.totalLines > maxLines) {
          if (!state.flags?.allowLargeDiffOnce) {
            block(
              'Large diff guardrail (review required)',
              `node -e "const fs=require('fs');const p='${PATHS.state.replace(/'/g, "\\'")}';const s=JSON.parse(fs.readFileSync(p,'utf8'));s.flags=s.flags||{};s.flags.allowLargeDiffOnce=true;fs.writeFileSync(p,JSON.stringify(s,null,2));"`,
              { diffstat: getDiffStatText(projectRoot) }
            )
            state.status = 'waiting_human'
            writeJsonAtomic(PATHS.state, state)
            return
          }
          state.flags = state.flags ?? {}
          state.flags.allowLargeDiffOnce = false
          writeJsonAtomic(PATHS.state, state)
        }

        if (!runCommandGroup(projectRoot, runHistoryDir, 'invariants', RUNNER_INVARIANT_VERIFY, state.config.verifyTimeout, log)) {
          rollbackToLkg(state, projectRoot, runHistoryDir, 'invariant-verify-failed')
          report.status = 'failed'
          report.error = 'Runner invariants failed (git diff --check)'
          writeJsonAtomic(PATHS.report, report)
          await runOrchestrator(report)
          return
        }

        if (!runCommandGroup(projectRoot, runHistoryDir, 'verify', state.config.verifyCommands, state.config.verifyTimeout, log)) {
          rollbackToLkg(state, projectRoot, runHistoryDir, 'verify-commands-failed')
          report.status = 'failed'
          report.error = 'Verification commands failed after task completion'
          writeJsonAtomic(PATHS.report, report)
          await runOrchestrator(report)
          return
        }

        try {
          sh('git add -A', projectRoot)
          const status = sh('git status --porcelain', projectRoot).trim()
          if (status) {
            sh(`git commit -m "pilot: ${report.task_id}"`, projectRoot)
          }
        } catch {
          // commit failures are non-fatal; orchestration still proceeds
        }
        state.git.lkg = (() => {
          try { return sh('git rev-parse HEAD', projectRoot).trim() } catch { return state.git.lkg }
        })()
        state.retry_count = 0
        state.last_completed_task = report.task_id
        writeJsonAtomic(PATHS.state, state)

        updateRecentOnCommit(projectRoot, PATHS.recent, report.task_id, task.title, report.summary, state.git.lkg)
        await runOrchestrator(report)
        return
      }

      if (report.status === 'failed' || report.status === 'timeout') {
        const res = enforceScopeAndForbidden(task, state, projectRoot, workspaceDir, runHistoryDir)
        if (!res.ok) {
          block('Scope/forbidden violation', 'Review changed files and adjust scope', {
            violations: res.violations ?? [],
            rollback_patch_dir: res.rollback_patch_dir,
          })
          state.status = 'waiting_human'
          writeJsonAtomic(PATHS.state, state)
          return
        }

        rollbackToLkg(state, projectRoot, runHistoryDir, 'report-failed-or-timeout')
        await runOrchestrator(report)
        return
      }

      if (report.status === 'blocked') {
        await runOrchestrator(report)
        return
      }
    } finally {
      busy = false
    }
  }

  const watchdog = () => {
    state = readJson<State>(PATHS.state) ?? state
    if (state.status !== 'active') return
    if (!state.task_started_at) return
    const elapsed = Date.now() - state.task_started_at
    const timeout = state.config.watchdogTimeout
    if (elapsed > timeout && !fs.existsSync(PATHS.report)) {
      writeJsonAtomic(PATHS.report, {
        task_id: state.current_task,
        status: 'timeout',
        summary: ['Watchdog: no report received within timeout'],
        error: `No REPORT.json after ${timeout / 1000}s`,
        partial_progress: 'Unknown - builder may have crashed or hung',
        files_changed: [],
        questions: [],
      })
    }
  }

  if (runOnce) {
    await handleTask()
    if (fs.existsSync(PATHS.report)) await handleReport()
    return
  }

  watch(workspaceDir, {
    ignoreInitial: true,
    ignored: /(overrides|history|\.backup|\.tmp|run\.log|CONTEXT\.json|RECENT\.json)/,
  }).on('all', (event, filepath) => {
    if (event === 'unlink') return
    const file = path.basename(filepath)
    if (file === 'TASK.json') setTimeout(handleTask, 300)
    if (file === 'REPORT.json') setTimeout(handleReport, 300)
    if (file === 'BLOCKED.json' && event === 'add') {
      const b = readJson<any>(PATHS.blocked)
      if (b?.reason) log(`🛑 BLOCKED: ${b.reason}`)
    }
  })

  setInterval(watchdog, 60000)
  setTimeout(handleTask, 1200)
}
