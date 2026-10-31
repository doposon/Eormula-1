const cards = [
 ['studio','JS Studio',''],
 ['01-alonso','Fernando Alonso','Behind the memes, Fernando Alonso is a two-time F1 World Champion.'],
 ['02-raikkonen','Kimi Räikkönen','They call him “The Iceman.” Kimi Räikkönen became World Champion in 2007—by just one point.'],
 ['03-vettel','Sebastian Vettel','Sebastian Vettel became F1’s youngest World Champion at just 23 years old.'],
 ['04-verstappen','Max Verstappen','Max Verstappen won his first Grand Prix at 18. What were you doing at 18?'],
 ['05-schumacher','Michael Schumacher','Michael Schumacher won seven world titles. One trophy cabinet probably wasn’t enough.'],
 ['06-hamilton','Lewis Hamilton','Lewis Hamilton won the soaking-wet 2008 British Grand Prix by more than a minute. Rain mode: mastered.'],
 ['07-button','Jenson Button','Jenson Button was running last in the 2011 Canadian Grand Prix. He still won the race. Never give up.'],
 ['08-leclerc','Charles Leclerc','Charles Leclerc grew up in Monaco—and finally won his home Grand Prix in 2024.'],
 ['09-ricciardo','Daniel Ricciardo','Daniel Ricciardo celebrates podiums by drinking champagne from his shoe. Yes, his actual racing shoe.'],
 ['10-sainz','Carlos Sainz','Carlos Sainz won the 2024 Australian Grand Prix just weeks after appendix surgery. That’s quite a comeback.']
];
// Host calls this before starting resource requests; the splash is already in static HTML.
export async function createLoadingScreen(root, imageRoot) {
 let index=0, disposed=false, request=0;
 const cache=new Map();
 root.className='loading-story';
 const button=document.createElement('button');button.type='button';button.className='loading-story-card';button.setAttribute('aria-label','Next Formula 1 fun fact');
 const visual=document.createElement('div');visual.className='loading-story-visual';
 const text=document.createElement('p');text.className='loading-story-fact';
 const hint=document.createElement('small');hint.textContent='CLICK FOR ANOTHER F1 FACT';
 button.append(visual,text,hint);
 const footer=document.createElement('div');footer.className='loading-story-footer';
 const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const meter=document.createElement('progress');meter.max=1;meter.value=0;meter.setAttribute('aria-label','Game resource download');
 footer.append(status,meter);root.replaceChildren(button,footer);
 function load(target){
  if(!cache.has(target)){
   const [file,name]=cards[target],img=new Image();img.className='loading-story-image';img.alt=name;
   img.src=new URL(file+'.png?v=media14',imageRoot).href;
   const ready=img.decode().then(()=>img).catch(error=>{cache.delete(target);throw error;});cache.set(target,ready);
  }
  return cache.get(target);
 }
 async function show(){
  const target=index,token=++request;
  try{const img=await load(target);if(disposed||token!==request)return;
   // Replace both in the same task, only after all image pixels are decoded.
   visual.replaceChildren(img);text.textContent=cards[target][2];root.classList.toggle('studio-card',target===0);
   hint.textContent='CLICK FOR ANOTHER F1 FACT';
   load((target+1)%cards.length).catch(()=>{});
  }catch{if(token===request&&!disposed)hint.textContent='PHOTO COULD NOT LOAD · CLICK TO CONTINUE';}
 }
 button.addEventListener('click',()=>{index=(index+1)%cards.length;show();});show();

 return {update(loaded,total,detail=''){if(disposed)return;meter.value=total?Math.min(1,loaded/total):0;status.textContent=`LOADING ${Math.round(meter.value*100)}%${detail?' · '+detail:''}`;},remove(){disposed=true;root.remove();}};
}
