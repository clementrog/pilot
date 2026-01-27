import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { fileURLToPath } from 'url'
import { runPilot } from './runner.js'
import { ensureDir, readJson, writeJsonAtomic, writeTextAtomic, semverLt, tsCompact, sh } from './shared.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ENGINE_DIR = path.resolve(__dirname, '..')
const TEMPLATES_DIR = path.join(ENGINE_DIR, 'templates')

type Manifest = {
  pilotFolderVersion: string
  stateSchemaVersion: number
  managedFiles: string[]
  hashes: Record<string, string>
}

type State = {
  project: string
  status: 'active' | 'waiting_human' | 'complete'
  current_task: string | null
  retry_count: number
  last_completed_task: string | null
  task_started_at: number | null
  flags?: { allowLargeDiffOnce?: boolean }
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
    capabilities?: { promptTransport?: 'prompt-file' | 'stdin' | 'file-attachment' }
    safety?: {
      largeDiff?: { maxFiles?: number; maxLines?: number }
      cleanUntrackedOnRollback?: boolean
    }
  }
  git: { lkg: string | null }
}

function usage(): never {
  process.stderr.write(
    [
      'pilot <command>',
      '',
      'Commands:',
      '  init            create ./pilot workspace (if missing)',
      '  upgrade         migrate ./pilot schema + managed files',
      '  doctor          check prerequisites; writes pilot/BLOCKED.json on failure',
      '  run             start daemon loop',
      '  run --once      run one deterministic cycle and exit',
      '',
      'Options:',
      '  --workspace <dir>   default: pilot',
      '',
    ].join('\n')
  )
  process.exit(1)
}

function getArg(args: string[], name: string): string | null {
  const idx = args.indexOf(name)
  if (idx === -1) return null
  return args[idx + 1] ?? null
}

function hasArg(args: string[], name: string): boolean {
  return args.includes(name)
}

function sha256(p: string): string {
  const b = fs.readFileSync(p)
  return crypto.createHash('sha256').update(b).digest('hex')
}

function workspaceDirFromArgs(args: string[]): string {
  const ws = getArg(args, '--workspace') || process.env.PILOT_WORKSPACE || 'pilot'
  return path.resolve(process.cwd(), ws)
}

function writeBlocked(workspaceDir: string, reason: string, action: string) {
  writeJsonAtomic(path.join(workspaceDir, 'BLOCKED.json'), { reason, action })
}

function migrateStateToSchema2(state: any): State {
  const base = state && typeof state === 'object' ? state : {}

  const s: State = {
    project: typeof base.project === 'string' ? base.project : 'my-app',
    status: base.status === 'waiting_human' || base.status === 'complete' ? base.status : 'active',
    current_task: typeof base.current_task === 'string' ? base.current_task : null,
    retry_count: typeof base.retry_count === 'number' ? base.retry_count : 0,
    last_completed_task: typeof base.last_completed_task === 'string' ? base.last_completed_task : null,
    task_started_at: typeof base.task_started_at === 'number' ? base.task_started_at : null,
    flags: {
      allowLargeDiffOnce: typeof base.flags?.allowLargeDiffOnce === 'boolean' ? base.flags.allowLargeDiffOnce : false,
    },
    config: {
      orchestratorModel: typeof base.config?.orchestratorModel === 'string' ? base.config.orchestratorModel : '',
      builderTimeout: typeof base.config?.builderTimeout === 'number' ? base.config.builderTimeout : 300000,
      orchestratorTimeout: typeof base.config?.orchestratorTimeout === 'number' ? base.config.orchestratorTimeout : 120000,
      verifyTimeout: typeof base.config?.verifyTimeout === 'number' ? base.config.verifyTimeout : 60000,
      watchdogTimeout: typeof base.config?.watchdogTimeout === 'number' ? base.config.watchdogTimeout : 600000,
      verifyCommands: Array.isArray(base.config?.verifyCommands) ? base.config.verifyCommands : [],
      tools: {
        builder: (base.config?.tools?.builder as any) === 'cursor' ? 'cursor' : 'cursor',
        cursor: { mode: base.config?.tools?.cursor?.mode === 'stdin' ? 'stdin' : 'prompt-file' },
        opencode: {
          mode: 'file-attachment',
          format: base.config?.tools?.opencode?.format === 'json' ? 'json' : 'default',
        },
      },
      capabilities: {
        promptTransport: 'file-attachment',
      },
      safety: {
        largeDiff: {
          maxFiles: typeof base.config?.safety?.largeDiff?.maxFiles === 'number' ? base.config.safety.largeDiff.maxFiles : 8,
          maxLines: typeof base.config?.safety?.largeDiff?.maxLines === 'number' ? base.config.safety.largeDiff.maxLines : 300,
        },
        cleanUntrackedOnRollback:
          typeof base.config?.safety?.cleanUntrackedOnRollback === 'boolean' ? base.config.safety.cleanUntrackedOnRollback : true,
      },
    },
    git: {
      lkg: typeof base.git?.lkg === 'string' ? base.git.lkg : null,
    },
  }

  return s
}

