

---
# FILE: .gitignore
---

     1	# OS
     2	.DS_Store
     3	__MACOSX/
     4	
     5	# Dependencies
     6	node_modules/
     7	
     8	# Environment
     9	.env
    10	.env.*
    11	
    12	# Secrets
    13	*.pem
    14	*.key
    15	*.secret
    16	
    17	# Build
    18	.next/
    19	dist/
    20	build/
    21	
    22	# Local smoke sandboxes
    23	sandbox/
    24	
    25	
    26	# local build artifacts
    27	.tmp/
    28	pilot-engine-*.tgz


---
# FILE: README.md
---

     1	# Pilot Engine
     2	
     3	Pilot is an autonomous build loop engine.
     4	
     5	Engine lives in the npm package (runner + CLI + templates). Each repo keeps a small `pilot/` runtime workspace (mostly user data).
     6	
     7	## Nested workspace (recommended)
     8	
     9	For a cleaner repo root, use `--workspace .pilot`:
    10	
    11	```bash
    12	pnpm exec pilot init --workspace .pilot
    13	pnpm exec pilot run --workspace .pilot
    14	```
    15	
    16	This works inside existing git repos; all operational files (STATE, TASK, history, etc.) live under `.pilot/`.
    17	
    18	## Quick start
    19	
    20	```bash
    21	pnpm add -D pilot-engine
    22	
    23	# Create ./pilot workspace
    24	pnpm exec pilot init
    25	
    26	# Optional: sanity check
    27	pnpm exec pilot doctor
    28	
    29	# Run the loop
    30	pnpm exec pilot run
    31	
    32	# Or run one cycle
    33	pnpm exec pilot run --once
    34	
    35	# Upgrade managed runtime files + migrate STATE schema
    36	pnpm exec pilot upgrade
    37	```
    38	
    39	## Workspace ownership
    40	
    41	Never overwritten by upgrades:
    42	- `pilot/ROADMAP.json`
    43	- `pilot/TASK.json`
    44	- `pilot/REPORT.json`
    45	- `pilot/BLOCKED.json`
    46	
    47	Runner-owned (safe to ignore):
    48	- `pilot/CONTEXT.json`, `pilot/RECENT.json`, `pilot/run.log*`, `pilot/history/`, `pilot/.tmp/`, `pilot/.backup/`


---
# FILE: bin/create-pilot.js
---

     1	#!/usr/bin/env node
     2	
     3	import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
     4	import { join, dirname } from 'path';
     5	import { fileURLToPath } from 'url';
     6	
     7	const __filename = fileURLToPath(import.meta.url);
     8	const __dirname = dirname(__filename);
     9	const PACKAGE_ROOT = join(__dirname, '..');
    10	
    11	// Parse args
    12	const args = process.argv.slice(2);
    13	const force = args.includes('--force') || args.includes('-f');
    14	const help = args.includes('--help') || args.includes('-h');
    15	const prdArg = args.find(a => !a.startsWith('-'));
    16	
    17	if (help) {
    18	  console.log(`
    19	create-pilot - Scaffold Pilot protocol into your project
    20	
    21	Usage:
    22	  npx create-pilot              # scaffold only
    23	  npx create-pilot ./prd.md     # scaffold + copy PRD
    24	  npx create-pilot -            # scaffold + read PRD from stdin
    25	  npx create-pilot --force      # overwrite existing pilot/
    26	
    27	Options:
    28	  -f, --force   Overwrite existing pilot/ directory
    29	  -h, --help    Show this help message
    30	`);
    31	  process.exit(0);
    32	}
    33	
    34	const targetDir = process.cwd();
    35	
    36	// Check for existing pilot/
    37	if (existsSync(join(targetDir, 'pilot')) && !force) {
    38	  console.error('Error: pilot/ already exists. Use --force to overwrite.');
    39	  process.exit(1);
    40	}
    41	
    42	// Copy directory recursively
    43	function copyDir(src, dest) {
    44	  mkdirSync(dest, { recursive: true });
    45	  for (const entry of readdirSync(src)) {
    46	    const srcPath = join(src, entry);
    47	    const destPath = join(dest, entry);
    48	    if (statSync(srcPath).isDirectory()) {
    49	      copyDir(srcPath, destPath);
    50	    } else {
    51	      copyFileSync(srcPath, destPath);
    52	    }
    53	  }
    54	}
    55	
    56	// Scaffold
    57	console.log('Scaffolding Pilot protocol...\n');
    58	
    59	// Copy pilot/
    60	copyDir(join(PACKAGE_ROOT, 'pilot'), join(targetDir, 'pilot'));
    61	console.log('✓ Created pilot/');
    62	
    63	// Copy prd/
    64	copyDir(join(PACKAGE_ROOT, 'prd'), join(targetDir, 'prd'));
    65	console.log('✓ Created prd/');
    66	
    67	// Copy root files
    68	copyFileSync(join(PACKAGE_ROOT, 'ORCHESTRATOR.md'), join(targetDir, 'ORCHESTRATOR.md'));
    69	console.log('✓ Added ORCHESTRATOR.md');
    70	
    71	copyFileSync(join(PACKAGE_ROOT, 'BOOT.txt'), join(targetDir, 'BOOT.txt'));
    72	console.log('✓ Added BOOT.txt');
    73	
    74	copyFileSync(join(PACKAGE_ROOT, 'cursorrules'), join(targetDir, '.cursorrules'));
    75	console.log('✓ Added .cursorrules');
    76	
    77	copyFileSync(join(PACKAGE_ROOT, 'claude-md'), join(targetDir, 'claude.md'));
    78	console.log('✓ Added claude.md');
    79	
    80	// Handle PRD input
    81	async function handlePrd() {
    82	  let prdContent = null;
    83	
    84	  if (prdArg === '-') {
    85	    prdContent = await readStdin();
    86	  } else if (prdArg && existsSync(prdArg)) {
    87	    prdContent = readFileSync(prdArg, 'utf-8');
    88	  }
    89	
    90	  if (prdContent) {
    91	    writeFileSync(join(targetDir, 'prd', 'input.md'), prdContent);
    92	    console.log('✓ Saved PRD to prd/input.md');
    93	  }
    94	
    95	  console.log('\n────────────────────────────────────');
    96	  console.log('Ready. Open your LLM and say:');
    97	  console.log('\n  Read BOOT.txt');
    98	  console.log('────────────────────────────────────\n');
    99	}
   100	
   101	function readStdin() {
   102	  return new Promise((resolve) => {
   103	    if (process.stdin.isTTY) {
   104	      resolve(null);
   105	      return;
   106	    }
   107	    let data = '';
   108	    process.stdin.setEncoding('utf-8');
   109	    process.stdin.on('data', chunk => data += chunk);
   110	    process.stdin.on('end', () => resolve(data));
   111	  });
   112	}
   113	
   114	handlePrd();


---
# FILE: package.json
---

     1	{
     2	  "name": "pilot-engine",
     3	  "version": "1.3.1-delta.2",
     4	  "description": "Pilot: autonomous build loop engine (runner + CLI + templates)",
     5	  "type": "module",
     6	  "bin": {
     7	    "pilot": "dist/cli.js"
     8	  },
     9	  "files": [
    10	    "dist/",
    11	    "templates/"
    12	  ],
    13	  "scripts": {
    14	    "build": "tsc -p tsconfig.json",
    15	    "dev": "tsx src/cli.ts",
    16	    "pilot": "node dist/cli.js",
    17	    "lint": "node -e \"process.exit(0)\"",
    18	    "polish:smoke": "bash scripts/polish-smoke.sh"
    19	  },
    20	  "dependencies": {
    21	    "chokidar": "^4.0.3"
    22	  },
    23	  "devDependencies": {
    24	    "@types/node": "^22.19.7",
    25	    "tsx": "^4.21.0",
    26	    "typescript": "^5.9.3"
    27	  }
    28	}


