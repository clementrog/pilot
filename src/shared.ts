import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'

export function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true })
}

export function readJson<T>(p: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return null
  }
}

export function writeJsonAtomic(p: string, data: unknown) {
  ensureDir(path.dirname(p))
  const tmp = `${p}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
  fs.renameSync(tmp, p)
}

export function writeTextAtomic(p: string, content: string) {
  ensureDir(path.dirname(p))
  const tmp = `${p}.tmp`
  fs.writeFileSync(tmp, content)
  fs.renameSync(tmp, p)
}

export function tsCompact(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

export function tsMinute(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

export function randomId(len = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export function truncate(s: string, max = 400): string {
  if (s.length <= max) return s
  return s.slice(0, Math.max(0, max - 3)) + '...'
}

export function parseSemverCore(v: string): [number, number, number] {
  const core = (v || '').split('-')[0]
  const parts = core.split('.')
  const a = Number(parts[0] || 0)
  const b = Number(parts[1] || 0)
  const c = Number(parts[2] || 0)
  return [Number.isFinite(a) ? a : 0, Number.isFinite(b) ? b : 0, Number.isFinite(c) ? c : 0]
}

export function semverLt(a: string, b: string): boolean {
  const [am, an, ap] = parseSemverCore(a)
  const [bm, bn, bp] = parseSemverCore(b)
  if (am !== bm) return am < bm
  if (an !== bn) return an < bn
  return ap < bp
}

export function sh(cmd: string, cwd: string, opts?: { timeout?: number; stdio?: any; encoding?: BufferEncoding }): string {
  return execSync(cmd, {
    cwd,
    timeout: opts?.timeout,
    stdio: opts?.stdio ?? 'pipe',
    encoding: opts?.encoding ?? 'utf8',
    shell: '/bin/bash',
  }) as unknown as string
}
