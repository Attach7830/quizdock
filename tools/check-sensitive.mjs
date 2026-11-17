import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
// Print only rule and location; matching credential material never goes to logs.
const rules={privateKey:/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,githubToken:/(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})/,awsKey:/(?:AKIA|ASIA)[A-Z0-9]{16}/,googleSecret:/GOCSPX-[A-Za-z0-9_-]{20,}/,resendKey:/\bre_[A-Za-z0-9]{25,}/,cloudflareSecret:/(?:CLOUDFLARE_API_TOKEN|CF_API_TOKEN)\s*[=:]\s*["']?[A-Za-z0-9_-]{30,}/i};
let findings=[];
for(const file of execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean)){
 if(/(^|\/)(\.env(?:\..*)?|\.dev\.vars(?:\..*)?|[^/]+\.pem)$/.test(file))findings.push({file,rule:'credentialFile'});
 if(/(^|\/)QuizDock-(?:backup-[^/]+|my-data|practice-results|round-[^/]+|\d{6}-round-\d+)\.(?:json|csv)$/i.test(file))findings.push({file,rule:'studentExportFile'});
 if(!fs.existsSync(file))continue;
 const content=fs.readFileSync(file,'utf8');
 for(const [rule,pattern]of Object.entries(rules)){const match=pattern.exec(content);if(match)findings.push({file,rule,line:content.slice(0,match.index).split('\n').length});}
}
if(process.argv.includes('--history')){
 const history=execFileSync('git',['log','--all','--format=','-p','--no-ext-diff'],{encoding:'utf8',maxBuffer:64*1024*1024});let file='';
 for(const line of history.split('\n')){if(line.startsWith('+++ b/'))file=line.slice(6);if(!line.startsWith('+')||line.startsWith('+++'))continue;for(const [rule,pattern]of Object.entries(rules))if(pattern.test(line.slice(1)))findings.push({file,rule,history:true});}
}
findings=[...new Map(findings.map(f=>[JSON.stringify(f),f])).values()];
if(findings.length){process.stderr.write(JSON.stringify({credentialFindings:findings},null,2)+'\n');process.exitCode=1;}else console.log('No credential-pattern matches or tracked credential files found.');