---
# FILE: pnpm-lock.yaml
---

     1	lockfileVersion: '9.0'
     2	
     3	settings:
     4	  autoInstallPeers: true
     5	  excludeLinksFromLockfile: false
     6	
     7	importers:
     8	
     9	  .:
    10	    dependencies:
    11	      chokidar:
    12	        specifier: ^4.0.3
    13	        version: 4.0.3
    14	    devDependencies:
    15	      '@types/node':
    16	        specifier: ^22.19.7
    17	        version: 22.19.7
    18	      tsx:
    19	        specifier: ^4.21.0
    20	        version: 4.21.0
    21	      typescript:
    22	        specifier: ^5.9.3
    23	        version: 5.9.3
    24	
    25	packages:
    26	
    27	  '@esbuild/aix-ppc64@0.27.2':
    28	    resolution: {integrity: sha512-GZMB+a0mOMZs4MpDbj8RJp4cw+w1WV5NYD6xzgvzUJ5Ek2jerwfO2eADyI6ExDSUED+1X8aMbegahsJi+8mgpw==}
    29	    engines: {node: '>=18'}
    30	    cpu: [ppc64]
    31	    os: [aix]
    32	
    33	  '@esbuild/android-arm64@0.27.2':
    34	    resolution: {integrity: sha512-pvz8ZZ7ot/RBphf8fv60ljmaoydPU12VuXHImtAs0XhLLw+EXBi2BLe3OYSBslR4rryHvweW5gmkKFwTiFy6KA==}
    35	    engines: {node: '>=18'}
    36	    cpu: [arm64]
    37	    os: [android]
    38	
    39	  '@esbuild/android-arm@0.27.2':
    40	    resolution: {integrity: sha512-DVNI8jlPa7Ujbr1yjU2PfUSRtAUZPG9I1RwW4F4xFB1Imiu2on0ADiI/c3td+KmDtVKNbi+nffGDQMfcIMkwIA==}
    41	    engines: {node: '>=18'}
    42	    cpu: [arm]
    43	    os: [android]
    44	
    45	  '@esbuild/android-x64@0.27.2':
    46	    resolution: {integrity: sha512-z8Ank4Byh4TJJOh4wpz8g2vDy75zFL0TlZlkUkEwYXuPSgX8yzep596n6mT7905kA9uHZsf/o2OJZubl2l3M7A==}
    47	    engines: {node: '>=18'}
    48	    cpu: [x64]
    49	    os: [android]
    50	
    51	  '@esbuild/darwin-arm64@0.27.2':
    52	    resolution: {integrity: sha512-davCD2Zc80nzDVRwXTcQP/28fiJbcOwvdolL0sOiOsbwBa72kegmVU0Wrh1MYrbuCL98Omp5dVhQFWRKR2ZAlg==}
    53	    engines: {node: '>=18'}
    54	    cpu: [arm64]
    55	    os: [darwin]
    56	
    57	  '@esbuild/darwin-x64@0.27.2':
    58	    resolution: {integrity: sha512-ZxtijOmlQCBWGwbVmwOF/UCzuGIbUkqB1faQRf5akQmxRJ1ujusWsb3CVfk/9iZKr2L5SMU5wPBi1UWbvL+VQA==}
    59	    engines: {node: '>=18'}
    60	    cpu: [x64]
    61	    os: [darwin]
    62	
    63	  '@esbuild/freebsd-arm64@0.27.2':
    64	    resolution: {integrity: sha512-lS/9CN+rgqQ9czogxlMcBMGd+l8Q3Nj1MFQwBZJyoEKI50XGxwuzznYdwcav6lpOGv5BqaZXqvBSiB/kJ5op+g==}
    65	    engines: {node: '>=18'}
    66	    cpu: [arm64]
    67	    os: [freebsd]
    68	
    69	  '@esbuild/freebsd-x64@0.27.2':
    70	    resolution: {integrity: sha512-tAfqtNYb4YgPnJlEFu4c212HYjQWSO/w/h/lQaBK7RbwGIkBOuNKQI9tqWzx7Wtp7bTPaGC6MJvWI608P3wXYA==}
    71	    engines: {node: '>=18'}
    72	    cpu: [x64]
    73	    os: [freebsd]
    74	
    75	  '@esbuild/linux-arm64@0.27.2':
    76	    resolution: {integrity: sha512-hYxN8pr66NsCCiRFkHUAsxylNOcAQaxSSkHMMjcpx0si13t1LHFphxJZUiGwojB1a/Hd5OiPIqDdXONia6bhTw==}
    77	    engines: {node: '>=18'}
    78	    cpu: [arm64]
    79	    os: [linux]
    80	
    81	  '@esbuild/linux-arm@0.27.2':
    82	    resolution: {integrity: sha512-vWfq4GaIMP9AIe4yj1ZUW18RDhx6EPQKjwe7n8BbIecFtCQG4CfHGaHuh7fdfq+y3LIA2vGS/o9ZBGVxIDi9hw==}
    83	    engines: {node: '>=18'}
    84	    cpu: [arm]
    85	    os: [linux]
    86	
    87	  '@esbuild/linux-ia32@0.27.2':
    88	    resolution: {integrity: sha512-MJt5BRRSScPDwG2hLelYhAAKh9imjHK5+NE/tvnRLbIqUWa+0E9N4WNMjmp/kXXPHZGqPLxggwVhz7QP8CTR8w==}
    89	    engines: {node: '>=18'}
    90	    cpu: [ia32]
    91	    os: [linux]
    92	
    93	  '@esbuild/linux-loong64@0.27.2':
    94	    resolution: {integrity: sha512-lugyF1atnAT463aO6KPshVCJK5NgRnU4yb3FUumyVz+cGvZbontBgzeGFO1nF+dPueHD367a2ZXe1NtUkAjOtg==}
    95	    engines: {node: '>=18'}
    96	    cpu: [loong64]
    97	    os: [linux]
    98	
    99	  '@esbuild/linux-mips64el@0.27.2':
   100	    resolution: {integrity: sha512-nlP2I6ArEBewvJ2gjrrkESEZkB5mIoaTswuqNFRv/WYd+ATtUpe9Y09RnJvgvdag7he0OWgEZWhviS1OTOKixw==}
   101	    engines: {node: '>=18'}
   102	    cpu: [mips64el]
   103	    os: [linux]
   104	
   105	  '@esbuild/linux-ppc64@0.27.2':
   106	    resolution: {integrity: sha512-C92gnpey7tUQONqg1n6dKVbx3vphKtTHJaNG2Ok9lGwbZil6DrfyecMsp9CrmXGQJmZ7iiVXvvZH6Ml5hL6XdQ==}
   107	    engines: {node: '>=18'}
   108	    cpu: [ppc64]
   109	    os: [linux]
   110	
   111	  '@esbuild/linux-riscv64@0.27.2':
   112	    resolution: {integrity: sha512-B5BOmojNtUyN8AXlK0QJyvjEZkWwy/FKvakkTDCziX95AowLZKR6aCDhG7LeF7uMCXEJqwa8Bejz5LTPYm8AvA==}
   113	    engines: {node: '>=18'}
   114	    cpu: [riscv64]
   115	    os: [linux]
   116	
   117	  '@esbuild/linux-s390x@0.27.2':
   118	    resolution: {integrity: sha512-p4bm9+wsPwup5Z8f4EpfN63qNagQ47Ua2znaqGH6bqLlmJ4bx97Y9JdqxgGZ6Y8xVTixUnEkoKSHcpRlDnNr5w==}
   119	    engines: {node: '>=18'}
   120	    cpu: [s390x]
   121	    os: [linux]
   122	
   123	  '@esbuild/linux-x64@0.27.2':
   124	    resolution: {integrity: sha512-uwp2Tip5aPmH+NRUwTcfLb+W32WXjpFejTIOWZFw/v7/KnpCDKG66u4DLcurQpiYTiYwQ9B7KOeMJvLCu/OvbA==}
   125	    engines: {node: '>=18'}
   126	    cpu: [x64]
   127	    os: [linux]
   128	
   129	  '@esbuild/netbsd-arm64@0.27.2':
   130	    resolution: {integrity: sha512-Kj6DiBlwXrPsCRDeRvGAUb/LNrBASrfqAIok+xB0LxK8CHqxZ037viF13ugfsIpePH93mX7xfJp97cyDuTZ3cw==}
   131	    engines: {node: '>=18'}
   132	    cpu: [arm64]
   133	    os: [netbsd]
   134	
   135	  '@esbuild/netbsd-x64@0.27.2':
   136	    resolution: {integrity: sha512-HwGDZ0VLVBY3Y+Nw0JexZy9o/nUAWq9MlV7cahpaXKW6TOzfVno3y3/M8Ga8u8Yr7GldLOov27xiCnqRZf0tCA==}
   137	    engines: {node: '>=18'}
   138	    cpu: [x64]
   139	    os: [netbsd]
   140	
   141	  '@esbuild/openbsd-arm64@0.27.2':
   142	    resolution: {integrity: sha512-DNIHH2BPQ5551A7oSHD0CKbwIA/Ox7+78/AWkbS5QoRzaqlev2uFayfSxq68EkonB+IKjiuxBFoV8ESJy8bOHA==}
   143	    engines: {node: '>=18'}
   144	    cpu: [arm64]
   145	    os: [openbsd]
   146	
   147	  '@esbuild/openbsd-x64@0.27.2':
   148	    resolution: {integrity: sha512-/it7w9Nb7+0KFIzjalNJVR5bOzA9Vay+yIPLVHfIQYG/j+j9VTH84aNB8ExGKPU4AzfaEvN9/V4HV+F+vo8OEg==}
   149	    engines: {node: '>=18'}
   150	    cpu: [x64]
   151	    os: [openbsd]
   152	
   153	  '@esbuild/openharmony-arm64@0.27.2':
   154	    resolution: {integrity: sha512-LRBbCmiU51IXfeXk59csuX/aSaToeG7w48nMwA6049Y4J4+VbWALAuXcs+qcD04rHDuSCSRKdmY63sruDS5qag==}
   155	    engines: {node: '>=18'}
   156	    cpu: [arm64]
   157	    os: [openharmony]
   158	
   159	  '@esbuild/sunos-x64@0.27.2':
   160	    resolution: {integrity: sha512-kMtx1yqJHTmqaqHPAzKCAkDaKsffmXkPHThSfRwZGyuqyIeBvf08KSsYXl+abf5HDAPMJIPnbBfXvP2ZC2TfHg==}
   161	    engines: {node: '>=18'}
   162	    cpu: [x64]
   163	    os: [sunos]
   164	
   165	  '@esbuild/win32-arm64@0.27.2':
   166	    resolution: {integrity: sha512-Yaf78O/B3Kkh+nKABUF++bvJv5Ijoy9AN1ww904rOXZFLWVc5OLOfL56W+C8F9xn5JQZa3UX6m+IktJnIb1Jjg==}
   167	    engines: {node: '>=18'}
   168	    cpu: [arm64]
   169	    os: [win32]
   170	
   171	  '@esbuild/win32-ia32@0.27.2':
   172	    resolution: {integrity: sha512-Iuws0kxo4yusk7sw70Xa2E2imZU5HoixzxfGCdxwBdhiDgt9vX9VUCBhqcwY7/uh//78A1hMkkROMJq9l27oLQ==}
   173	    engines: {node: '>=18'}
   174	    cpu: [ia32]
   175	    os: [win32]
   176	
   177	  '@esbuild/win32-x64@0.27.2':
   178	    resolution: {integrity: sha512-sRdU18mcKf7F+YgheI/zGf5alZatMUTKj/jNS6l744f9u3WFu4v7twcUI9vu4mknF4Y9aDlblIie0IM+5xxaqQ==}
   179	    engines: {node: '>=18'}
   180	    cpu: [x64]
   181	    os: [win32]
   182	
   183	  '@types/node@22.19.7':
   184	    resolution: {integrity: sha512-MciR4AKGHWl7xwxkBa6xUGxQJ4VBOmPTF7sL+iGzuahOFaO0jHCsuEfS80pan1ef4gWId1oWOweIhrDEYLuaOw==}
   185	
   186	  chokidar@4.0.3:
   187	    resolution: {integrity: sha512-Qgzu8kfBvo+cA4962jnP1KkS6Dop5NS6g7R5LFYJr4b8Ub94PPQXUksCw9PvXoeXPRRddRNC5C1JQUR2SMGtnA==}
   188	    engines: {node: '>= 14.16.0'}
   189	
   190	  esbuild@0.27.2:
   191	    resolution: {integrity: sha512-HyNQImnsOC7X9PMNaCIeAm4ISCQXs5a5YasTXVliKv4uuBo1dKrG0A+uQS8M5eXjVMnLg3WgXaKvprHlFJQffw==}
   192	    engines: {node: '>=18'}
   193	    hasBin: true
   194	
   195	  fsevents@2.3.3:
   196	    resolution: {integrity: sha512-5xoDfX+fL7faATnagmWPpbFtwh/R77WmMMqqHGS65C3vvB0YHrgF+B1YmZ3441tMj5n63k0212XNoJwzlhffQw==}
   197	    engines: {node: ^8.16.0 || ^10.6.0 || >=11.0.0}
   198	    os: [darwin]
   199	
   200	  get-tsconfig@4.13.0:
   201	    resolution: {integrity: sha512-1VKTZJCwBrvbd+Wn3AOgQP/2Av+TfTCOlE4AcRJE72W1ksZXbAx8PPBR9RzgTeSPzlPMHrbANMH3LbltH73wxQ==}
   202	
   203	  readdirp@4.1.2:
   204	    resolution: {integrity: sha512-GDhwkLfywWL2s6vEjyhri+eXmfH6j1L7JE27WhqLeYzoh/A3DBaYGEj2H/HFZCn/kMfim73FXxEJTw06WtxQwg==}
   205	    engines: {node: '>= 14.18.0'}
   206	
   207	  resolve-pkg-maps@1.0.0:
   208	    resolution: {integrity: sha512-seS2Tj26TBVOC2NIc2rOe2y2ZO7efxITtLZcGSOnHHNOQ7CkiUBfw0Iw2ck6xkIhPwLhKNLS8BO+hEpngQlqzw==}
   209	
   210	  tsx@4.21.0:
   211	    resolution: {integrity: sha512-5C1sg4USs1lfG0GFb2RLXsdpXqBSEhAaA/0kPL01wxzpMqLILNxIxIOKiILz+cdg/pLnOUxFYOR5yhHU666wbw==}
   212	    engines: {node: '>=18.0.0'}
   213	    hasBin: true
   214	
   215	  typescript@5.9.3:
   216	    resolution: {integrity: sha512-jl1vZzPDinLr9eUt3J/t7V6FgNEw9QjvBPdysz9KfQDD41fQrC2Y4vKQdiaUpFT4bXlb1RHhLpp8wtm6M5TgSw==}
   217	    engines: {node: '>=14.17'}
   218	    hasBin: true
   219	
   220	  undici-types@6.21.0:
   221	    resolution: {integrity: sha512-iwDZqg0QAGrg9Rav5H4n0M64c3mkR59cJ6wQp+7C4nI0gsmExaedaYLNO44eT4AtBBwjbTiGPMlt2Md0T9H9JQ==}
   222	
   223	snapshots:
   224	
   225	  '@esbuild/aix-ppc64@0.27.2':
   226	    optional: true
   227	
   228	  '@esbuild/android-arm64@0.27.2':
   229	    optional: true
   230	
   231	  '@esbuild/android-arm@0.27.2':
   232	    optional: true
   233	
   234	  '@esbuild/android-x64@0.27.2':
   235	    optional: true
   236	
   237	  '@esbuild/darwin-arm64@0.27.2':
   238	    optional: true
   239	
   240	  '@esbuild/darwin-x64@0.27.2':
   241	    optional: true
   242	
   243	  '@esbuild/freebsd-arm64@0.27.2':
   244	    optional: true
   245	
   246	  '@esbuild/freebsd-x64@0.27.2':
   247	    optional: true
   248	
   249	  '@esbuild/linux-arm64@0.27.2':
   250	    optional: true
   251	
   252	  '@esbuild/linux-arm@0.27.2':
   253	    optional: true
   254	
   255	  '@esbuild/linux-ia32@0.27.2':
   256	    optional: true
   257	
   258	  '@esbuild/linux-loong64@0.27.2':
   259	    optional: true
   260	
   261	  '@esbuild/linux-mips64el@0.27.2':
   262	    optional: true
   263	
   264	  '@esbuild/linux-ppc64@0.27.2':
   265	    optional: true
   266	
   267	  '@esbuild/linux-riscv64@0.27.2':
   268	    optional: true
   269	
   270	  '@esbuild/linux-s390x@0.27.2':
   271	    optional: true
   272	
   273	  '@esbuild/linux-x64@0.27.2':
   274	    optional: true
   275	
   276	  '@esbuild/netbsd-arm64@0.27.2':
   277	    optional: true
   278	
   279	  '@esbuild/netbsd-x64@0.27.2':
   280	    optional: true
   281	
   282	  '@esbuild/openbsd-arm64@0.27.2':
   283	    optional: true
   284	
   285	  '@esbuild/openbsd-x64@0.27.2':
   286	    optional: true
   287	
   288	  '@esbuild/openharmony-arm64@0.27.2':
   289	    optional: true
   290	
   291	  '@esbuild/sunos-x64@0.27.2':
   292	    optional: true
   293	
   294	  '@esbuild/win32-arm64@0.27.2':
   295	    optional: true
   296	
   297	  '@esbuild/win32-ia32@0.27.2':
   298	    optional: true
   299	
   300	  '@esbuild/win32-x64@0.27.2':
   301	    optional: true
   302	
   303	  '@types/node@22.19.7':
   304	    dependencies:
   305	      undici-types: 6.21.0
   306	
   307	  chokidar@4.0.3:
   308	    dependencies:
   309	      readdirp: 4.1.2
   310	
   311	  esbuild@0.27.2:
   312	    optionalDependencies:
   313	      '@esbuild/aix-ppc64': 0.27.2
   314	      '@esbuild/android-arm': 0.27.2
   315	      '@esbuild/android-arm64': 0.27.2
   316	      '@esbuild/android-x64': 0.27.2
   317	      '@esbuild/darwin-arm64': 0.27.2
   318	      '@esbuild/darwin-x64': 0.27.2
   319	      '@esbuild/freebsd-arm64': 0.27.2
   320	      '@esbuild/freebsd-x64': 0.27.2
   321	      '@esbuild/linux-arm': 0.27.2
   322	      '@esbuild/linux-arm64': 0.27.2
   323	      '@esbuild/linux-ia32': 0.27.2
   324	      '@esbuild/linux-loong64': 0.27.2
   325	      '@esbuild/linux-mips64el': 0.27.2
   326	      '@esbuild/linux-ppc64': 0.27.2
   327	      '@esbuild/linux-riscv64': 0.27.2
   328	      '@esbuild/linux-s390x': 0.27.2
   329	      '@esbuild/linux-x64': 0.27.2
   330	      '@esbuild/netbsd-arm64': 0.27.2
   331	      '@esbuild/netbsd-x64': 0.27.2
   332	      '@esbuild/openbsd-arm64': 0.27.2
   333	      '@esbuild/openbsd-x64': 0.27.2
   334	      '@esbuild/openharmony-arm64': 0.27.2
   335	      '@esbuild/sunos-x64': 0.27.2
   336	      '@esbuild/win32-arm64': 0.27.2
   337	      '@esbuild/win32-ia32': 0.27.2
   338	      '@esbuild/win32-x64': 0.27.2
   339	
   340	  fsevents@2.3.3:
   341	    optional: true
   342	
   343	  get-tsconfig@4.13.0:
   344	    dependencies:
   345	      resolve-pkg-maps: 1.0.0
   346	
   347	  readdirp@4.1.2: {}
   348	
   349	  resolve-pkg-maps@1.0.0: {}
   350	
   351	  tsx@4.21.0:
   352	    dependencies:
   353	      esbuild: 0.27.2
   354	      get-tsconfig: 4.13.0
   355	    optionalDependencies:
   356	      fsevents: 2.3.3
   357	
   358	  typescript@5.9.3: {}
   359	
   360	  undici-types@6.21.0: {}


---
# FILE: scripts/polish-smoke.sh
---

     1	#!/usr/bin/env bash
     2	set -euo pipefail
     3	
     4	# Deterministic smoke test for pilot polish changes
     5	# Requirements: node, git (no external deps)
     6	
     7	ENGINE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
     8	SANDBOX="$ENGINE_DIR/sandbox/polish-ws2"
     9	
    10	echo "=== Polish Smoke Test ==="
    11	echo "Engine dir: $ENGINE_DIR"
    12	
    13	# 1) Clean sandbox
    14	rm -rf "$SANDBOX"
    15	mkdir -p "$SANDBOX"
    16	echo "[1/7] Created sandbox: $SANDBOX"
    17	
    18	# 2) Init workspace
    19	node "$ENGINE_DIR/dist/cli.js" init --workspace "$SANDBOX"
    20	echo "[2/7] Initialized workspace"
    21	
    22	# 3) Git init + commit baseline (NOT STATE/TASK) + enable allowDirtyWorkspace + create TASK
    23	cd "$SANDBOX"
    24	git init -q
    25	git config user.email "smoke@test.local"
    26	git config user.name "Smoke Test"
    27	git add .gitignore MANIFEST.json ROADMAP.json
    28	git commit -q -m "baseline"
    29	WS="$ENGINE_DIR/sandbox/polish-ws2"
    30	mkdir -p "$(dirname "$WS")"
    31	# Enable allowDirtyWorkspace so uncommitted STATE/TASK don't block (tests the P1 opt-in)
    32	node -e "const fs=require('fs'),p=process.argv[1],s=JSON.parse(fs.readFileSync(p,'utf8'));s.config=s.config||{};s.config.safety=s.config.safety||{};s.config.safety.allowDirtyWorkspace=true;fs.writeFileSync(p,JSON.stringify(s,null,2));" "$WS/STATE.json"
    33	# Create a simple TASK.json for the smoke test
    34	cat > TASK.json << 'TASK_EOF'
    35	{
    36	  "id": "smoke-task-001",
    37	  "status": "ready",
    38	  "title": "Create SMOKE.txt",
    39	  "description": "Create a file SMOKE.txt with content OK",
    40	  "scope": { "allowed": ["."], "forbidden": [] }
    41	}
    42	TASK_EOF
    43	echo "[3/7] Git baseline committed, allowDirtyWorkspace enabled, TASK created"
    44	
    45	# 4) Create mock cursor-agent
    46	mkdir -p tools
    47	cat > tools/mock-cursor-agent.sh << 'CURSOR_EOF'
    48	#!/usr/bin/env bash
    49	# Mock cursor-agent: writes SMOKE.txt and REPORT.json
    50	WS_DIR="$(pwd)"
    51	echo "OK" > "$WS_DIR/SMOKE.txt"
    52	# Extract task_id from TASK.json
    53	TASK_ID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$WS_DIR/TASK.json','utf8')).id)")
    54	cat > "$WS_DIR/REPORT.json" << EOF
    55	{
    56	  "task_id": "$TASK_ID",
    57	  "status": "done",
    58	  "summary": ["Created SMOKE.txt"],
    59	  "files_changed": ["SMOKE.txt"],
    60	  "questions": []
    61	}
    62	EOF
    63	CURSOR_EOF
    64	chmod +x tools/mock-cursor-agent.sh
    65	echo "[4/7] Created mock-cursor-agent.sh"
    66	
    67	# 5) Create mock opencode
    68	cat > tools/mock-opencode.sh << 'OPENCODE_EOF'
    69	#!/usr/bin/env bash
    70	# Mock opencode: outputs valid orchestrator JSON
    71	cat << 'JSON'
    72	{"status":"ok","writes":{"pilot/STATE.json":{"status":"complete"}},"notes":["mock patch"]}
    73	JSON
    74	OPENCODE_EOF
    75	chmod +x tools/mock-opencode.sh
    76	echo "[5/7] Created mock-opencode.sh"
    77	
    78	# 6) Run pilot with mocks
    79	echo "[6/7] Running pilot..."
    80	export PILOT_CURSOR_BIN="./tools/mock-cursor-agent.sh"
    81	export PILOT_OPENCODE_BIN="./tools/mock-opencode.sh"
    82	node "$ENGINE_DIR/dist/cli.js" run --once --workspace . || true
    83	echo ""
    84	
    85	# 7) Assertions
    86	echo "[7/7] Assertions..."
    87	FAIL=0
    88	
    89	# STATE.status == "complete"
    90	STATUS=$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).status)" "$WS/STATE.json" 2>/dev/null || echo "ERROR")
    91	if [ "$STATUS" = "complete" ]; then
    92	  echo "  [PASS] STATE.status == complete"
    93	else
    94	  echo "  [FAIL] STATE.status == '$STATUS' (expected 'complete')"
    95	  FAIL=1
    96	fi
    97	
    98	# SMOKE.txt exists and equals OK
    99	if [ -f "SMOKE.txt" ]; then
   100	  SMOKE_CONTENT=$(cat SMOKE.txt)
   101	  if [ "$SMOKE_CONTENT" = "OK" ]; then
   102	    echo "  [PASS] SMOKE.txt exists and equals 'OK'"
   103	  else
   104	    echo "  [FAIL] SMOKE.txt content is '$SMOKE_CONTENT' (expected 'OK')"
   105	    FAIL=1
   106	  fi
   107	else
   108	  echo "  [FAIL] SMOKE.txt does not exist"
   109	  FAIL=1
   110	fi
   111	
   112	# BLOCKED.json does not exist
   113	if [ ! -f "BLOCKED.json" ]; then
   114	  echo "  [PASS] BLOCKED.json does not exist"
   115	else
   116	  echo "  [FAIL] BLOCKED.json exists (should not)"
   117	  cat BLOCKED.json
   118	  FAIL=1
   119	fi
   120	
   121	echo ""
   122	if [ "$FAIL" -eq 0 ]; then
   123	  echo "=== ALL ASSERTIONS PASSED ==="
   124	  exit 0
   125	else
   126	  echo "=== SOME ASSERTIONS FAILED ==="
   127	  exit 1
   128	fi