function copyManagedFile(templateRel: string, workspaceDir: string, backupDir: string, current: Manifest | null, expected: Manifest): { conflict: boolean } {
  const src = path.join(TEMPLATES_DIR, templateRel)
  const dest = path.join(workspaceDir, templateRel)
  ensureDir(path.dirname(dest))

  if (fs.existsSync(dest)) {
    const backupPath = path.join(backupDir, templateRel)
    ensureDir(path.dirname(backupPath))
    fs.copyFileSync(dest, backupPath)
  }

  const destExists = fs.existsSync(dest)
  const destHash = destExists ? sha256(dest) : null
  const recorded = current?.hashes?.[templateRel]
  const templateHash = expected.hashes?.[templateRel]

  const looksUserEdited =
    destExists && ((recorded && destHash !== recorded) || (!recorded && templateHash && destHash !== templateHash))

  if (looksUserEdited) {
    const newPath = `${dest}.new`
    ensureDir(path.dirname(newPath))
    fs.copyFileSync(src, `${newPath}.tmp`)
    fs.renameSync(`${newPath}.tmp`, newPath)
    return { conflict: true }
  }

  fs.copyFileSync(src, `${dest}.tmp`)
  fs.renameSync(`${dest}.tmp`, dest)
  return { conflict: false }
}

function initWorkspace(workspaceDir: string) {
  ensureDir(workspaceDir)
  ensureDir(path.join(workspaceDir, 'overrides', 'prompts'))

  const expected = readJson<Manifest>(path.join(TEMPLATES_DIR, 'MANIFEST.json'))
  if (!expected) throw new Error('Missing templates/MANIFEST.json')

  // Managed runtime files
  for (const rel of expected.managedFiles) {
    const dest = path.join(workspaceDir, rel)
    if (!fs.existsSync(dest)) {
      const src = path.join(TEMPLATES_DIR, rel)
      ensureDir(path.dirname(dest))
      fs.copyFileSync(src, `${dest}.tmp`)
      fs.renameSync(`${dest}.tmp`, dest)
    }
  }

  // User-owned stubs
  const statePath = path.join(workspaceDir, 'STATE.json')
  if (!fs.existsSync(statePath)) {
    const s: State = migrateStateToSchema2({
      project: path.basename(process.cwd()),
      status: 'active',
      current_task: null,
      retry_count: 0,
      last_completed_task: null,
      task_started_at: null,
      config: {
        orchestratorModel: '',
        builderTimeout: 300000,
        orchestratorTimeout: 120000,
        verifyTimeout: 60000,
        watchdogTimeout: 600000,
        verifyCommands: [],
        tools: { builder: 'cursor', cursor: { mode: 'prompt-file' }, opencode: { mode: 'file-attachment', format: 'default' } },
        capabilities: { promptTransport: 'file-attachment' },
        safety: { largeDiff: { maxFiles: 8, maxLines: 300 }, cleanUntrackedOnRollback: true },
      },
      git: { lkg: null },
    })
    writeJsonAtomic(statePath, s)
  }

  const roadmapPath = path.join(workspaceDir, 'ROADMAP.json')
  if (!fs.existsSync(roadmapPath)) {
    writeJsonAtomic(roadmapPath, [])
  }

  const manifestPath = path.join(workspaceDir, 'MANIFEST.json')
  if (!fs.existsSync(manifestPath)) {
    writeJsonAtomic(manifestPath, expected)
  }
}

function upgradeWorkspace(workspaceDir: string) {
  const expected = readJson<Manifest>(path.join(TEMPLATES_DIR, 'MANIFEST.json'))
  if (!expected) throw new Error('Missing templates/MANIFEST.json')

  const current = readJson<Manifest>(path.join(workspaceDir, 'MANIFEST.json'))
  const backupDir = path.join(workspaceDir, '.backup', tsCompact())
  ensureDir(backupDir)

  const conflicts: string[] = []

  for (const rel of expected.managedFiles) {
    const res = copyManagedFile(rel, workspaceDir, backupDir, current, expected)
    if (res.conflict) conflicts.push(rel)
  }

  const statePath = path.join(workspaceDir, 'STATE.json')
  if (fs.existsSync(statePath)) {
    const raw = readJson<any>(statePath)
    const migrated = migrateStateToSchema2(raw)
    fs.copyFileSync(statePath, path.join(backupDir, 'STATE.json'))
    writeJsonAtomic(statePath, migrated)
  }

  // Always update manifest last
  writeJsonAtomic(path.join(workspaceDir, 'MANIFEST.json'), expected)

  if (conflicts.length > 0) {
    writeBlocked(workspaceDir, 'Upgrade wrote *.new files (local edits detected)', 'ls pilot/**/*.new 2>/dev/null || true')
    process.exitCode = 2
  } else {
    process.stdout.write('pilot upgrade: ok\n')
  }
}

