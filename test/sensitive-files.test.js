import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
const guard=new URL('../tools/check-sensitive.mjs',import.meta.url).pathname;
test('repository guard allows public OAuth identifiers and blocks credential files, provider keys and private exports without printing their content',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'quizdock-sensitive-test-'));
 try{
  execFileSync('git',['init'],{cwd:dir,stdio:'ignore'});fs.writeFileSync(path.join(dir,'public-config.js'),'export const client="123.public.apps.googleusercontent.com";');execFileSync('git',['add','public-config.js'],{cwd:dir});
  assert.equal(spawnSync(process.execPath,[guard],{cwd:dir,encoding:'utf8'}).status,0);
  const fake='re_'+'x'.repeat(40);fs.writeFileSync(path.join(dir,'unsafe.js'),`const key="${fake}";`);fs.writeFileSync(path.join(dir,'.env'),'EXAMPLE=placeholder');fs.writeFileSync(path.join(dir,'QuizDock-my-data.json'),'{}');execFileSync('git',['add','.'],{cwd:dir});
  const result=spawnSync(process.execPath,[guard],{cwd:dir,encoding:'utf8'});assert.equal(result.status,1);assert.match(result.stderr,/resendKey/);assert.match(result.stderr,/credentialFile/);assert.match(result.stderr,/studentExportFile/);assert.ok(!result.stderr.includes(fake));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