---
# FILE: src/cli.ts
---

     1	#!/usr/bin/env node
     2	
     3	import * as fs from 'fs'
     4	import * as path from 'path'
     5	import * as crypto from 'crypto'
     6	import { fileURLToPath } from 'url'
     7	import { runPilot } from './runner.js'
     8	import { ensureDir, readJson, writeJsonAtomic, writeTextAtomic, semverLt, tsCompact, sh } from './shared.js'
     9	
    10	const __filename = fileURLToPath(import.meta.url)
    11	const __dirname = path.dirname(__filename)
    12	
    13	const ENGINE_DIR = path.resolve(__dirname, '..')
    14	const TEMPLATES_DIR = path.join(ENGINE_DIR, 'templates')
    15	
    16	type Manifest = {
    17	  pilotFolderVersion: string
    18	  stateSchemaVersion: number
    19	  managedFiles: string[]
    20	  hashes: Record<string, string>
    21	}
    22	
    23	type State = {
    24	  project: string
    25	  status: 'active' | 'waiting_human' | 'complete'
    26	  current_task: string | null
    27	  retry_count: number
    28	  last_completed_task: string | null
    29	  task_started_at: number | null
    30	  flags?: { allowLargeDiffOnce?: boolean }
    31	  config: {
    32	    orchestratorModel: string
    33	    builderTimeout: number
    34	    orchestratorTimeout: number
    35	    verifyTimeout: number
    36	    watchdogTimeout: number
    37	    verifyCommands: string[]
    38	    tools?: {
    39	      builder?: 'cursor'
    40	      cursor?: { mode?: 'prompt-file' | 'stdin' }
    41	      opencode?: { mode?: 'file-attachment'; format?: 'default' | 'json' }
    42	    }
    43	    capabilities?: { promptTransport?: 'prompt-file' | 'stdin' | 'file-attachment' }
    44	    safety?: {
    45	      largeDiff?: { maxFiles?: number; maxLines?: number }
    46	      cleanUntrackedOnRollback?: boolean
    47	    }
    48	  }
    49	  git: { lkg: string | null }
    50	}
    51	
    52	function usage(): never {
    53	  process.stderr.write(
    54	    [
    55	      'pilot <command>',
    56	      '',
    57	      'Commands:',
    58	      '  init            create ./pilot workspace (if missing)',
    59	      '  upgrade         migrate ./pilot schema + managed files',
    60	      '  doctor          check prerequisites; writes pilot/BLOCKED.json on failure',
    61	      '  run             start daemon loop',
    62	      '  run --once      run one deterministic cycle and exit',
    63	      '',
    64	      'Options:',
    65	      '  --workspace <dir>   default: pilot',
    66	      '',
    67	    ].join('\n')
    68	  )
    69	  process.exit(1)
    70	}
    71	
    72	function getArg(args: string[], name: string): string | null {
    73	  const idx = args.indexOf(name)
    74	  if (idx === -1) return null
    75	  return args[idx + 1] ?? null
    76	}
    77	
    78	function hasArg(args: string[], name: string): boolean {
    79	  return args.includes(name)
    80	}
    81	
    82	function sha256(p: string): string {
    83	  const b = fs.readFileSync(p)
    84	  return crypto.createHash('sha256').update(b).digest('hex')
    85	}
    86	
    87	function workspaceDirFromArgs(args: string[]): string {
    88	  const explicit = getArg(args, '--workspace') || process.env.PILOT_WORKSPACE
    89	  if (explicit) return path.resolve(process.cwd(), explicit)
    90	
    91	  // Auto-discover: prefer .pilot if it exists, else pilot
    92	  const cwd = process.cwd()
    93	  const dotPilot = path.join(cwd, '.pilot', 'STATE.json')
    94	  if (fs.existsSync(dotPilot)) return path.join(cwd, '.pilot')
    95	
    96	  const pilot = path.join(cwd, 'pilot', 'STATE.json')
    97	  if (fs.existsSync(pilot)) return path.join(cwd, 'pilot')
    98	
    99	  return path.join(cwd, 'pilot')
   100	}
   101	
   102	function writeBlocked(workspaceDir: string, reason: string, action: string) {
   103	  writeJsonAtomic(path.join(workspaceDir, 'BLOCKED.json'), { reason, action })
   104	}
   105	
   106	function migrateStateToSchema2(state: any): State {
   107	  const base = state && typeof state === 'object' ? state : {}
   108	
   109	  const s: State = {
   110	    project: typeof base.project === 'string' ? base.project : 'my-app',
   111	    status: base.status === 'waiting_human' || base.status === 'complete' ? base.status : 'active',
   112	    current_task: typeof base.current_task === 'string' ? base.current_task : null,
   113	    retry_count: typeof base.retry_count === 'number' ? base.retry_count : 0,
   114	    last_completed_task: typeof base.last_completed_task === 'string' ? base.last_completed_task : null,
   115	    task_started_at: typeof base.task_started_at === 'number' ? base.task_started_at : null,
   116	    flags: {
   117	      allowLargeDiffOnce: typeof base.flags?.allowLargeDiffOnce === 'boolean' ? base.flags.allowLargeDiffOnce : false,
   118	    },
   119	    config: {
   120	      orchestratorModel: typeof base.config?.orchestratorModel === 'string' ? base.config.orchestratorModel : '',
   121	      builderTimeout: typeof base.config?.builderTimeout === 'number' ? base.config.builderTimeout : 300000,
   122	      orchestratorTimeout: typeof base.config?.orchestratorTimeout === 'number' ? base.config.orchestratorTimeout : 120000,
   123	      verifyTimeout: typeof base.config?.verifyTimeout === 'number' ? base.config.verifyTimeout : 60000,
   124	      watchdogTimeout: typeof base.config?.watchdogTimeout === 'number' ? base.config.watchdogTimeout : 600000,
   125	      verifyCommands: Array.isArray(base.config?.verifyCommands) ? base.config.verifyCommands : [],
   126	      tools: {
   127	        builder: (base.config?.tools?.builder as any) === 'cursor' ? 'cursor' : 'cursor',
   128	        cursor: { mode: base.config?.tools?.cursor?.mode === 'stdin' ? 'stdin' : 'prompt-file' },
   129	        opencode: {
   130	          mode: 'file-attachment',
   131	          format: base.config?.tools?.opencode?.format === 'json' ? 'json' : 'default',
   132	        },
   133	      },
   134	      capabilities: {
   135	        promptTransport: 'file-attachment',
   136	      },
   137	      safety: {
   138	        largeDiff: {
   139	          maxFiles: typeof base.config?.safety?.largeDiff?.maxFiles === 'number' ? base.config.safety.largeDiff.maxFiles : 8,
   140	          maxLines: typeof base.config?.safety?.largeDiff?.maxLines === 'number' ? base.config.safety.largeDiff.maxLines : 300,
   141	        },
   142	        cleanUntrackedOnRollback:
   143	          typeof base.config?.safety?.cleanUntrackedOnRollback === 'boolean' ? base.config.safety.cleanUntrackedOnRollback : true,
   144	      },
   145	    },
   146	    git: {
   147	      lkg: typeof base.git?.lkg === 'string' ? base.git.lkg : null,
   148	    },
   149	  }
   150	
   151	  return s
   152	}
   153	
   154	function copyManagedFile(templateRel: string, workspaceDir: string, backupDir: string, current: Manifest | null, expected: Manifest): { conflict: boolean } {
   155	  const src = path.join(TEMPLATES_DIR, templateRel)
   156	  const destRel = templateRel === 'gitignore' ? '.gitignore' : templateRel
   157	  const dest = path.join(workspaceDir, destRel)
   158	  ensureDir(path.dirname(dest))
   159	
   160	  if (fs.existsSync(dest)) {
   161	    const backupPath = path.join(backupDir, templateRel)
   162	    ensureDir(path.dirname(backupPath))
   163	    fs.copyFileSync(dest, backupPath)
   164	  }
   165	
   166	  const destExists = fs.existsSync(dest)
   167	  const destHash = destExists ? sha256(dest) : null
   168	  const recorded = current?.hashes?.[templateRel]
   169	  const templateHash = expected.hashes?.[templateRel]
   170	
   171	  const looksUserEdited =
   172	    destExists && ((recorded && destHash !== recorded) || (!recorded && templateHash && destHash !== templateHash))
   173	
   174	  if (looksUserEdited) {
   175	    const newPath = `${dest}.new`
   176	    ensureDir(path.dirname(newPath))
   177	    fs.copyFileSync(src, `${newPath}.tmp`)
   178	    fs.renameSync(`${newPath}.tmp`, newPath)
   179	    return { conflict: true }
   180	  }
   181	
   182	  fs.copyFileSync(src, `${dest}.tmp`)
   183	  fs.renameSync(`${dest}.tmp`, dest)
   184	  return { conflict: false }
   185	}
   186	
   187	function initWorkspace(workspaceDir: string) {
   188	  ensureDir(workspaceDir)
   189	  ensureDir(path.join(workspaceDir, 'overrides', 'prompts'))
   190	
   191	  const expected = readJson<Manifest>(path.join(TEMPLATES_DIR, 'MANIFEST.json'))
   192	  if (!expected) throw new Error('Missing templates/MANIFEST.json')
   193	
   194	  // Managed runtime files
   195	  for (const rel of expected.managedFiles) {
   196	    const destRel = rel === 'gitignore' ? '.gitignore' : rel
   197	    const dest = path.join(workspaceDir, destRel)
   198	    if (!fs.existsSync(dest)) {
   199	      const src = path.join(TEMPLATES_DIR, rel)
   200	      ensureDir(path.dirname(dest))
   201	      fs.copyFileSync(src, `${dest}.tmp`)
   202	      fs.renameSync(`${dest}.tmp`, dest)
   203	    }
   204	  }
   205	
   206	  // User-owned stubs
   207	  const statePath = path.join(workspaceDir, 'STATE.json')
   208	  if (!fs.existsSync(statePath)) {
   209	    const s: State = migrateStateToSchema2({
   210	      project: path.basename(process.cwd()),
   211	      status: 'active',
   212	      current_task: null,
   213	      retry_count: 0,
   214	      last_completed_task: null,
   215	      task_started_at: null,
   216	      config: {
   217	        orchestratorModel: '',
   218	        builderTimeout: 300000,
   219	        orchestratorTimeout: 120000,
   220	        verifyTimeout: 60000,
   221	        watchdogTimeout: 600000,
   222	        verifyCommands: [],
   223	        tools: { builder: 'cursor', cursor: { mode: 'prompt-file' }, opencode: { mode: 'file-attachment', format: 'default' } },
   224	        capabilities: { promptTransport: 'file-attachment' },
   225	        safety: { largeDiff: { maxFiles: 8, maxLines: 300 }, cleanUntrackedOnRollback: true },
   226	      },
   227	      git: { lkg: null },
   228	    })
   229	    writeJsonAtomic(statePath, s)
   230	  }
   231	
   232	  const roadmapPath = path.join(workspaceDir, 'ROADMAP.json')
   233	  if (!fs.existsSync(roadmapPath)) {
   234	    writeJsonAtomic(roadmapPath, [])
   235	  }
   236	
   237	  const manifestPath = path.join(workspaceDir, 'MANIFEST.json')
   238	  if (!fs.existsSync(manifestPath)) {
   239	    writeJsonAtomic(manifestPath, expected)
   240	  }
   241	}
   242	
   243	function upgradeWorkspace(workspaceDir: string) {
   244	  const expected = readJson<Manifest>(path.join(TEMPLATES_DIR, 'MANIFEST.json'))
   245	  if (!expected) throw new Error('Missing templates/MANIFEST.json')
   246	
   247	  const current = readJson<Manifest>(path.join(workspaceDir, 'MANIFEST.json'))
   248	  const backupDir = path.join(workspaceDir, '.backup', tsCompact())
   249	  ensureDir(backupDir)
   250	
   251	  const conflicts: string[] = []
   252	
   253	  for (const rel of expected.managedFiles) {
   254	    const res = copyManagedFile(rel, workspaceDir, backupDir, current, expected)
   255	    if (res.conflict) conflicts.push(rel)
   256	  }
   257	
   258	  const statePath = path.join(workspaceDir, 'STATE.json')
   259	  if (fs.existsSync(statePath)) {
   260	    const raw = readJson<any>(statePath)
   261	    const migrated = migrateStateToSchema2(raw)
   262	    fs.copyFileSync(statePath, path.join(backupDir, 'STATE.json'))
   263	    writeJsonAtomic(statePath, migrated)
   264	  }
   265	
   266	  // Always update manifest last
   267	  writeJsonAtomic(path.join(workspaceDir, 'MANIFEST.json'), expected)
   268	
   269	  if (conflicts.length > 0) {
   270	    writeBlocked(workspaceDir, 'Upgrade wrote *.new files (local edits detected)', 'ls pilot/**/*.new 2>/dev/null || true')
   271	    process.exitCode = 2
   272	  } else {
   273	    process.stdout.write('pilot upgrade: ok\n')
   274	  }
   275	}
   276	
   277	function doctor(workspaceDir: string): number {
   278	  // Deterministic checks, one fix command.
   279	  const toolCwd = fs.existsSync(workspaceDir) ? workspaceDir : process.cwd()
   280	  try {
   281	    sh('git rev-parse --is-inside-work-tree', process.cwd())
   282	  } catch {
   283	    writeBlocked(workspaceDir, 'Not a git repository', 'git init')
   284	    return 2
   285	  }
   286	  try {
   287	    sh('git rev-parse HEAD', process.cwd())
   288	  } catch {
   289	    writeBlocked(workspaceDir, 'No commits yet (needed for rollback/LKG)', 'git commit --allow-empty -m "pilot: init"')
   290	    return 2
   291	  }
   292	  const cursorBin = (process.env.PILOT_CURSOR_BIN || '').trim() || 'cursor-agent'
   293	  const opencodeBin = (process.env.PILOT_OPENCODE_BIN || '').trim() || 'opencode'
   294	
   295	  try {
   296	    if (opencodeBin.includes('/')) sh(`test -x "${opencodeBin.replace(/"/g, '')}"`, toolCwd)
   297	    else sh(`command -v ${opencodeBin}`, toolCwd)
   298	  } catch {
   299	    writeBlocked(
   300	      workspaceDir,
   301	      `${opencodeBin} not found`,
   302	      'Install OpenCode CLI (opencode) from https://opencode.ai/install, then rerun: pilot doctor'
   303	    )
   304	    return 2
   305	  }
   306	  try {
   307	    if (cursorBin.includes('/')) sh(`test -x "${cursorBin.replace(/"/g, '')}"`, toolCwd)
   308	    else sh(`command -v ${cursorBin}`, toolCwd)
   309	  } catch {
   310	    if (cursorBin === 'cursor-agent') {
   311	      writeBlocked(
   312	        workspaceDir,
   313	        'cursor-agent not found',
   314	        'Install Cursor Agent CLI (cursor-agent) from https://cursor.com/install OR set PILOT_CURSOR_BIN to a custom builder command, then rerun: pilot doctor'
   315	      )
   316	    } else {
   317	      writeBlocked(
   318	        workspaceDir,
   319	        `${cursorBin} not found`,
   320	        'Install Cursor Agent CLI (cursor-agent) from https://cursor.com/install OR set PILOT_CURSOR_BIN to a custom builder command, then rerun: pilot doctor'
   321	      )
   322	    }
   323	    return 2
   324	  }
   325	
   326	  const statePath = path.join(workspaceDir, 'STATE.json')
   327	  const state = readJson<any>(statePath)
   328	  const cmds = Array.isArray(state?.config?.verifyCommands) ? state.config.verifyCommands : []
   329	  for (const cmd of cmds) {
   330	    const bin = String(cmd).trim().split(/\s+/)[0]
   331	    if (!bin) continue
   332	    try {
   333	      sh(`command -v ${bin}`, process.cwd())
   334	    } catch {
   335	      const fix =
   336	        bin === 'pnpm'
   337	          ? 'npm i -g pnpm'
   338	          : bin === 'yarn'
   339	            ? 'npm i -g yarn'
   340	            : bin === 'bun'
   341	              ? 'curl -fsSL https://bun.sh/install | bash'
   342	              : `brew install ${bin}`
   343	      writeBlocked(workspaceDir, `Missing verify tool: ${bin}`, fix)
   344	      return 2
   345	    }
   346	  }
   347	
   348	  const expected = readJson<Manifest>(path.join(TEMPLATES_DIR, 'MANIFEST.json'))
   349	  const current = readJson<Manifest>(path.join(workspaceDir, 'MANIFEST.json'))
   350	  if (expected && current && semverLt(current.pilotFolderVersion, expected.pilotFolderVersion)) {
   351	    writeBlocked(workspaceDir, `Pilot workspace out of date (${current.pilotFolderVersion} < ${expected.pilotFolderVersion})`, 'pilot upgrade')
   352	    return 2
   353	  }
   354	
   355	  process.stdout.write('pilot doctor: ok\n')
   356	  return 0
   357	}
   358	
   359	async function main() {
   360	  const args = process.argv.slice(2)
   361	  const cmd = args[0]
   362	  if (!cmd) usage()
   363	
   364	  const workspaceDir = workspaceDirFromArgs(args)
   365	
   366	  if (cmd === 'init') {
   367	    initWorkspace(workspaceDir)
   368	    process.stdout.write(`pilot init: ok (${path.relative(process.cwd(), workspaceDir)})\n`)
   369	    return
   370	  }
   371	
   372	  if (cmd === 'upgrade') {
   373	    upgradeWorkspace(workspaceDir)
   374	    return
   375	  }
   376	
   377	  if (cmd === 'doctor') {
   378	    process.exit(doctor(workspaceDir))
   379	  }
   380	
   381	  if (cmd === 'run') {
   382	    const once = hasArg(args, '--once')
   383	
   384	    // Always gate run behind doctor. Blocked -> exit 2 (or specific doctor code).
   385	    const code = doctor(workspaceDir)
   386	    if (code !== 0) process.exit(code)
   387	
   388	    await runPilot({ workspaceDir, runOnce: once })
   389	    return
   390	  }
   391	
   392	  usage()
   393	}
   394	
   395	main().catch(err => {
   396	  process.stderr.write(String(err?.stack || err?.message || err) + '\n')
   397	  process.exit(1)
   398	})


