// Display interpolation only. Assignment eligibility always uses saved server time.
export function createPracticeClock(now=()=>performance.now()){
 let milliseconds=0,confirmed=0,anchor=now(),running=false;
 const read=()=>milliseconds+(running?Math.min(15000,Math.max(0,now()-anchor)):0);
 const reset=(value=0,active=false)=>{milliseconds=confirmed=Math.max(0,Number(value)||0);anchor=now();running=active;};
 return {reset,confirm(value,active=false){value=Math.max(0,Number(value)||0);if(value<confirmed)return;if(value===confirmed&&active===running)return;reset(value,active);},pause(){milliseconds=read();anchor=now();running=false;},read,seconds(){return Math.floor(read()/1000);},get running(){return running;}};
}