function doctor(workspaceDir: string): number {
  // Deterministic checks, one fix command.
  const toolCwd = fs.existsSync(workspaceDir) ? workspaceDir : process.cwd()
  try {
    sh('git rev-parse --is-inside-work-tree', process.cwd())
  } catch {
    writeBlocked(workspaceDir, 'Not a git repository', 'git init')
    return 2
  }
  try {
    sh('git rev-parse HEAD', process.cwd())
  } catch {
    writeBlocked(workspaceDir, 'No commits yet (needed for rollback/LKG)', 'git commit --allow-empty -m "pilot: init"')
    return 2
  }
  const cursorBin = (process.env.PILOT_CURSOR_BIN || '').trim() || 'cursor-agent'
  const opencodeBin = (process.env.PILOT_OPENCODE_BIN || '').trim() || 'opencode'

  try {
    if (opencodeBin.includes('/')) sh(`test -x "${opencodeBin.replace(/"/g, '')}"`, toolCwd)
    else sh(`command -v ${opencodeBin}`, toolCwd)
  } catch {
    writeBlocked(
      workspaceDir,
      `${opencodeBin} not found`,
      'Install OpenCode CLI (opencode) from https://opencode.ai/install, then rerun: pilot doctor'
    )
    return 2
  }
  try {
    if (cursorBin.includes('/')) sh(`test -x "${cursorBin.replace(/"/g, '')}"`, toolCwd)
    else sh(`command -v ${cursorBin}`, toolCwd)
  } catch {
    if (cursorBin === 'cursor-agent') {
      writeBlocked(
        workspaceDir,
        'cursor-agent not found',
        'Install Cursor Agent CLI (cursor-agent) from https://cursor.com/install OR set PILOT_CURSOR_BIN to a custom builder command, then rerun: pilot doctor'
      )
    } else {
      writeBlocked(
        workspaceDir,
        `${cursorBin} not found`,
        'Install Cursor Agent CLI (cursor-agent) from https://cursor.com/install OR set PILOT_CURSOR_BIN to a custom builder command, then rerun: pilot doctor'
      )
    }
    return 2
  }

  const statePath = path.join(workspaceDir, 'STATE.json')
  const state = readJson<any>(statePath)
  const cmds = Array.isArray(state?.config?.verifyCommands) ? state.config.verifyCommands : []
  for (const cmd of cmds) {
    const bin = String(cmd).trim().split(/\s+/)[0]
    if (!bin) continue
    try {
      sh(`command -v ${bin}`, process.cwd())
    } catch {
      const fix =
        bin === 'pnpm'
          ? 'npm i -g pnpm'
          : bin === 'yarn'
            ? 'npm i -g yarn'
            : bin === 'bun'
              ? 'curl -fsSL https://bun.sh/install | bash'
              : `brew install ${bin}`
      writeBlocked(workspaceDir, `Missing verify tool: ${bin}`, fix)
      return 2
    }
  }

  const expected = readJson<Manifest>(path.join(TEMPLATES_DIR, 'MANIFEST.json'))
  const current = readJson<Manifest>(path.join(workspaceDir, 'MANIFEST.json'))
  if (expected && current && semverLt(current.pilotFolderVersion, expected.pilotFolderVersion)) {
    writeBlocked(workspaceDir, `Pilot workspace out of date (${current.pilotFolderVersion} < ${expected.pilotFolderVersion})`, 'pilot upgrade')
    return 2
  }

  process.stdout.write('pilot doctor: ok\n')
  return 0
}

async function main() {
  const args = process.argv.slice(2)
  const cmd = args[0]
  if (!cmd) usage()

  const workspaceDir = workspaceDirFromArgs(args)

  if (cmd === 'init') {
    initWorkspace(workspaceDir)
    process.stdout.write(`pilot init: ok (${path.relative(process.cwd(), workspaceDir)})\n`)
    return
  }

  if (cmd === 'upgrade') {
    upgradeWorkspace(workspaceDir)
    return
  }

  if (cmd === 'doctor') {
    process.exit(doctor(workspaceDir))
  }

  if (cmd === 'run') {
    const once = hasArg(args, '--once')
    await runPilot({ workspaceDir, runOnce: once })
    return
  }

  usage()
}

main().catch(err => {
  process.stderr.write(String(err?.stack || err?.message || err) + '\n')
  process.exit(1)
})