---
# FILE: src/runner.ts
---

     1	import { watch } from 'chokidar'
     2	import { execSync } from 'child_process'
     3	import * as fs from 'fs'
     4	import * as path from 'path'
     5	import { fileURLToPath } from 'url'
     6	import {
     7	  ensureDir,
     8	  readJson,
     9	  writeJsonAtomic,
    10	  writeTextAtomic,
    11	  tsCompact,
    12	  tsMinute,
    13	  randomId,
    14	  truncate,
    15	  semverLt,
    16	  sh,
    17	} from './shared.js'
    18	
    19	const __filename = fileURLToPath(import.meta.url)
    20	const __dirname = path.dirname(__filename)
    21	
    22	const ENGINE_DIR = path.resolve(__dirname, '..')
    23	const TEMPLATES_DIR = path.join(ENGINE_DIR, 'templates')
    24	
    25	const DEFAULT_CURSOR_BIN = 'cursor' + '-agent'
    26	const DEFAULT_OPENCODE_BIN = 'open' + 'code'
    27	
    28	const CURSOR_BIN = (process.env.PILOT_CURSOR_BIN || '').trim() || DEFAULT_CURSOR_BIN
    29	const OPENCODE_BIN = (process.env.PILOT_OPENCODE_BIN || '').trim() || DEFAULT_OPENCODE_BIN
    30	
    31	const ORCH_INLINE_MESSAGE = 'Read the attached file and output JSON only.'
    32	const LOG_ROTATE_BYTES = 2 * 1024 * 1024
    33	
    34	const BASELINE_FORBIDDEN = [
    35	  '.env*',
    36	  '**/*.pem',
    37	  '**/*id_rsa*',
    38	  '**/*secret*',
    39	  '**/*token*',
    40	  '.git/**',
    41	  'node_modules/**',
    42	  'dist/**',
    43	  'build/**',
    44	]
    45	
    46	const ORCHESTRATOR_ALLOWED_WRITES = ['pilot/STATE.json', 'pilot/TASK.json', 'pilot/BLOCKED.json']
    47	
    48	/** Canonicalize orchestrator write key to allowed path or return null if invalid/forbidden. */
    49	function canonicalizeWriteKey(k: string): string | null {
    50	  // Normalize slashes and trim
    51	  let p = (k || '').replace(/\\/g, '/').trim()
    52	  // Security: reject path traversal, absolute, home, or null bytes
    53	  if (p.includes('\0')) return null
    54	  if (p.startsWith('/') || p.startsWith('~')) return null
    55	  if (p.split('/').includes('..')) return null
    56	
    57	  // Map shorthand to canonical
    58	  const CANONICAL_MAP: Record<string, string> = {
    59	    'STATE.json': 'pilot/STATE.json',
    60	    'TASK.json': 'pilot/TASK.json',
    61	    'BLOCKED.json': 'pilot/BLOCKED.json',
    62	    'pilot/STATE.json': 'pilot/STATE.json',
    63	    'pilot/TASK.json': 'pilot/TASK.json',
    64	    'pilot/BLOCKED.json': 'pilot/BLOCKED.json',
    65	  }
    66	  return CANONICAL_MAP[p] ?? null
    67	}
    68	
    69	const RUNNER_INVARIANT_VERIFY = ['git diff --check']
    70	
    71	type PromptTransport = 'prompt-file' | 'stdin' | 'file-attachment'
    72	
    73	export interface RunOptions {
    74	  workspaceDir?: string
    75	  runOnce?: boolean
    76	}
    77	
    78	interface Manifest {
    79	  pilotFolderVersion: string
    80	  stateSchemaVersion: number
    81	  managedFiles: string[]
    82	  hashes: Record<string, string>
    83	}
    84	
    85	interface State {
    86	  project: string
    87	  status: 'active' | 'waiting_human' | 'complete'
    88	  current_task: string | null
    89	  retry_count: number
    90	  last_completed_task: string | null
    91	  task_started_at: number | null
    92	  flags?: { allowLargeDiffOnce?: boolean }
    93	  run?: { id?: string; started_at?: number; history_dir?: string }
    94	  config: {
    95	    orchestratorModel: string
    96	    builderTimeout: number
    97	    orchestratorTimeout: number
    98	    verifyTimeout: number
    99	    watchdogTimeout: number
   100	    verifyCommands: string[]
   101	    tools?: {
   102	      builder?: 'cursor'
   103	      cursor?: { mode?: 'prompt-file' | 'stdin' }
   104	      opencode?: { mode?: 'file-attachment'; format?: 'default' | 'json' }
   105	    }
   106	    capabilities?: { promptTransport?: PromptTransport }
   107	    safety?: {
   108	      largeDiff?: { maxFiles?: number; maxLines?: number }
   109	      cleanUntrackedOnRollback?: boolean
   110	      allowDirtyWorkspace?: boolean
   111	    }
   112	  }
   113	  git: { lkg: string | null }
   114	}
   115	
   116	interface Task {
   117	  id: string
   118	  status: 'ready' | 'in_progress'
   119	  title: string
   120	  description: string
   121	  acceptance?: string[]
   122	  scope: { allowed: string[]; forbidden: string[] }
   123	}
   124	
   125	interface Report {
   126	  task_id: string
   127	  status: 'done' | 'blocked' | 'failed' | 'timeout'
   128	  summary: string[]
   129	  error?: string
   130	  partial_progress?: string
   131	  files_changed?: string[]
   132	  questions: string[]
   133	}
   134	
   135	interface RecentItem {
   136	  id: string
   137	  title: string
   138	  completed_at: number
   139	  commit: string
   140	  summary: string[]
   141	  files_changed: string[]
   142	  diffstat?: string
   143	}
   144	
   145	interface RecentFile {
   146	  items: RecentItem[]
   147	  max_items: number
   148	}
   149	
   150	interface ContextBundle {
   151	  meta: {
   152	    run_id: string
   153	    created_at: number
   154	    project_root: string
   155	    git: { branch: string | null; head: string | null; lkg: string | null }
   156	  }
   157	  state_min: {
   158	    project: string
   159	    status: 'active' | 'waiting_human' | 'complete'
   160	    current_task: string | null
   161	    retry_count: number
   162	    last_completed_task: string | null
   163	  }
   164	  task: Task
   165	  roadmap_window: { next: any[]; tail: any[] }
   166	  recent_window: { last_completed: RecentItem[] }
   167	  last_report: Report | null
   168	  constraints: {
   169	    baseline_forbidden: string[]
   170	    orchestrator_allowed_writes: string[]
   171	    diff_guardrail: { maxFiles: number; maxLines: number }
   172	  }
   173	}
   174	
   175	function resolveWorkspaceDir(workspaceDir?: string): string {
   176	  const ws = workspaceDir || process.env.PILOT_WORKSPACE || 'pilot'
   177	  return path.resolve(process.cwd(), ws)
   178	}
   179	
   180	function getPromptPath(workspaceDir: string, name: 'build' | 'orchestrate'): string {
   181	  const override = path.join(workspaceDir, 'overrides', 'prompts', `${name}.md`)
   182	  if (fs.existsSync(override)) return override
   183	  return path.join(TEMPLATES_DIR, 'prompts', `${name}.md`)
   184	}
   185	
   186	function rotateLogIfNeeded(logPath: string) {
   187	  try {
   188	    if (!fs.existsSync(logPath)) return
   189	    const stat = fs.statSync(logPath)
   190	    if (stat.size < LOG_ROTATE_BYTES) return
   191	    const rotated = `${logPath}.${tsCompact()}`
   192	    fs.renameSync(logPath, rotated)
   193	  } catch {
   194	    // ignore
   195	  }
   196	}
   197	
   198	function isAuthError(s: string): boolean {
   199	  const authPatterns = [
   200	    /unauthorized/i,
   201	    /401/,
   202	    /403/,
   203	    /token.*expired/i,
   204	    /authentication.*failed/i,
   205	    /invalid.*token/i,
   206	    /please.*login/i,
   207	    /re-?auth/i,
   208	  ]
   209	  return authPatterns.some(p => p.test(s))
   210	}
   211	
   212	function isPlainObject(v: any): v is Record<string, any> {
   213	  return !!v && typeof v === 'object' && !Array.isArray(v)
   214	}
   215	
   216	function deepMerge(base: any, patch: any): any {
   217	  if (!isPlainObject(base) || !isPlainObject(patch)) return patch
   218	  const out: any = { ...base }
   219	  for (const [k, v] of Object.entries(patch)) {
   220	    if (v === undefined) continue
   221	    const bv = (base as any)[k]
   222	    if (v === null) out[k] = null
   223	    else if (Array.isArray(v)) out[k] = v
   224	    else out[k] = deepMerge(bv, v)
   225	  }
   226	  return out
   227	}
   228	
   229	function validateTaskShape(task: any): string[] {
   230	  const errs: string[] = []
   231	  if (!isPlainObject(task)) return ['TASK.json must be an object']
   232	  if (typeof task.id !== 'string' || !task.id) errs.push('TASK.id must be a non-empty string')
   233	  if (typeof task.title !== 'string' || !task.title) errs.push('TASK.title must be a non-empty string')
   234	  if (typeof task.description !== 'string') errs.push('TASK.description must be a string')
   235	  if (!isPlainObject(task.scope)) errs.push('TASK.scope must be an object')
   236	  if (!Array.isArray(task.scope?.allowed)) errs.push('TASK.scope.allowed must be an array')
   237	  if (!Array.isArray(task.scope?.forbidden)) errs.push('TASK.scope.forbidden must be an array')
   238	  return errs
   239	}
   240	
   241	function validateReportShape(report: any): string[] {
   242	  const errs: string[] = []
   243	  if (!isPlainObject(report)) return ['REPORT.json must be an object']
   244	  if (typeof report.task_id !== 'string' || !report.task_id) errs.push('REPORT.task_id must be a non-empty string')
   245	  if (typeof report.status !== 'string') errs.push('REPORT.status must be a string')
   246	  if (!Array.isArray(report.summary)) errs.push('REPORT.summary must be an array')
   247	  if (!Array.isArray(report.questions)) errs.push('REPORT.questions must be an array')
   248	  return errs
   249	}
   250	
   251	function validateRoadmapShape(roadmap: any): string[] {
   252	  const errs: string[] = []
   253	  if (!Array.isArray(roadmap)) return ['ROADMAP.json must be an array']
   254	  for (let i = 0; i < Math.min(5, roadmap.length); i++) {
   255	    const e = roadmap[i]
   256	    if (!isPlainObject(e)) {
   257	      errs.push(`ROADMAP[${i}] must be an object`)
   258	      continue
   259	    }
   260	    if (typeof e.id !== 'string' || !e.id) errs.push(`ROADMAP[${i}].id must be a string`)
   261	    if (typeof e.title !== 'string' || !e.title) errs.push(`ROADMAP[${i}].title must be a string`)
   262	    if (typeof e.description !== 'string') errs.push(`ROADMAP[${i}].description must be a string`)
   263	    if (!isPlainObject(e.scope)) errs.push(`ROADMAP[${i}].scope must be an object`)
   264	    if (!Array.isArray(e.scope?.allowed)) errs.push(`ROADMAP[${i}].scope.allowed must be an array`)
   265	    if (!Array.isArray(e.scope?.forbidden)) errs.push(`ROADMAP[${i}].scope.forbidden must be an array`)
   266	  }
   267	  return errs
   268	}
   269	
   270	function validateStateShape(state: any): string[] {
   271	  const errs: string[] = []
   272	  if (!isPlainObject(state)) return ['STATE.json must be an object']
   273	
   274	  if (typeof state.project !== 'string') errs.push('STATE.project must be a string')
   275	  if (state.status !== 'active' && state.status !== 'waiting_human' && state.status !== 'complete') {
   276	    errs.push('STATE.status must be active|waiting_human|complete')
   277	  }
   278	  if (state.current_task !== null && typeof state.current_task !== 'string') errs.push('STATE.current_task must be string|null')
   279	  if (typeof state.retry_count !== 'number') errs.push('STATE.retry_count must be a number')
   280	  if (state.last_completed_task !== null && typeof state.last_completed_task !== 'string') {
   281	    errs.push('STATE.last_completed_task must be string|null')
   282	  }
   283	  if (state.task_started_at !== null && typeof state.task_started_at !== 'number') errs.push('STATE.task_started_at must be number|null')
   284	
   285	  if (!isPlainObject(state.config)) errs.push('STATE.config must be an object')
   286	  if (isPlainObject(state.config)) {
   287	    if (typeof state.config.orchestratorModel !== 'string') errs.push('STATE.config.orchestratorModel must be a string')
   288	    if (typeof state.config.builderTimeout !== 'number') errs.push('STATE.config.builderTimeout must be a number')
   289	    if (typeof state.config.orchestratorTimeout !== 'number') errs.push('STATE.config.orchestratorTimeout must be a number')
   290	    if (typeof state.config.verifyTimeout !== 'number') errs.push('STATE.config.verifyTimeout must be a number')
   291	    if (typeof state.config.watchdogTimeout !== 'number') errs.push('STATE.config.watchdogTimeout must be a number')
   292	    if (!Array.isArray(state.config.verifyCommands)) errs.push('STATE.config.verifyCommands must be an array')
   293	  }
   294	
   295	  if (!isPlainObject(state.git)) errs.push('STATE.git must be an object')
   296	  if (isPlainObject(state.git)) {
   297	    if (state.git.lkg !== null && typeof state.git.lkg !== 'string') errs.push('STATE.git.lkg must be string|null')
   298	  }
   299	
   300	  return errs
   301	}
   302	
   303	function readValidatedJson<T>(state: State, filePath: string, label: string, validate: (v: any) => string[], snapshot: (label: string, filePath: string) => void, block: (reason: string, action: string, extra?: any) => void): T | null {
   304	  if (!fs.existsSync(filePath)) return null
   305	  const parsed = readJson<any>(filePath)
   306	  if (parsed === null) {
   307	    snapshot(`invalid/${tsCompact()}-${label}`, filePath)
   308	    block(`Invalid ${label}: invalid JSON`, `cat "${filePath}"`)
   309	    return null
   310	  }
   311	  const errs = validate(parsed)
   312	  if (errs.length > 0) {
   313	    snapshot(`invalid/${tsCompact()}-${label}`, filePath)
   314	    block(`Invalid ${label}: ${errs[0]}`, `cat "${filePath}"`)
   315	    return null
   316	  }
   317	  return parsed as T
   318	}
   319	
   320	function matchGlob(filepath: string, pattern: string): boolean {
   321	  const regex = pattern
   322	    .replace(/\./g, '\\.')
   323	    .replace(/\*\*/g, '{{DOUBLESTAR}}')
   324	    .replace(/\*/g, '[^/]*')
   325	    .replace(/\{\{DOUBLESTAR\}\}/g, '.*')
   326	  return new RegExp(`^${regex}$`).test(filepath)
   327	}
   328	
   329	function normalizeRelPath(p: string): string {
   330	  let out = (p || '').replace(/\\/g, '/').trim()
   331	  if (out.startsWith('./')) out = out.slice(2)
   332	  while (out.startsWith('/')) out = out.slice(1)
   333	  if (out.endsWith('/')) out = out.slice(0, -1)
   334	  return out
   335	}
   336	
   337	function isAllowedByPrefixes(filePath: string, allowed: string[]): boolean {
   338	  const file = normalizeRelPath(filePath)
   339	  for (const raw of allowed ?? []) {
   340	    const a = normalizeRelPath(String(raw))
   341	    if (a === '' || a === '.' || a === './') return true
   342	    if (file === a) return true
   343	    if (file.startsWith(a + '/')) return true
   344	  }
   345	  return false
   346	}
   347	
   348	function isWorkspaceOperationalPath(changedPath: string, workspaceRelRaw: string): boolean {
   349	  const p = changedPath.replace(/\\/g, '/')
   350	  const rel = workspaceRelRaw.replace(/\\/g, '/')
   351	  const prefix = rel === '' || rel === '.' ? '' : rel.replace(/\/$/, '') + '/'
   352	  const atWorkspace = prefix === '' ? p : p.startsWith(prefix)
   353	  if (!atWorkspace) return false
   354	
   355	  const within = prefix === '' ? p : p.slice(prefix.length)
   356	  if (
   357	    within === 'STATE.json' ||
   358	    within === 'TASK.json' ||
   359	    within === 'REPORT.json' ||
   360	    within === 'BLOCKED.json' ||
   361	    within === 'run.log' ||
   362	    within === 'MANIFEST.json' ||
   363	    within === 'ROADMAP.json' ||
   364	    within === '.gitignore'
   365	  ) {
   366	    return true
   367	  }
   368	
   369	  if (
   370	    within.startsWith('history/') ||
   371	    within.startsWith('overrides/') ||
   372	    within.startsWith('.tmp/') ||
   373	    within.startsWith('.backup/') ||
   374	    within.startsWith('tools/')
   375	  ) {
   376	    return true
   377	  }
   378	
   379	  return false
   380	}
   381	
   382	function compactStringArray(arr: any, maxItems: number, maxItemLen: number): string[] {
   383	  if (!Array.isArray(arr)) return []
   384	  const out: string[] = []
   385	  for (const v of arr) {
   386	    if (typeof v !== 'string') continue
   387	    out.push(truncate(v, maxItemLen))
   388	    if (out.length >= maxItems) break
   389	  }
   390	  return out
   391	}
   392	
   393	function compactRoadmapEntry(entry: any): any {
   394	  if (!entry || typeof entry !== 'object') return null
   395	  const scope = entry.scope && typeof entry.scope === 'object' ? entry.scope : {}
   396	  return {
   397	    id: typeof entry.id === 'string' ? entry.id : null,
   398	    title: typeof entry.title === 'string' ? truncate(entry.title, 120) : null,
   399	    description: typeof entry.description === 'string' ? truncate(entry.description, 800) : null,
   400	    acceptance: compactStringArray(entry.acceptance, 8, 160),
   401	    scope: {
   402	      allowed: compactStringArray(scope.allowed, 20, 160),
   403	      forbidden: compactStringArray(scope.forbidden, 20, 160),
   404	    },
   405	  }
   406	}
   407	
   408	function readRecent(recentPath: string): RecentFile {
   409	  const raw = readJson<any>(recentPath)
   410	  const items = Array.isArray(raw?.items) ? raw.items : []
   411	  const maxItems = typeof raw?.max_items === 'number' ? raw.max_items : 5
   412	  const out: RecentItem[] = []
   413	  for (const it of items) {
   414	    if (!it || typeof it !== 'object') continue
   415	    if (typeof it.id !== 'string' || typeof it.title !== 'string' || typeof it.commit !== 'string') continue
   416	    out.push({
   417	      id: it.id,
   418	      title: truncate(it.title, 120),
   419	      completed_at: typeof it.completed_at === 'number' ? it.completed_at : Date.now(),
   420	      commit: it.commit,
   421	      summary: compactStringArray(it.summary, 6, 160),
   422	      files_changed: compactStringArray(it.files_changed, 20, 220),
   423	      diffstat: typeof it.diffstat === 'string' ? truncate(it.diffstat, 600) : undefined,
   424	    })
   425	    if (out.length >= Math.max(5, maxItems)) break
   426	  }
   427	  return { items: out.slice(0, Math.min(5, maxItems)), max_items: Math.min(5, maxItems) }
   428	}
   429	
   430	function writeRecentAtomic(recentPath: string, recent: RecentFile) {
   431	  writeJsonAtomic(recentPath, { items: recent.items.slice(0, recent.max_items), max_items: recent.max_items })
   432	}
   433	
   434	function updateRecentOnCommit(projectRoot: string, recentPath: string, taskId: string, taskTitle: string, reportSummary: string[], commitHash: string | null) {
   435	  if (!commitHash) return
   436	  const existing = readRecent(recentPath)
   437	
   438	  let filesChanged: string[] = []
   439	  try {
   440	    const out = sh('git show --name-only --pretty="" HEAD', projectRoot).trimEnd()
   441	    filesChanged = out ? out.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 20) : []
   442	  } catch {
   443	    filesChanged = []
   444	  }
   445	
   446	  let diffstat = ''
   447	  try {
   448	    const out = sh('git show --stat --oneline --no-color HEAD', projectRoot).trimEnd()
   449	    diffstat = out ? out.split('\n').slice(0, 24).join('\n') : ''
   450	  } catch {
   451	    diffstat = ''
   452	  }
   453	
   454	  const nextItem: RecentItem = {
   455	    id: taskId,
   456	    title: truncate(taskTitle, 120),
   457	    completed_at: Date.now(),
   458	    commit: commitHash,
   459	    summary: compactStringArray(reportSummary, 6, 160),
   460	    files_changed: filesChanged,
   461	    diffstat: diffstat || undefined,
   462	  }
   463	
   464	  const merged = [nextItem, ...existing.items.filter(i => i.id !== taskId)].slice(0, existing.max_items)
   465	  writeRecentAtomic(recentPath, { items: merged, max_items: existing.max_items })
   466	}
   467	
   468	function buildContextBundle(runId: string, state: State, task: Task, lastReport: Report | null, roadmap: any[], projectRoot: string, recentPath: string): ContextBundle {
   469	  const recent = readRecent(recentPath)
   470	  const maxFiles = state.config?.safety?.largeDiff?.maxFiles ?? 8
   471	  const maxLines = state.config?.safety?.largeDiff?.maxLines ?? 300
   472	
   473	  let branch: string | null = null
   474	  let head: string | null = null
   475	  try {
   476	    branch = sh('git rev-parse --abbrev-ref HEAD', projectRoot).trim()
   477	  } catch {
   478	    branch = null
   479	  }
   480	  try {
   481	    head = sh('git rev-parse HEAD', projectRoot).trim()
   482	  } catch {
   483	    head = null
   484	  }
   485	
   486	  const next = Array.isArray(roadmap) ? roadmap.slice(0, 5).map(compactRoadmapEntry).filter(Boolean) : []
   487	  const tail = Array.isArray(roadmap) ? roadmap.slice(Math.max(0, roadmap.length - 5)).map(compactRoadmapEntry).filter(Boolean) : []
   488	
   489	  return {
   490	    meta: {
   491	      run_id: runId,
   492	      created_at: Date.now(),
   493	      project_root: path.relative(process.cwd(), projectRoot) || projectRoot,
   494	      git: {
   495	        branch,
   496	        head,
   497	        lkg: state.git?.lkg ?? null,
   498	      },
   499	    },
   500	    state_min: {
   501	      project: state.project,
   502	      status: state.status,
   503	      current_task: state.current_task,
   504	      retry_count: state.retry_count,
   505	      last_completed_task: state.last_completed_task,
   506	    },
   507	    task,
   508	    roadmap_window: { next, tail },
   509	    recent_window: { last_completed: recent.items },
   510	    last_report: lastReport,
   511	    constraints: {
   512	      baseline_forbidden: BASELINE_FORBIDDEN.slice(),
   513	      orchestrator_allowed_writes: ORCHESTRATOR_ALLOWED_WRITES.slice(),
   514	      diff_guardrail: { maxFiles, maxLines },
   515	    },
   516	  }
   517	}
   518	
   519	function computeDiffStats(projectRoot: string): { fileCount: number; totalLines: number; hadBinary: boolean } {
   520	  let hadBinary = false
   521	  let totalLines = 0
   522	  const fileSet = new Set<string>()
   523	
   524	  const addNumstat = (cmd: string) => {
   525	    try {
   526	      const out = sh(cmd, projectRoot).trimEnd()
   527	      if (!out) return
   528	      for (const line of out.split('\n')) {
   529	        const [a, d, f] = line.split('\t')
   530	        if (!f) continue
   531	        fileSet.add(f)
   532	        if (a === '-' || d === '-') {
   533	          hadBinary = true
   534	          continue
   535	        }
   536	        totalLines += (Number(a) || 0) + (Number(d) || 0)
   537	      }
   538	    } catch {
   539	      // ignore
   540	    }
   541	  }
   542	
   543	  addNumstat('git diff --numstat')
   544	  addNumstat('git diff --cached --numstat')
   545	
   546	  try {
   547	    const untracked = sh('git ls-files --others --exclude-standard', projectRoot).trimEnd()
   548	    if (untracked) {
   549	      for (const f of untracked.split('\n').filter(Boolean)) {
   550	        fileSet.add(f)
   551	        try {
   552	          const full = path.join(projectRoot, f)
   553	          const content = fs.readFileSync(full, 'utf8')
   554	          totalLines += content.split('\n').length
   555	        } catch {
   556	          hadBinary = true
   557	        }
   558	      }
   559	    }
   560	  } catch {
   561	    // ignore
   562	  }
   563	
   564	  return { fileCount: fileSet.size, totalLines, hadBinary }
   565	}
   566	
   567	function getDiffStatText(projectRoot: string): string {
   568	  try {
   569	    return sh('git diff --stat', projectRoot).trimEnd() + '\n'
   570	  } catch {
   571	    return ''
   572	  }
   573	}
   574	
   575	function getChangedFiles(projectRoot: string): { files: string[]; untracked: Set<string> } {
   576	  const untracked = new Set<string>()
   577	  try {
   578	    const out = sh('git status --porcelain', projectRoot).trimEnd()
   579	    if (!out) return { files: [], untracked }
   580	
   581	    const files = new Set<string>()
   582	    for (const line of out.split('\n')) {
   583	      const trimmed = line.trimEnd()
   584	      if (trimmed.length < 4) continue
   585	      const xy = trimmed.slice(0, 2)
   586	      let file = trimmed.slice(3)
   587	      const arrow = file.indexOf('->')
   588	      if (arrow !== -1) file = file.slice(arrow + 2).trim()
   589	      files.add(file)
   590	      if (xy === '??') untracked.add(file)
   591	    }
   592	    return { files: [...files], untracked }
   593	  } catch {
   594	    return { files: [], untracked }
   595	  }
   596	}
   597	
   598	function effectiveForbidden(task: Task): string[] {
   599	  return [...new Set([...BASELINE_FORBIDDEN, ...(task.scope?.forbidden ?? [])])]
   600	}
   601	
   602	function snapshotRollbackArtifacts(projectRoot: string, historyDir: string, tag: string): string {
   603	  const folder = `${tsCompact()}-${tag}`
   604	  const base = path.join(historyDir, 'rollback', folder)
   605	  ensureDir(base)
   606	
   607	  let diff = ''
   608	  let cached = ''
   609	  let untracked = ''
   610	  try { diff = sh('git diff', projectRoot) } catch { diff = '' }
   611	  try { cached = sh('git diff --cached', projectRoot) } catch { cached = '' }
   612	  try { untracked = sh('git ls-files --others --exclude-standard', projectRoot) } catch { untracked = '' }
   613	
   614	  fs.writeFileSync(path.join(base, 'diff.patch'), diff)
   615	  fs.writeFileSync(path.join(base, 'cached.patch'), cached)
   616	  fs.writeFileSync(path.join(base, 'untracked.txt'), untracked)
   617	
   618	  return base
   619	}
   620	
   621	function rollbackToLkg(state: State, projectRoot: string, historyDir: string, tag: string): { ok: boolean; patchDir: string } {
   622	  const patchDir = snapshotRollbackArtifacts(projectRoot, historyDir, tag)
   623	  const lkg = state.git?.lkg
   624	  if (!lkg) return { ok: false, patchDir }
   625	  try {
   626	    sh(`git reset --hard ${lkg}`, projectRoot)
   627	    if (state.config?.safety?.cleanUntrackedOnRollback) {
   628	      sh('git clean -fd', projectRoot)
   629	    }
   630	    return { ok: true, patchDir }
   631	  } catch {
   632	    return { ok: false, patchDir }
   633	  }
   634	}
   635	
   636	function enforceScopeAndForbidden(
   637	  task: Task,
   638	  state: State,
   639	  projectRoot: string,
   640	  workspaceDir: string,
   641	  historyDir: string
   642	): { ok: boolean; violations?: string[]; rollback_patch_dir?: string } {
   643	  const { files, untracked } = getChangedFiles(projectRoot)
   644	  if (files.length === 0) return { ok: true }
   645	
   646	  const workspaceRel = path.relative(projectRoot, workspaceDir)
   647	  const filteredFiles = files.filter(f => !isWorkspaceOperationalPath(f, workspaceRel))
   648	  if (filteredFiles.length === 0) return { ok: true }
   649	
   650	  const forb = effectiveForbidden(task)
   651	  const violations: string[] = []
   652	  const forbiddenFiles: string[] = []
   653	
   654	  for (const f of filteredFiles) {
   655	    for (const p of forb) {
   656	      if (matchGlob(f, p)) {
   657	        violations.push(`FORBIDDEN: ${f} matches ${p}`)
   658	        forbiddenFiles.push(f)
   659	        break
   660	      }
   661	    }
   662	
   663	    const allowedPrefixes = task.scope?.allowed ?? []
   664	    if (!isAllowedByPrefixes(f, allowedPrefixes)) {
   665	      violations.push(`NOT ALLOWED: ${f} outside scope ${allowedPrefixes.join(', ')}`)
   666	    }
   667	  }
   668	
   669	  if (violations.length === 0) return { ok: true }
   670	  const rb = rollbackToLkg(state, projectRoot, historyDir, 'scope-or-forbidden')
   671	
   672	  const forbiddenUntracked = forbiddenFiles.filter(f => untracked.has(f))
   673	  if (forbiddenUntracked.length > 0) {
   674	    const quoted = forbiddenUntracked.map(f => `"${f.replace(/"/g, '')}"`).join(' ')
   675	    try {
   676	      sh(`git clean -fd -- ${quoted}`, projectRoot)
   677	    } catch {
   678	      // ignore
   679	    }
   680	  }
   681	
   682	  return { ok: false, violations, rollback_patch_dir: rb.patchDir }
   683	}
   684	
   685	function runCommandGroup(projectRoot: string, historyDir: string, group: string, commands: string[], timeout: number, log: (msg: string) => void): boolean {
   686	  if (commands.length === 0) return true
   687	  log(`🧪 Verifying (${group})...`)
   688	  let i = 0
   689	  for (const cmd of commands) {
   690	    const label = `${group}-${String(i).padStart(2, '0')}.txt`
   691	    try {
   692	      const out = sh(`${cmd} 2>&1`, projectRoot, { timeout, stdio: 'pipe', encoding: 'utf8' })
   693	      fs.writeFileSync(path.join(historyDir, 'verify', label), out)
   694	      if (out) process.stdout.write(out)
   695	      log(`  ✓ ${cmd}`)
   696	    } catch (e: any) {
   697	      const out =
   698	        (e?.stdout?.toString?.() ?? '') +
   699	        (e?.stderr?.toString?.() ?? '') +
   700	        (e?.message ? `\n${String(e.message)}\n` : '')
   701	      fs.writeFileSync(path.join(historyDir, 'verify', label), out)
   702	      if (out) process.stdout.write(out)
   703	      log(`  ✗ ${cmd}`)
   704	      return false
   705	    }
   706	    i++
   707	  }
   708	  return true
   709	}
   710	
   711	function getOriginDefaultBranch(projectRoot: string): string | null {
   712	  try {
   713	    const ref = sh('git symbolic-ref refs/remotes/origin/HEAD', projectRoot).trim()
   714	    const m = ref.match(/refs\/remotes\/origin\/(.+)$/)
   715	    return m ? m[1] : null
   716	  } catch {
   717	    return null
   718	  }
   719	}
   720	
   721	function isDirty(projectRoot: string): boolean {
   722	  try {
   723	    return sh('git status --porcelain', projectRoot).trim().length > 0
   724	  } catch {
   725	    return false
   726	  }
   727	}
   728	
   729	function getBranch(projectRoot: string): string | null {
   730	  try {
   731	    const b = sh('git rev-parse --abbrev-ref HEAD', projectRoot).trim()
   732	    return b === 'HEAD' ? null : b
   733	  } catch {
   734	    return null
   735	  }
   736	}
   737	
   738	function ensureSessionBranchOrBlock(projectRoot: string, state: State, statePath: string, block: (reason: string, action: string, extra?: any) => void, snapshotText: (label: string, content: string) => void, log: (msg: string) => void): boolean {
   739	  const originDefault = getOriginDefaultBranch(projectRoot)
   740	  const current = getBranch(projectRoot)
   741	  if (!current) {
   742	    block('Detached HEAD', 'git checkout -b pilot/session-YYYYMMDD-HHMM')
   743	    return false
   744	  }
   745	
   746	  const defaultCandidates = new Set<string>(['main', 'master'])
   747	  if (originDefault) defaultCandidates.add(originDefault)
   748	
   749	  const treatAsDefault = originDefault ? current === originDefault : defaultCandidates.has(current)
   750	  if (!treatAsDefault) return true
   751	
   752	  if (isDirty(projectRoot)) {
   753	    const allowDirty = state.config?.safety?.allowDirtyWorkspace === true
   754	    if (allowDirty) {
   755	      // Skip dirty block; still create session branch below
   756	      log(`⚠️  Working tree dirty on ${current} (allowDirtyWorkspace=true, proceeding)`)
   757	    } else if (process.env.PILOT_AUTOSTASH === '1') {
   758	      try {
   759	        const msg = `pilot autostash ${state.run?.id ?? ''}`.trim()
   760	        sh(`git stash push -u -m "${msg.replace(/"/g, '')}"`, projectRoot)
   761	      } catch {
   762	        block(`Working tree dirty on ${current}`, 'git stash -u')
   763	        return false
   764	      }
   765	    } else {
   766	      // Provide a one-liner action to flip allowDirtyWorkspace in STATE.json
   767	      const escaped = statePath.replace(/'/g, "\\'")
   768	      const oneLiner = `node -e "const fs=require('fs'),p='${escaped}',s=JSON.parse(fs.readFileSync(p,'utf8'));s.config=s.config||{};s.config.safety=s.config.safety||{};s.config.safety.allowDirtyWorkspace=true;fs.writeFileSync(p,JSON.stringify(s,null,2));" && echo 'Set allowDirtyWorkspace=true, rerun: pilot run --once'`
   769	      block(`Working tree dirty on ${current}`, oneLiner)
   770	      return false
   771	    }
   772	  }
   773	
   774	  const base = `pilot/session-${tsMinute()}`
   775	  const tryNames = [base, `${base}-${randomId(4)}`]
   776	  for (const name of tryNames) {
   777	    try {
   778	      sh(`git checkout -b "${name}"`, projectRoot)
   779	      snapshotText('git-branch.txt', name + '\n')
   780	      log(`🌿 Switched to ${name}`)
   781	      return true
   782	    } catch {
   783	      // next
   784	    }
   785	  }
   786	  block('Failed to create session branch', 'git checkout -b pilot/session-YYYYMMDD-HHMM', { error: 'git checkout -b failed' })
   787	  return false
   788	}
   789	
   790	function checkUpgradeOrBlock(workspaceDir: string, state: State, block: (reason: string, action: string, extra?: any) => void): boolean {
   791	  const expected = readJson<Manifest>(path.join(TEMPLATES_DIR, 'MANIFEST.json'))
   792	  if (!expected) return true
   793	  const current = readJson<Manifest>(path.join(workspaceDir, 'MANIFEST.json'))
   794	  if (!current) {
   795	    block('Pilot workspace out of date (missing MANIFEST.json)', 'pilot upgrade')
   796	    return false
   797	  }
   798	  if (semverLt(current.pilotFolderVersion, expected.pilotFolderVersion)) {
   799	    block(`Pilot workspace out of date (${current.pilotFolderVersion} < ${expected.pilotFolderVersion})`, 'pilot upgrade')
   800	    return false
   801	  }
   802	  return true
   803	}
   804	
   805	export async function runPilot(opts: RunOptions = {}) {
   806	  const workspaceDir = resolveWorkspaceDir(opts.workspaceDir)
   807	  // Workspace dir is the anchor for git detection. The actual git root is resolved after preflight.
   808	  // This prevents false "Not a git repository" blocks when the caller runs from outside the repo.
   809	  let projectRoot = workspaceDir
   810	
   811	  const PATHS = {
   812	    state: path.join(workspaceDir, 'STATE.json'),
   813	    task: path.join(workspaceDir, 'TASK.json'),
   814	    report: path.join(workspaceDir, 'REPORT.json'),
   815	    roadmap: path.join(workspaceDir, 'ROADMAP.json'),
   816	    blocked: path.join(workspaceDir, 'BLOCKED.json'),
   817	    context: path.join(workspaceDir, 'CONTEXT.json'),
   818	    recent: path.join(workspaceDir, 'RECENT.json'),
   819	    manifest: path.join(workspaceDir, 'MANIFEST.json'),
   820	    log: path.join(workspaceDir, 'run.log'),
   821	    tmpDir: path.join(workspaceDir, '.tmp'),
   822	    historyDir: path.join(workspaceDir, 'history'),
   823	  }
   824	
   825	  rotateLogIfNeeded(PATHS.log)
   826	
   827	  const log = (msg: string) => {
   828	    const ts = new Date().toISOString().slice(0, 19).replace('T', ' ')
   829	    const line = `[${ts}] ${msg}`
   830	    console.log(line)
   831	    try {
   832	      ensureDir(path.dirname(PATHS.log))
   833	      fs.appendFileSync(PATHS.log, line + '\n')
   834	    } catch {
   835	      // ignore
   836	    }
   837	  }
   838	
   839	  const notify = (title: string, msg: string) => {
   840	    log(`⚠️  ${title}: ${msg}`)
   841	    try {
   842	      execSync(
   843	        `terminal-notifier -title "Pilot: ${title}" -message "${msg.replace(/"/g, '\\"')}" -sound default`,
   844	        { stdio: 'pipe' }
   845	      )
   846	    } catch {
   847	      // ignore
   848	    }
   849	  }
   850	
   851	  const runId = `run-${tsCompact()}-${randomId(6)}`
   852	  const runHistoryDir = path.join(PATHS.historyDir, `${tsCompact()}-${runId}`)
   853	  ensureDir(PATHS.tmpDir)
   854	  ensureDir(PATHS.historyDir)
   855	  ensureDir(runHistoryDir)
   856	  ensureDir(path.join(runHistoryDir, 'verify'))
   857	
   858	  const snapshotFile = (label: string, filePath: string) => {
   859	    try {
   860	      if (!fs.existsSync(filePath)) return
   861	      const dest = path.join(runHistoryDir, label)
   862	      ensureDir(path.dirname(dest))
   863	      fs.copyFileSync(filePath, dest)
   864	    } catch {
   865	      // ignore
   866	    }
   867	  }
   868	
   869	  const snapshotText = (label: string, content: string) => {
   870	    try {
   871	      const dest = path.join(runHistoryDir, label)
   872	      ensureDir(path.dirname(dest))
   873	      fs.writeFileSync(dest, content)
   874	    } catch {
   875	      // ignore
   876	    }
   877	  }
   878	
   879	  const block = (reason: string, action: string, extra?: any) => {
   880	    const payload = {
   881	      reason,
   882	      action,
   883	      run: {
   884	        id: runId,
   885	        history_dir: path.relative(projectRoot, runHistoryDir),
   886	      },
   887	      ...extra,
   888	    }
   889	    snapshotFile('STATE.json', PATHS.state)
   890	    snapshotFile('TASK.json', PATHS.task)
   891	    snapshotFile('REPORT.json', PATHS.report)
   892	    writeJsonAtomic(PATHS.blocked, payload)
   893	    notify('Blocked', reason)
   894	  }
   895	
   896	  if (!fs.existsSync(PATHS.state)) {
   897	    block('Missing pilot/STATE.json', 'pilot init')
   898	    return
   899	  }
   900	
   901	  const parsedState = readJson<State>(PATHS.state)
   902	  if (!parsedState) {
   903	    block('Invalid STATE.json', `cat "${PATHS.state}"`)
   904	    return
   905	  }
   906	
   907	  let state: State = parsedState
   908	
   909	  state.run = {
   910	    id: runId,
   911	    started_at: Date.now(),
   912	    history_dir: path.relative(projectRoot, runHistoryDir),
   913	  }
   914	  writeJsonAtomic(PATHS.state, state)
   915	
   916	  snapshotFile('startup/STATE.json', PATHS.state)
   917	  snapshotFile('startup/ROADMAP.json', PATHS.roadmap)
   918	
   919	  if (!checkUpgradeOrBlock(workspaceDir, state, block)) {
   920	    state.status = 'waiting_human'
   921	    writeJsonAtomic(PATHS.state, state)
   922	    return
   923	  }
   924	
   925	  // Preflight (deterministic)
   926	  try {
   927	    sh('git rev-parse --is-inside-work-tree', workspaceDir)
   928	    projectRoot = sh('git rev-parse --show-toplevel', workspaceDir).trim()
   929	  } catch {
   930	    block('Not a git repository', 'git init')
   931	    state.status = 'waiting_human'
   932	    writeJsonAtomic(PATHS.state, state)
   933	    return
   934	  }
   935	
   936	  let head: string | null = null
   937	  try {
   938	    head = sh('git rev-parse HEAD', projectRoot).trim()
   939	  } catch {
   940	    head = null
   941	  }
   942	  if (!head) {
   943	    block('No commits yet (needed for rollback/LKG)', 'git commit --allow-empty -m "pilot: init"')
   944	    state.status = 'waiting_human'
   945	    writeJsonAtomic(PATHS.state, state)
   946	    return
   947	  }
   948	  if (!state.git.lkg) state.git.lkg = head
   949	
   950	  try {
   951	    if (OPENCODE_BIN.includes('/')) {
   952	      sh(`test -x "${OPENCODE_BIN.replace(/"/g, '')}"`, projectRoot)
   953	    } else {
   954	      sh(`command -v ${OPENCODE_BIN}`, projectRoot)
   955	    }
   956	  } catch {
   957	    block(`${OPENCODE_BIN} not found`, 'Install OpenCode CLI (opencode) from https://opencode.ai/install, then rerun: pilot run --once')
   958	    state.status = 'waiting_human'
   959	    writeJsonAtomic(PATHS.state, state)
   960	    return
   961	  }
   962	  try {
   963	    if (CURSOR_BIN.includes('/')) {
   964	      sh(`test -x "${CURSOR_BIN.replace(/"/g, '')}"`, projectRoot)
   965	    } else {
   966	      sh(`command -v ${CURSOR_BIN}`, projectRoot)
   967	    }
   968	  } catch {
   969	    if (CURSOR_BIN === DEFAULT_CURSOR_BIN) {
   970	      block(
   971	        'cursor-agent not found',
   972	        'Install Cursor Agent CLI (cursor-agent) from https://cursor.com/install OR set PILOT_CURSOR_BIN to a custom builder command, then rerun: pilot run --once'
   973	      )
   974	    } else {
   975	      block(
   976	        `${CURSOR_BIN} not found`,
   977	        'Install Cursor Agent CLI (cursor-agent) from https://cursor.com/install OR set PILOT_CURSOR_BIN to a custom builder command, then rerun: pilot run --once'
   978	      )
   979	    }
   980	    state.status = 'waiting_human'
   981	    writeJsonAtomic(PATHS.state, state)
   982	    return
   983	  }
   984	
   985	  if (!ensureSessionBranchOrBlock(projectRoot, state, PATHS.state, (r: string, a: string, e?: any) => {
   986	    block(r, a, e)
   987	    state.status = 'waiting_human'
   988	    writeJsonAtomic(PATHS.state, state)
   989	  }, snapshotText, log)) {
   990	    return
   991	  }
   992	
   993	  // Startup reconcile
   994	  if (fs.existsSync(PATHS.report)) {
   995	    const report = readJson<Report>(PATHS.report)
   996	    if (!state.current_task || (report && report.task_id !== state.current_task)) {
   997	      snapshotFile(`startup/${tsCompact()}-REPORT.json`, PATHS.report)
   998	      fs.unlinkSync(PATHS.report)
   999	    }
  1000	  }
  1001	  if (state.task_started_at && !fs.existsSync(PATHS.report) && fs.existsSync(PATHS.task)) {
  1002	    const task = readJson<Task>(PATHS.task)
  1003	    if (task && task.status === 'in_progress') {
  1004	      snapshotFile(`startup/${tsCompact()}-TASK.json`, PATHS.task)
  1005	      task.status = 'ready'
  1006	      writeJsonAtomic(PATHS.task, task)
  1007	      state.task_started_at = null
  1008	      writeJsonAtomic(PATHS.state, state)
  1009	    }
  1010	  }
  1011	  if (!fs.existsSync(PATHS.task) && fs.existsSync(PATHS.roadmap)) {
  1012	    const roadmap = readJson<any[]>(PATHS.roadmap)
  1013	    if (roadmap && roadmap.length > 0) {
  1014	      const first = { ...roadmap[0], status: 'ready' }
  1015	      writeJsonAtomic(PATHS.task, first)
  1016	    }
  1017	  }
  1018	
  1019	  const runOnce = !!opts.runOnce || process.env.PILOT_RUN_ONCE === '1'
  1020	
  1021	  let warnedUnqualifiedModel = false
  1022	
  1023	  let busy = false
  1024	
  1025	  const runBuilderViaCursor = (promptPath: string): { ok: boolean; error?: string; transport?: PromptTransport } => {
  1026	    const mode = state.config?.tools?.cursor?.mode ?? 'prompt-file'
  1027	    try {
  1028	      if (mode === 'stdin') {
  1029	        sh(`${CURSOR_BIN} --force < "${promptPath}"`, projectRoot, { timeout: state.config.builderTimeout, stdio: 'inherit' })
  1030	        return { ok: true, transport: 'stdin' }
  1031	      }
  1032	      sh(`${CURSOR_BIN} --prompt-file "${promptPath}" --force`, projectRoot, { timeout: state.config.builderTimeout, stdio: 'inherit' })
  1033	      return { ok: true, transport: 'prompt-file' }
  1034	    } catch (e: any) {
  1035	      const errorMsg = e?.stderr?.toString?.() || e?.message || 'Unknown error'
  1036	      if (mode === 'prompt-file' && /unknown option|unknown flag|unrecognized option|prompt-file/i.test(errorMsg)) {
  1037	        return { ok: false, error: `${CURSOR_BIN} does not support --prompt-file` }
  1038	      }
  1039	      return { ok: false, error: errorMsg }
  1040	    }
  1041	  }
  1042	
  1043	  const runBuilder = (task: Task): boolean => {
  1044	    log(`🔨 Builder: ${task.id} - ${task.title}`)
  1045	    const promptTplPath = getPromptPath(workspaceDir, 'build')
  1046	    const basePrompt = fs.readFileSync(promptTplPath, 'utf8')
  1047	    const fullPrompt = `${basePrompt}\n\n---\n\n## TASK.json:\n\n\`\`\`json\n${JSON.stringify(task, null, 2)}\n\`\`\`\n\nExecute now.\n`
  1048	    const promptPath = path.join(PATHS.tmpDir, `${runId}.build.prompt.md`)
  1049	    writeTextAtomic(promptPath, fullPrompt)
  1050	
  1051	    const builder = state.config?.tools?.builder ?? 'cursor'
  1052	    if (builder !== 'cursor') {
  1053	      block(`Unsupported builder tool: ${builder}`, `Edit ${PATHS.state} config.tools.builder to "cursor"`)
  1054	      state.status = 'waiting_human'
  1055	      writeJsonAtomic(PATHS.state, state)
  1056	      return false
  1057	    }
  1058	
  1059	    const res = runBuilderViaCursor(promptPath)
  1060	    if (res.ok) {
  1061	      state.config.capabilities = { ...(state.config.capabilities ?? {}), promptTransport: res.transport ?? 'prompt-file' }
  1062	      writeJsonAtomic(PATHS.state, state)
  1063	      log('✓ Builder finished')
  1064	      return true
  1065	    }
  1066	
  1067	    const errorMsg = res.error ?? 'Unknown error'
  1068	    if (res.error === `${CURSOR_BIN} does not support --prompt-file`) {
  1069	      block(`${CURSOR_BIN} does not support --prompt-file`, `${CURSOR_BIN} --help`, { error: errorMsg })
  1070	      state.status = 'waiting_human'
  1071	      writeJsonAtomic(PATHS.state, state)
  1072	      return false
  1073	    }
  1074	    if (isAuthError(errorMsg)) {
  1075	      block(`Authentication required (${CURSOR_BIN})`, `${CURSOR_BIN} auth`, { error: errorMsg })
  1076	      state.status = 'waiting_human'
  1077	      writeJsonAtomic(PATHS.state, state)
  1078	      return false
  1079	    }
  1080	
  1081	    // Write REPORT on failure if not written
  1082	    if (!fs.existsSync(PATHS.report)) {
  1083	      writeJsonAtomic(PATHS.report, {
  1084	        task_id: task.id,
  1085	        status: /timed out|timeout/i.test(errorMsg) ? 'timeout' : 'failed',
  1086	        summary: ['Builder failed'],
  1087	        error: truncate(String(errorMsg), 2000),
  1088	        partial_progress: 'Check git status/diff for any partial changes',
  1089	        files_changed: [],
  1090	        questions: [],
  1091	      })
  1092	    }
  1093	    return false
  1094	  }
  1095	
  1096	  const validateOrchestratorOutput = (parsed: any): { valid: boolean; error?: string } => {
  1097	    if (!parsed || typeof parsed !== 'object') return { valid: false, error: 'Output is not an object' }
  1098	    if (!parsed.status || typeof parsed.status !== 'string') return { valid: false, error: 'Missing or invalid status string' }
  1099	    if (parsed.status !== 'ok' && parsed.status !== 'blocked' && parsed.status !== 'error') {
  1100	      return { valid: false, error: 'Invalid status value' }
  1101	    }
  1102	    if (parsed.writes !== undefined && (!parsed.writes || typeof parsed.writes !== 'object' || Array.isArray(parsed.writes))) {
  1103	      return { valid: false, error: 'Missing or invalid writes object' }
  1104	    }
  1105	
  1106	    // normalize notes
  1107	    if (parsed.notes === undefined) {
  1108	      parsed.notes = []
  1109	    } else if (typeof parsed.notes === 'string') {
  1110	      parsed.notes = [parsed.notes]
  1111	    } else if (Array.isArray(parsed.notes)) {
  1112	      if (parsed.notes.some((n: any) => typeof n !== 'string')) {
  1113	        return { valid: false, error: 'Invalid notes' }
  1114	      }
  1115	    } else {
  1116	      return { valid: false, error: 'Invalid notes' }
  1117	    }
  1118	
  1119	    return { valid: true }
  1120	  }
  1121	
  1122	  const runOrchestrator = async (report: Report): Promise<boolean> => {
  1123	    log(`🎯 Orchestrator (${state.config.orchestratorModel})`)
  1124	
  1125	    const task = readValidatedJson<Task>(state, PATHS.task, 'TASK.json', validateTaskShape, snapshotFile, (r, a, e) => {
  1126	      block(r, a, e)
  1127	      state.status = 'waiting_human'
  1128	      writeJsonAtomic(PATHS.state, state)
  1129	    })
  1130	    if (!task) return false
  1131	
  1132	    const roadmap = readValidatedJson<any[]>(state, PATHS.roadmap, 'ROADMAP.json', validateRoadmapShape, snapshotFile, (r, a, e) => {
  1133	      block(r, a, e)
  1134	      state.status = 'waiting_human'
  1135	      writeJsonAtomic(PATHS.state, state)
  1136	    }) ?? []
  1137	    if (fs.existsSync(PATHS.blocked)) return false
  1138	
  1139	    const context = buildContextBundle(runId, state, task, report ?? null, roadmap, projectRoot, PATHS.recent)
  1140	    writeJsonAtomic(PATHS.context, context)
  1141	    snapshotFile(`context/${tsCompact()}-CONTEXT.json`, PATHS.context)
  1142	
  1143	    let stdout = ''
  1144	    try {
  1145	      const orchPromptPath = getPromptPath(workspaceDir, 'orchestrate')
  1146	
  1147	      const configuredModel = String(state.config.orchestratorModel || '').trim()
  1148	      const modelArg = configuredModel.includes('/') ? ` --model "${configuredModel}"` : ''
  1149	      if (configuredModel && !configuredModel.includes('/') && !warnedUnqualifiedModel) {
  1150	        warnedUnqualifiedModel = true
  1151	        log(`⚠️  Ignoring unqualified orchestratorModel: ${configuredModel}`)
  1152	      }
  1153	
  1154	      stdout = sh(
  1155	        // IMPORTANT (A1): no dynamic prompt content in argv. Only constant message + file paths.
  1156	        // IMPORTANT: opencode run positionals are the message; use `--` to prevent yargs from
  1157	        // consuming the message as an extra --file entry.
  1158	        `${OPENCODE_BIN} run --print-logs --log-level ERROR${modelArg} --format json --file "${orchPromptPath}" --file "${PATHS.context}" -- "${ORCH_INLINE_MESSAGE}"`,
  1159	        projectRoot,
  1160	        { timeout: state.config.orchestratorTimeout, stdio: 'pipe', encoding: 'utf8' }
  1161	      )
  1162	    } catch (e: any) {
  1163	      const err = e?.stderr?.toString?.() || e?.message || 'Unknown error'
  1164	      if (/unknown option|unknown flag|unrecognized option|--file/i.test(err)) {
  1165	        const rb = rollbackToLkg(state, projectRoot, runHistoryDir, 'orchestrator-unsupported')
  1166	        block(`${OPENCODE_BIN} does not support file attachments (--file)`, `${OPENCODE_BIN} upgrade`, {
  1167	          error: err,
  1168	          rollback_patch_dir: rb.patchDir,
  1169	        })
  1170	        state.status = 'waiting_human'
  1171	        writeJsonAtomic(PATHS.state, state)
  1172	        return false
  1173	      }
  1174	      if (isAuthError(err)) {
  1175	        block(`Authentication required (${OPENCODE_BIN})`, `${OPENCODE_BIN} auth login`, { error: err })
  1176	        state.status = 'waiting_human'
  1177	        writeJsonAtomic(PATHS.state, state)
  1178	        return false
  1179	      }
  1180	      const rb = rollbackToLkg(state, projectRoot, runHistoryDir, 'orchestrator-run-failed')
  1181	      block('Orchestrator failed to run', `${OPENCODE_BIN} run --help --print-logs`, {
  1182	        error: err,
  1183	        rollback_patch_dir: rb.patchDir,
  1184	      })
  1185	      state.status = 'waiting_human'
  1186	      writeJsonAtomic(PATHS.state, state)
  1187	      return false
  1188	    }
  1189	
  1190	    snapshotText('orchestrator/raw-stdout.txt', stdout)
  1191	    const rawOutPath = path.join(runHistoryDir, 'orchestrator', 'raw-stdout.txt')
  1192	    ensureDir(path.dirname(rawOutPath))
  1193	    fs.writeFileSync(rawOutPath, stdout)
  1194	
  1195	    const trimmed = stdout.trim()
  1196	    let parsed: any
  1197	    try {
  1198	      parsed = JSON.parse(trimmed)
  1199	    } catch {
  1200	      const rb = rollbackToLkg(state, projectRoot, runHistoryDir, 'orchestrator-parse-failed')
  1201	      const first20 = trimmed.split('\n').slice(0, 20).join('\n')
  1202	      block('Orchestrator output was not valid JSON', `cat "${rawOutPath}"`, { first20, rollback_patch_dir: rb.patchDir })
  1203	      state.status = 'waiting_human'
  1204	      writeJsonAtomic(PATHS.state, state)
  1205	      return false
  1206	    }
  1207	
  1208	    const validation = validateOrchestratorOutput(parsed)
  1209	    if (!validation.valid) {
  1210	      const rb = rollbackToLkg(state, projectRoot, runHistoryDir, 'orchestrator-output-rejected')
  1211	      block('Orchestrator output rejected', `cat "${rawOutPath}"`, { error: validation.error, rollback_patch_dir: rb.patchDir })
  1212	      state.status = 'waiting_human'
  1213	      writeJsonAtomic(PATHS.state, state)
  1214	      return false
  1215	    }
  1216	    const writes: Record<string, any> = parsed.writes && typeof parsed.writes === 'object' ? parsed.writes : {}
  1217	
  1218	    // Validate and canonicalize all write keys first
  1219	    const canonicalWrites: Array<{ original: string; canonical: string; patch: any }> = []
  1220	    for (const [filepath, patch] of Object.entries(writes)) {
  1221	      const canonical = canonicalizeWriteKey(filepath)
  1222	      if (!canonical || !ORCHESTRATOR_ALLOWED_WRITES.includes(canonical)) {
  1223	        const rb = rollbackToLkg(state, projectRoot, runHistoryDir, 'orchestrator-forbidden-write')
  1224	        block('Orchestrator output rejected', `cat "${rawOutPath}"`, {
  1225	          error: `Orchestrator attempted forbidden write: ${filepath}`,
  1226	          rollback_patch_dir: rb.patchDir,
  1227	        })
  1228	        state.status = 'waiting_human'
  1229	        writeJsonAtomic(PATHS.state, state)
  1230	        return false
  1231	      }
  1232	      canonicalWrites.push({ original: filepath, canonical, patch })
  1233	    }
  1234	
  1235	    // Apply merge-patch semantics for STATE/TASK; full replace for BLOCKED.
  1236	    for (const { original, canonical, patch } of canonicalWrites) {
  1237	      const destPath =
  1238	        canonical === 'pilot/STATE.json'
  1239	          ? PATHS.state
  1240	          : canonical === 'pilot/TASK.json'
  1241	            ? PATHS.task
  1242	            : PATHS.blocked
  1243	      const destName = path.basename(destPath)
  1244	
  1245	      if (canonical === 'pilot/STATE.json') {
  1246	        const baseState = readJson<any>(PATHS.state) ?? {}
  1247	        const merged = deepMerge(baseState, patch)
  1248	
  1249	        // Runner is source of truth: freeze config + git.
  1250	        merged.config = state.config
  1251	        merged.git = state.git
  1252	
  1253	        const errs = validateStateShape(merged)
  1254	        if (errs.length > 0) {
  1255	          block('Orchestrator output rejected', `cat "${rawOutPath}"`, { error: errs[0] })
  1256	          state.status = 'waiting_human'
  1257	          writeJsonAtomic(PATHS.state, state)
  1258	          return false
  1259	        }
  1260	
  1261	        writeJsonAtomic(destPath, merged)
  1262	        log(`  → patched ${original} => ${destName}`)
  1263	        continue
  1264	      }
  1265	
  1266	      if (canonical === 'pilot/TASK.json') {
  1267	        const baseTask = readJson<any>(PATHS.task) ?? {}
  1268	        const merged = deepMerge(baseTask, patch)
  1269	        const errs = validateTaskShape(merged)
  1270	        if (errs.length > 0) {
  1271	          block('Orchestrator output rejected', `cat "${rawOutPath}"`, { error: errs[0] })
  1272	          state.status = 'waiting_human'
  1273	          writeJsonAtomic(PATHS.state, state)
  1274	          return false
  1275	        }
  1276	        writeJsonAtomic(destPath, merged)
  1277	        log(`  → patched ${original} => ${destName}`)
  1278	        continue
  1279	      }
  1280	
  1281	      if (canonical === 'pilot/BLOCKED.json') {
  1282	        if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
  1283	          block('Orchestrator output rejected', `cat "${rawOutPath}"`, { error: 'pilot/BLOCKED.json must be an object' })
  1284	          state.status = 'waiting_human'
  1285	          writeJsonAtomic(PATHS.state, state)
  1286	          return false
  1287	        }
  1288	        if ('reason' in (patch as any) && typeof (patch as any).reason !== 'string') {
  1289	          block('Orchestrator output rejected', `cat "${rawOutPath}"`, { error: 'BLOCKED.reason must be a string' })
  1290	          state.status = 'waiting_human'
  1291	          writeJsonAtomic(PATHS.state, state)
  1292	          return false
  1293	        }
  1294	        writeJsonAtomic(destPath, patch)
  1295	        log(`  → wrote ${original} => ${destName}`)
  1296	        continue
  1297	      }
  1298	    }
  1299	
  1300	    if (parsed.delete && Array.isArray(parsed.delete)) {
  1301	      for (const filepath of parsed.delete) {
  1302	        const fullPath = filepath.startsWith('/') ? filepath : path.join(projectRoot, filepath)
  1303	        try {
  1304	          fs.unlinkSync(fullPath)
  1305	        } catch {
  1306	          // ignore
  1307	        }
  1308	        log(`  → deleted ${filepath}`)
  1309	      }
  1310	    }
  1311	    log(`✓ ${parsed.status}`)
  1312	    return true
  1313	  }
  1314	
  1315	  const handleTask = async () => {
  1316	    if (busy) return
  1317	    state = readJson<State>(PATHS.state) ?? state
  1318	    if (state.status !== 'active') return
  1319	
  1320	    const task = readValidatedJson<Task>(state, PATHS.task, 'TASK.json', validateTaskShape, snapshotFile, (r, a, e) => {
  1321	      block(r, a, e)
  1322	      state.status = 'waiting_human'
  1323	      writeJsonAtomic(PATHS.state, state)
  1324	    })
  1325	    if (!task) return
  1326	    if (task.status !== 'ready') return
  1327	
  1328	    busy = true
  1329	    try {
  1330	      task.status = 'in_progress'
  1331	      writeJsonAtomic(PATHS.task, task)
  1332	      state.current_task = task.id
  1333	      state.task_started_at = Date.now()
  1334	      writeJsonAtomic(PATHS.state, state)
  1335	      runBuilder(task)
  1336	    } finally {
  1337	      busy = false
  1338	    }
  1339	  }
  1340	
  1341	  const handleReport = async () => {
  1342	    if (busy) return
  1343	    state = readJson<State>(PATHS.state) ?? state
  1344	    if (state.status !== 'active') return
  1345	
  1346	    const report = readValidatedJson<Report>(state, PATHS.report, 'REPORT.json', validateReportShape, snapshotFile, (r, a, e) => {
  1347	      block(r, a, e)
  1348	      state.status = 'waiting_human'
  1349	      writeJsonAtomic(PATHS.state, state)
  1350	    })
  1351	    if (!report) return
  1352	    if (report.task_id !== state.current_task) {
  1353	      snapshotFile(`stale/${tsCompact()}-REPORT.json`, PATHS.report)
  1354	      try { fs.unlinkSync(PATHS.report) } catch {}
  1355	      return
  1356	    }
  1357	
  1358	    busy = true
  1359	    try {
  1360	      state.task_started_at = null
  1361	      writeJsonAtomic(PATHS.state, state)
  1362	
  1363	      const task = readValidatedJson<Task>(state, PATHS.task, 'TASK.json', validateTaskShape, snapshotFile, (r, a, e) => {
  1364	        block(r, a, e)
  1365	        state.status = 'waiting_human'
  1366	        writeJsonAtomic(PATHS.state, state)
  1367	      })
  1368	      if (!task) return
  1369	
  1370	      if (report.status === 'done') {
  1371	        const res = enforceScopeAndForbidden(task, state, projectRoot, workspaceDir, runHistoryDir)
  1372	        if (!res.ok) {
  1373	          block('Scope/forbidden violation', 'Review changed files and adjust scope', {
  1374	            violations: res.violations ?? [],
  1375	            rollback_patch_dir: res.rollback_patch_dir,
  1376	          })
  1377	          state.status = 'waiting_human'
  1378	          writeJsonAtomic(PATHS.state, state)
  1379	          return
  1380	        }
  1381	
  1382	        const maxFiles = state.config?.safety?.largeDiff?.maxFiles ?? 8
  1383	        const maxLines = state.config?.safety?.largeDiff?.maxLines ?? 300
  1384	        const stats = computeDiffStats(projectRoot)
  1385	        if (stats.hadBinary || stats.fileCount > maxFiles || stats.totalLines > maxLines) {
  1386	          if (!state.flags?.allowLargeDiffOnce) {
  1387	            block(
  1388	              'Large diff guardrail (review required)',
  1389	              `node -e "const fs=require('fs');const p='${PATHS.state.replace(/'/g, "\\'")}';const s=JSON.parse(fs.readFileSync(p,'utf8'));s.flags=s.flags||{};s.flags.allowLargeDiffOnce=true;fs.writeFileSync(p,JSON.stringify(s,null,2));"`,
  1390	              { diffstat: getDiffStatText(projectRoot) }
  1391	            )
  1392	            state.status = 'waiting_human'
  1393	            writeJsonAtomic(PATHS.state, state)
  1394	            return
  1395	          }
  1396	          state.flags = state.flags ?? {}
  1397	          state.flags.allowLargeDiffOnce = false
  1398	          writeJsonAtomic(PATHS.state, state)
  1399	        }
  1400	
  1401	        if (!runCommandGroup(projectRoot, runHistoryDir, 'invariants', RUNNER_INVARIANT_VERIFY, state.config.verifyTimeout, log)) {
  1402	          rollbackToLkg(state, projectRoot, runHistoryDir, 'invariant-verify-failed')
  1403	          report.status = 'failed'
  1404	          report.error = 'Runner invariants failed (git diff --check)'
  1405	          writeJsonAtomic(PATHS.report, report)
  1406	          await runOrchestrator(report)
  1407	          return
  1408	        }
  1409	
  1410	        if (!runCommandGroup(projectRoot, runHistoryDir, 'verify', state.config.verifyCommands, state.config.verifyTimeout, log)) {
  1411	          rollbackToLkg(state, projectRoot, runHistoryDir, 'verify-commands-failed')
  1412	          report.status = 'failed'
  1413	          report.error = 'Verification commands failed after task completion'
  1414	          writeJsonAtomic(PATHS.report, report)
  1415	          await runOrchestrator(report)
  1416	          return
  1417	        }
  1418	
  1419	        try {
  1420	          sh('git add -A', projectRoot)
  1421	          const status = sh('git status --porcelain', projectRoot).trim()
  1422	          if (status) {
  1423	            sh(`git commit -m "pilot: ${report.task_id}"`, projectRoot)
  1424	          }
  1425	        } catch {
  1426	          // commit failures are non-fatal; orchestration still proceeds
  1427	        }
  1428	        state.git.lkg = (() => {
  1429	          try { return sh('git rev-parse HEAD', projectRoot).trim() } catch { return state.git.lkg }
  1430	        })()
  1431	        state.retry_count = 0
  1432	        state.last_completed_task = report.task_id
  1433	        writeJsonAtomic(PATHS.state, state)
  1434	
  1435	        updateRecentOnCommit(projectRoot, PATHS.recent, report.task_id, task.title, report.summary, state.git.lkg)
  1436	        await runOrchestrator(report)
  1437	        return
  1438	      }
  1439	
  1440	      if (report.status === 'failed' || report.status === 'timeout') {
  1441	        const res = enforceScopeAndForbidden(task, state, projectRoot, workspaceDir, runHistoryDir)
  1442	        if (!res.ok) {
  1443	          block('Scope/forbidden violation', 'Review changed files and adjust scope', {
  1444	            violations: res.violations ?? [],
  1445	            rollback_patch_dir: res.rollback_patch_dir,
  1446	          })
  1447	          state.status = 'waiting_human'
  1448	          writeJsonAtomic(PATHS.state, state)
  1449	          return
  1450	        }
  1451	
  1452	        rollbackToLkg(state, projectRoot, runHistoryDir, 'report-failed-or-timeout')
  1453	        await runOrchestrator(report)
  1454	        return
  1455	      }
  1456	
  1457	      if (report.status === 'blocked') {
  1458	        await runOrchestrator(report)
  1459	        return
  1460	      }
  1461	    } finally {
  1462	      busy = false
  1463	    }
  1464	  }
  1465	
  1466	  const watchdog = () => {
  1467	    state = readJson<State>(PATHS.state) ?? state
  1468	    if (state.status !== 'active') return
  1469	    if (!state.task_started_at) return
  1470	    const elapsed = Date.now() - state.task_started_at
  1471	    const timeout = state.config.watchdogTimeout
  1472	    if (elapsed > timeout && !fs.existsSync(PATHS.report)) {
  1473	      writeJsonAtomic(PATHS.report, {
  1474	        task_id: state.current_task,
  1475	        status: 'timeout',
  1476	        summary: ['Watchdog: no report received within timeout'],
  1477	        error: `No REPORT.json after ${timeout / 1000}s`,
  1478	        partial_progress: 'Unknown - builder may have crashed or hung',
  1479	        files_changed: [],
  1480	        questions: [],
  1481	      })
  1482	    }
  1483	  }
  1484	
  1485	  if (runOnce) {
  1486	    await handleTask()
  1487	    if (fs.existsSync(PATHS.report)) await handleReport()
  1488	    return
  1489	  }
  1490	
  1491	  watch(workspaceDir, {
  1492	    ignoreInitial: true,
  1493	    ignored: /(overrides|history|\.backup|\.tmp|run\.log|CONTEXT\.json|RECENT\.json)/,
  1494	  }).on('all', (event, filepath) => {
  1495	    if (event === 'unlink') return
  1496	    const file = path.basename(filepath)
  1497	    if (file === 'TASK.json') setTimeout(handleTask, 300)
  1498	    if (file === 'REPORT.json') setTimeout(handleReport, 300)
  1499	    if (file === 'BLOCKED.json' && event === 'add') {
  1500	      const b = readJson<any>(PATHS.blocked)
  1501	      if (b?.reason) log(`🛑 BLOCKED: ${b.reason}`)
  1502	    }
  1503	  })
  1504	
  1505	  setInterval(watchdog, 60000)
  1506	  setTimeout(handleTask, 1200)
  1507	}


