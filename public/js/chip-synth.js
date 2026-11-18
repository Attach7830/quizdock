import {chipFrame} from './chip-score.js';
const pitch=note=>440*2**((note-69)/12);
export function createChipSynth(audio,output){
 const voices=new Set();
 function pulse(duty){
  if(!audio.createPeriodicWave)return null;
  const real=new Float32Array(48),imag=new Float32Array(48);
  for(let n=1;n<48;n++){real[n]=Math.sin(2*Math.PI*n*duty)/(Math.PI*n);imag[n]=(1-Math.cos(2*Math.PI*n*duty))/(Math.PI*n);}
  return audio.createPeriodicWave(real,imag);
 }
 const leadWave=pulse(.25),arpWave=pulse(.125);
 let noise=null;
 if(audio.createBuffer){noise=audio.createBuffer(1,Math.ceil(audio.sampleRate*.16),audio.sampleRate);const samples=noise.getChannelData(0);let bits=0x3fff;for(let i=0;i<samples.length;i++){bits=(bits>>1)|(((bits^(bits>>1))&1)<<14);samples[i]=(bits&1)?1:-1;}}
 function voice(note,at,duration,kind,level){
  const percussion=kind==='snare'||kind==='hat',gain=audio.createGain();let source,filter=null;
  if(percussion&&noise&&audio.createBufferSource){
   source=audio.createBufferSource();source.buffer=noise;
   if(audio.createBiquadFilter){filter=audio.createBiquadFilter();filter.type=kind==='hat'?'highpass':'bandpass';filter.frequency.value=kind==='hat'?6500:2300;filter.Q.value=.7;}
  }else{
   source=audio.createOscillator();source.type=kind==='bass'||kind==='kick'||percussion?'triangle':'square';
   const wave=kind==='lead'?leadWave:kind==='arp'?arpWave:null;if(wave&&source.setPeriodicWave)source.setPeriodicWave(wave);
   source.frequency.setValueAtTime(pitch(percussion?kind==='hat'?90:65:kind==='kick'?note+17:note),at);
   if(kind==='kick')source.frequency.linearRampToValueAtTime(pitch(note),at+Math.min(duration*.75,.09));
  }
  gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(level,at+.004);
  gain.gain.setValueAtTime(level*(percussion?.35:1),at+duration*.55);gain.gain.linearRampToValueAtTime(0,at+duration);
  if(filter){source.connect(filter);filter.connect(gain);}else source.connect(gain);gain.connect(output);voices.add(source);
  source.onended=()=>{voices.delete(source);source.disconnect();gain.disconnect();filter?.disconnect();};
  source.start(at);source.stop(at+duration+.01);
 }
 return {
  play(score,step,at,layers){const tick=15/score.bpm;for(const event of chipFrame(score,step)){if(layers===1&&['harmony','arp','snare'].includes(event.voice)||layers===2&&event.voice==='harmony')continue;voice(event.note,at,event.duration*tick,event.voice,event.level);}},
  cue(correct,score,at){const chord=score.chords[0],notes=correct?[chord[0]+12,chord[1]+12,chord[2]+12,chord[0]+24]:[chord[0]+12,chord[0]+10,chord[0]+7];notes.forEach((n,i)=>voice(n,at+i*.095,.17,correct?'lead':'harmony',correct?.16:.11));},
  stop(){for(const source of voices){try{source.stop();source.disconnect();}catch{}}voices.clear();}
 };
}
