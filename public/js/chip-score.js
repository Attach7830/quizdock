// Original 16-bar adventure themes. No melodies or recordings from other games.
const semitones={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
const note=token=>{
 if(token==='.')return 0;if(token==='-')return -1;
 const match=/^([A-G])([#b]?)([2-7])$/.exec(token);
 if(!match)throw new Error('Invalid chip note: '+token);
 return (+match[3]+1)*12+semitones[match[1]]+(match[2]==='#'?1:match[2]==='b'?-1:0);
};
function theme(title,bpm,root,minor,bars,progression,arp=[0,1,2,1]){
 if(bars.length!==16)throw new Error('Chip themes need 16 bars.');
 const lead=bars.flatMap(bar=>{const notes=bar.split(' ');if(notes.length!==8)throw new Error('Chip bars need 8 eighth notes: '+bar);return notes.map(note);});
 const scale=minor?[0,2,3,5,7,8,10]:[0,2,4,5,7,9,11];
 const chord=degree=>[degree,degree+2,degree+4].map(n=>root+scale[n%7]+12*Math.floor(n/7));
 const chords=progression.map(chord);
 return {title,bpm,lead,chords,bass:chords.map(c=>c[0]-12),arp};
}
export const CHIP_TUNES={
 lobby:theme('Lanterns at the Harbor',108,48,false,[
  'E5 - G5 A5 G5 - D5 E5','C5 - E5 G5 A5 G5 E5 -','F5 A5 C6 - B5 A5 G5 E5','D5 E5 G5 - E5 D5 C5 -',
  'A4 C5 E5 G5 E5 - D5 E5','F5 - E5 D5 C5 D5 E5 G5','B4 D5 G5 A5 B5 - A5 G5','E5 D5 C5 - - - . .',
  'G5 - A5 C6 B5 - G5 E5','A5 G5 E5 C5 D5 E5 G5 -','A5 C6 D6 - C6 A5 G5 E5','G5 - E5 D5 E5 G5 A5 -',
  'C6 B5 A5 G5 E5 - G5 A5','F5 E5 D5 C5 A4 C5 E5 -','D5 G5 B5 D6 C6 B5 A5 G5','E5 D5 C5 - - - . .'
 ],[0,0,3,4,5,3,4,0,0,5,3,4,5,3,4,0]),
 treasure:theme('The Compass Wakes',120,55,false,[
  'B4 D5 G5 - A5 G5 E5 D5','B4 - D5 E5 G5 D5 B4 -','C5 E5 A5 G5 E5 - D5 C5','D5 F#5 A5 - G5 F#5 E5 D5',
  'E5 - G5 B5 A5 G5 E5 D5','C5 D5 E5 G5 A5 - G5 E5','D5 A5 F#5 D5 E5 F#5 G5 A5','B5 A5 G5 - - - . .',
  'D6 B5 A5 G5 B5 - A5 G5','E5 G5 B5 D6 B5 A5 G5 -','C6 B5 A5 E5 G5 A5 C6 -','A5 F#5 D5 F#5 A5 B5 D6 -',
  'B5 G5 E5 - G5 A5 B5 G5','E5 C5 D5 E5 A5 G5 E5 -','F#5 A5 C6 B5 A5 F#5 D5 E5','G5 - B4 D5 G5 - - .'
 ],[0,0,3,4,5,3,4,0,0,5,3,4,5,3,4,0],[0,2,1,2]),
 fishing:theme('Moonlit Current',98,53,false,[
  'A4 - C5 F5 E5 - C5 A4','G4 A4 C5 - A4 G4 F4 -','Bb4 - D5 F5 A5 G5 F5 D5','G5 - E5 C5 D5 E5 F5 -',
  'D5 F5 A5 - G5 F5 D5 A4','Bb4 C5 D5 F5 E5 D5 C5 -','E5 G5 C6 Bb5 G5 E5 D5 C5','A4 - F4 - - - . .',
  'C5 F5 A5 C6 A5 - G5 F5','E5 C5 A4 - C5 D5 E5 G5','F5 Bb5 A5 G5 F5 D5 C5 -','G5 A5 G5 E5 F5 G5 C6 -',
  'A5 - F5 D5 E5 F5 A5 G5','Bb5 A5 F5 D5 C5 D5 F5 -','E5 G5 Bb5 C6 G5 E5 C5 D5','F5 - A4 C5 F5 - - .'
 ],[0,0,3,4,5,3,4,0,0,5,3,4,5,3,4,0],[0,1,2,1,0,2,1,2]),
 battle:theme('Ember Circuit',140,52,true,[
  'E5 B4 E5 G5 F#5 E5 D5 B4','C5 E5 G5 B5 A5 G5 E5 -','D5 A4 D5 F#5 E5 D5 C5 A4','B4 D5 F#5 A5 F#5 - E5 D5',
  'E5 G5 B5 D6 B5 G5 F#5 E5','C6 B5 G5 E5 G5 A5 B5 -','A5 F#5 D5 B4 D5 F#5 A5 F#5','G5 F#5 E5 - E5 - . .',
  'B5 - D6 E6 D6 B5 A5 G5','C6 B5 G5 E5 G5 B5 C6 -','A5 D6 C6 A5 F#5 D5 E5 F#5','B5 A5 F#5 D5 F#5 A5 B5 -',
  'E6 D6 B5 G5 E5 G5 B5 -','C6 A5 G5 E5 C5 E5 G5 A5','F#5 A5 B5 D6 B5 A5 F#5 D5','E5 B4 E5 G5 E5 - - .'
 ],[0,5,6,4,0,5,4,0,0,5,6,4,0,5,4,0],[0,2,1,2]),
 factory:theme('Clockwork Caravan',124,50,false,[
  'F#5 . A5 . F#5 E5 D5 .','E5 F#5 A5 B5 A5 . F#5 E5','G5 . B5 A5 G5 F#5 E5 .','A4 C#5 E5 G5 F#5 E5 D5 .',
  'B4 D5 F#5 A5 F#5 . E5 D5','G5 F#5 E5 D5 E5 G5 A5 .','C#5 E5 A5 B5 C#6 B5 A5 E5','F#5 E5 D5 . D5 . . .',
  'A5 D6 C#6 A5 F#5 . A5 .','B5 A5 F#5 D5 E5 F#5 A5 .','B5 D6 B5 A5 G5 . F#5 E5','C#6 B5 A5 G5 E5 F#5 A5 .',
  'F#5 A5 B5 D6 C#6 B5 A5 .','G5 B5 A5 F#5 E5 G5 B5 .','A5 C#6 E6 D6 C#6 A5 G5 E5','F#5 E5 D5 A4 D5 - . .'
 ],[0,0,3,4,5,3,4,0,0,5,3,4,5,3,4,0],[0,2,1,0]),
 rally:theme('Skyward Postcards',136,57,false,[
  'C#5 E5 A5 - B5 A5 F#5 E5','C#5 E5 F#5 A5 C#6 B5 A5 -','D5 F#5 A5 D6 C#6 A5 F#5 -','B4 E5 G#5 B5 A5 G#5 F#5 E5',
  'F#5 A5 C#6 E6 C#6 A5 F#5 E5','D5 E5 F#5 A5 B5 A5 F#5 -','G#5 B5 E6 D6 B5 G#5 E5 F#5','A5 - C#5 E5 A5 - . .',
  'E6 C#6 B5 A5 C#6 - E6 -','F#6 E6 C#6 A5 B5 C#6 E6 -','D6 C#6 A5 F#5 A5 B5 D6 -','B5 G#5 E5 G#5 B5 C#6 E6 -',
  'C#6 A5 F#5 E5 F#5 A5 C#6 -','D6 B5 A5 F#5 E5 F#5 A5 -','G#5 B5 D6 E6 D6 B5 G#5 E5','A5 E5 C#5 E5 A5 - - .'
 ],[0,0,3,4,5,3,4,0,0,5,3,4,5,3,4,0],[0,1,2,1]),
 keep:theme('The Glass Observatory',104,50,true,[
  'D5 - A4 C5 F5 - E5 D5','C5 E5 G5 - F5 E5 D5 C5','Bb4 D5 F5 A5 G5 F5 D5 -','A4 C5 E5 G5 E5 - D5 C5',
  'D5 F5 A5 C6 A5 F5 E5 D5','Bb5 A5 F5 D5 E5 F5 G5 -','E5 G5 A5 C6 A5 G5 E5 C5','D5 - A4 D5 - - . .',
  'A5 D6 C6 A5 F5 - A5 C6','G5 C6 E6 D6 C6 G5 E5 -','F5 Bb5 D6 F6 D6 Bb5 A5 -','E5 A5 C6 E6 C6 A5 G5 E5',
  'F5 A5 D6 C6 A5 F5 E5 D5','Bb5 A5 G5 F5 D5 F5 A5 -','G5 E5 C5 E5 A5 G5 E5 C5','D5 F5 A5 D6 A5 F5 D5 -'
 ],[0,6,5,4,0,5,4,0,0,6,5,4,0,5,4,0],[0,2,1,2,0,1,2,1]),
 word:theme('Ink Beneath the Stars',112,50,false,[
  'F#5 - E5 D5 A4 - D5 E5','F#5 A5 B5 A5 F#5 - E5 D5','G5 - B5 A5 F#5 E5 D5 -','E5 F#5 A5 G5 E5 - C#5 E5',
  'D5 A4 D5 F#5 A5 - G5 F#5','B5 A5 F#5 E5 D5 E5 F#5 -','G5 A5 B5 D6 C#6 B5 A5 G5','F#5 E5 D5 - - - . .',
  'A5 - F#5 A5 D6 - C#6 B5','A5 F#5 E5 D5 F#5 A5 B5 -','G5 B5 D6 E6 D6 B5 A5 F#5','E5 A5 C#6 B5 A5 G5 E5 -',
  'F#5 A5 D6 - C#6 B5 A5 F#5','G5 F#5 E5 D5 B4 D5 G5 -','E5 F#5 A5 C#6 B5 A5 G5 E5','D5 - A4 F#5 D5 - - .'
 ],[0,5,3,4,0,5,3,4,0,5,3,4,5,3,4,0],[0,2,1,2]),
 sketch:theme('Paper Kites Parade',124,48,false,[
  'G5 E5 C5 E5 G5 - A5 G5','E5 C5 D5 E5 G5 A5 C6 -','A5 F5 D5 F5 A5 - G5 F5','D5 G5 B5 A5 G5 E5 D5 -',
  'E5 G5 C6 B5 A5 - G5 E5','F5 A5 C6 D6 C6 A5 G5 -','G5 B5 D6 C6 B5 G5 E5 D5','C5 E5 G5 C6 - - . .',
  'C6 G5 E5 G5 A5 C6 D6 E6','D6 C6 A5 G5 E5 G5 A5 -','F5 A5 D6 C6 A5 F5 D5 F5','G5 B5 D6 E6 D6 B5 A5 G5',
  'E6 D6 C6 G5 A5 G5 E5 C5','A5 G5 F5 E5 D5 F5 A5 C6','B5 A5 G5 E5 D5 E5 G5 B5','C6 G5 E5 C5 - - . .'
 ],[0,0,3,4,5,3,4,0,0,5,3,4,5,3,4,0],[0,1,2,1])
};

// Each step is a sixteenth note. This same score planner drives playback and
// offline audio checks; sustained notes are not retriggered on every tick.
export function chipFrame(score,step){
 const i=step%256,bar=Math.floor(i/16),within=i%16,chord=score.chords[bar],events=[];
 const add=(note,duration,voice,level)=>events.push({note,duration,voice,level});
 if(i%2===0){const n=Math.floor(i/2),value=score.lead[n];if(value>0){let held=1;while(score.lead[n+held]===-1)held++;add(value,held*2*.9,'lead',within===0?.29:.25);}}
 if(within%4===0||within===6||within===14)add(chord[within===6||within===14?2:0]-12,within%4===0?2.7:1.6,'bass',.34);
 if(within%2===1)add(chord[score.arp[Math.floor(within/2)%score.arp.length]]+12,1.3,'arp',.075);
 if(within===8)add(chord[1]+12,3.2,'harmony',.095);
 if(within===0||within===8)add(30,1.3,'kick',.22);
 if(within===4||within===12)add(0,.9,'snare',.095);
 else if(within%2===1)add(0,.22,'hat',.038);
 return events;
}