---
# FILE: src/shared.ts
---

     1	import * as fs from 'fs'
     2	import * as path from 'path'
     3	import { execSync } from 'child_process'
     4	
     5	export function ensureDir(p: string) {
     6	  fs.mkdirSync(p, { recursive: true })
     7	}
     8	
     9	export function readJson<T>(p: string): T | null {
    10	  try {
    11	    return JSON.parse(fs.readFileSync(p, 'utf8'))
    12	  } catch {
    13	    return null
    14	  }
    15	}
    16	
    17	export function writeJsonAtomic(p: string, data: unknown) {
    18	  ensureDir(path.dirname(p))
    19	  const tmp = `${p}.tmp`
    20	  fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
    21	  fs.renameSync(tmp, p)
    22	}
    23	
    24	export function writeTextAtomic(p: string, content: string) {
    25	  ensureDir(path.dirname(p))
    26	  const tmp = `${p}.tmp`
    27	  fs.writeFileSync(tmp, content)
    28	  fs.renameSync(tmp, p)
    29	}
    30	
    31	export function tsCompact(d = new Date()): string {
    32	  const pad = (n: number) => String(n).padStart(2, '0')
    33	  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
    34	}
    35	
    36	export function tsMinute(d = new Date()): string {
    37	  const pad = (n: number) => String(n).padStart(2, '0')
    38	  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
    39	}
    40	
    41	export function randomId(len = 8): string {
    42	  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    43	  let out = ''
    44	  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)]
    45	  return out
    46	}
    47	
    48	export function truncate(s: string, max = 400): string {
    49	  if (s.length <= max) return s
    50	  return s.slice(0, Math.max(0, max - 3)) + '...'
    51	}
    52	
    53	export function parseSemverCore(v: string): [number, number, number] {
    54	  const core = (v || '').split('-')[0]
    55	  const parts = core.split('.')
    56	  const a = Number(parts[0] || 0)
    57	  const b = Number(parts[1] || 0)
    58	  const c = Number(parts[2] || 0)
    59	  return [Number.isFinite(a) ? a : 0, Number.isFinite(b) ? b : 0, Number.isFinite(c) ? c : 0]
    60	}
    61	
    62	export function semverLt(a: string, b: string): boolean {
    63	  const [am, an, ap] = parseSemverCore(a)
    64	  const [bm, bn, bp] = parseSemverCore(b)
    65	  if (am !== bm) return am < bm
    66	  if (an !== bn) return an < bn
    67	  return ap < bp
    68	}
    69	
    70	export function sh(cmd: string, cwd: string, opts?: { timeout?: number; stdio?: any; encoding?: BufferEncoding }): string {
    71	  return execSync(cmd, {
    72	    cwd,
    73	    timeout: opts?.timeout,
    74	    stdio: opts?.stdio ?? 'pipe',
    75	    encoding: opts?.encoding ?? 'utf8',
    76	    shell: '/bin/bash',
    77	  }) as unknown as string
    78	}


