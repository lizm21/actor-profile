// Uses the signed-in official CloudBase CLI; no credentials are read or printed.
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const cli=process.env.CLOUDBASE_CLI_PATH;
if(!cli)throw new Error('Set CLOUDBASE_CLI_PATH to the installed @cloudbase/cli/bin/tcb');
const result=spawnSync(process.execPath,[cli,'db','execute','-e','codex-d2g25pxe97f6c229f','--sql',readFileSync(process.argv[2],'utf8'),'--json'],{encoding:'utf8',maxBuffer:4*1024*1024});
process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');process.exit(result.status??1);