---
# FILE: templates/MANIFEST.json
---

     1	{
     2	  "pilotFolderVersion": "1.3.1-delta",
     3	  "stateSchemaVersion": 2,
     4	  "managedFiles": [
     5	    "gitignore"
     6	  ],
     7	  "hashes": {
     8	    "gitignore": "4367fcaed3a55babae521dccf2ad5fbf2aface4b2da92ac3765c7abdb1a48a7a"
     9	  }
    10	}


---
# FILE: templates/gitignore
---

     1	# Runner-owned artifacts (safe to ignore)
     2	CONTEXT.json
     3	RECENT.json
     4	run.log*
     5	history/
     6	.tmp/
     7	.backup/
     8	
     9	# Runtime state (these are created by the loop)
    10	REPORT.json
    11	BLOCKED.json


---
# FILE: templates/prompts/build.md
---

     1	# Pilot Builder Agent
     2	
     3	You are the Pilot builder agent running headlessly via cursor-agent.
     4	
     5	## Instructions
     6	
     7	1. Read the TASK.json provided below fully
     8	2. Implement exactly what's described in the task
     9	3. CRITICAL: Only modify files within `scope.allowed` paths
    10	4. CRITICAL: Never touch `scope.forbidden` paths
    11	5. Run verification commands if you can (typecheck, test)
    12	
    13	## Context (optional)
    14	
    15	The runner may provide a compact context file at `pilot/CONTEXT.json`. You can read it if needed.
    16	
    17	## Output
    18	
    19	Write `pilot/REPORT.json` atomically (write to `.tmp` first, then rename).


---
# FILE: templates/prompts/orchestrate.md
---

     1	# Pilot Orchestrator
     2	
     3	You are the Pilot orchestrator. Model-agnostic, running headlessly via OpenCode.
     4	
     5	## Your role
     6	
     7	You are the brain. The builder (cursor-agent) is the hands. When hands fail, you rewrite the instructions to make them clearer or simpler. You advance the project forward.
     8	
     9	## Input
    10	
    11	You will receive a single runner-built payload file: `CONTEXT.json`.
    12	
    13	It contains:
    14	- `state_min`: minimal state (NO config)
    15	- `task`: the current TASK.json (full)
    16	- `last_report`: the latest REPORT.json (or null)
    17	- `roadmap_window`: a small window of upcoming roadmap items
    18	- `recent_window`: last completed tasks (small window)
    19	- `constraints`: forbidden globs, allowed writes, diff guardrails
    20	
    21	Do NOT ask for full ROADMAP/STATE/history. If information is missing, make the best deterministic decision using only CONTEXT.json.
    22	
    23	## CRITICAL CONSTRAINTS
    24	
    25	1. You can ONLY write to these files:
    26	   - `pilot/STATE.json` (but NOT the `config` or `git` fields - these are frozen)
    27	   - `pilot/TASK.json`
    28	   - `pilot/BLOCKED.json`
    29	
    30	2. You CANNOT:
    31	   - Write to any file outside `pilot/`
    32	   - Modify `STATE.config` (model, timeouts, verify commands)
    33	   - Modify `STATE.git` (lkg commit)
    34	   - Generate a task with the same ID as `last_completed_task`
    35	
    36	## Actions based on REPORT.status
    37	
    38	Use `CONTEXT.json` as the source of truth for the current status (see `last_report.status`, `state_min`, and `task`).
    39	
    40	### If status === "done"
    41	
    42	1. Update STATE.json:
    43	   - Set `current_task` to next task id from `CONTEXT.roadmap_window.next[0].id` (if present)
    44	   - Reset `retry_count` to 0
    45	   - Update `last_completed_task` to the completed task id
    46	   - Keep `config` and `git` unchanged
    47	2. Find next task from `CONTEXT.roadmap_window.next`
    48	3. Write new `pilot/TASK.json` with that task, set status to "ready"
    49	4. Mark to delete `pilot/REPORT.json`
    50	5. Output status: "ADVANCED: [next_task_id]"
    51	
    52	### If status === "failed" or "timeout"
    53	
    54	The builder couldn't complete the task. Analyze the error and rewrite the task.
    55	
    56	1. Read the `error` and `partial_progress` fields carefully
    57	2. Determine root cause and fix strategy:
    58	   - Task too vague -> add step-by-step instructions
    59	   - Task too large -> split into smaller subtasks
    60	   - Scope too restrictive -> expand allowed scope (never allow secrets)
    61	3. Check STATE.retry_count:
    62	   - If >= 3: Write BLOCKED.json, set STATE.status to "waiting_human"
    63	   - Otherwise: Increment retry_count, write improved TASK.json
    64	4. Write new `pilot/TASK.json` with improved instructions
    65	5. Append " (retry N)" to title
    66	6. Delete `pilot/REPORT.json`
    67	7. Output status: "RETRY: [task_id] - [what you changed]"
    68	
    69	### If status === "blocked"
    70	
    71	Human decision genuinely required.
    72	
    73	1. Write `pilot/BLOCKED.json` with the questions from REPORT
    74	2. Set STATE.status to "waiting_human"
    75	3. Do NOT generate next task
    76	4. Output status: "BLOCKED: human input required"
    77	
    78	### If ROADMAP is empty
    79	
    80	1. Set STATE.status to "complete"
    81	2. Output status: "COMPLETE: all tasks done"
    82	
    83	## Output format
    84	
    85	You MUST output valid JSON only. No explanations, no markdown, no extra text.
    86	
    87	Always return this schema (writes are merge patches):
    88	
    89	```json
    90	{
    91	  "status": "ok",
    92	  "writes": {
    93	    "pilot/STATE.json": { "...patch...": true },
    94	    "pilot/TASK.json": { "...patch...": true }
    95	  },
    96	  "notes": []
    97	}
    98	```
    99	
   100	- `status` is required and must be one of: `ok`, `blocked`, `error`.
   101	- `writes` may be omitted or empty.
   102	- `notes` is optional (string or string[]; prefer string[]).
   103	- Prefer small patches instead of full rewrites.
   104	
   105	## Guardrail awareness
   106	
   107	The runner enforces a large diff guardrail (see `CONTEXT.constraints.diff_guardrail`). Prefer splitting work into smaller tasks to avoid BLOCK.


---
# FILE: tsconfig.json
---

     1	{
     2	  "compilerOptions": {
     3	    "target": "ES2022",
     4	    "module": "NodeNext",
     5	    "moduleResolution": "NodeNext",
     6	    "strict": true,
     7	    "skipLibCheck": true,
     8	    "esModuleInterop": true,
     9	    "resolveJsonModule": true,
    10	    "outDir": "./dist",
    11	    "rootDir": "./src"
    12	  },
    13	  "include": [
    14	    "src/**/*.ts"
    15	  ],
    16	  "exclude": [
    17	    "node_modules",
    18	    "dist"
    19	  ]
    20	}
