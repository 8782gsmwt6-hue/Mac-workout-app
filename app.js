import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBb2yWaEoqKs6r9DIry0m_vaEpnM8BgpvA",
  authDomain: "mac-workout.firebaseapp.com",
  projectId: "mac-workout",
  storageBucket: "mac-workout.firebasestorage.app",
  messagingSenderId: "833723483563",
  appId: "1:833723483563:web:da96dbb6e70ac632ecbeee"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

let currentUser = null;
let cloudReady = false;
let syncTimer = null;
let unsubscribeCloud = null;
let applyingRemote = false;
let lastSyncedAt = 0;
const DEVICE_KEY = "macWorkoutDeviceId";
const deviceId = localStorage.getItem(DEVICE_KEY) || crypto.randomUUID();
localStorage.setItem(DEVICE_KEY, deviceId);

function cloudDocRef(uid){
  return doc(db,"users",uid,"apps","macWorkout");
}

function formatTime(timestamp){
  if(!timestamp) return "Never";
  return new Date(timestamp).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"});
}

function setSyncStatus(text,mode=""){
  const header=document.getElementById("syncStatus");
  const settings=document.getElementById("settingsSyncStatus");
  if(header){
    header.textContent=text;
    header.className=`sync-status ${mode}`.trim();
  }
  if(settings) settings.textContent=text;
}

function setLastSynced(timestamp){
  lastSyncedAt=timestamp||Date.now();
  const text=formatTime(lastSyncedAt);
  const header=document.getElementById("lastSyncHeader");
  const settings=document.getElementById("lastSyncText");
  if(header) header.textContent=`Last: ${text}`;
  if(settings) settings.textContent=text;
}

function showAuthMessage(message,isError=true){
  const el=document.getElementById("authMessage");
  if(!el) return;
  el.textContent=message;
  el.style.color=isError?"var(--danger)":"#1b6b3a";
}

function friendlyAuthError(error){
  const code=error?.code||"";
  if(code.includes("invalid-credential")) return "The email or password is incorrect.";
  if(code.includes("email-already-in-use")) return "That email already has an account. Tap Sign in.";
  if(code.includes("weak-password")) return "Use a password with at least 6 characters.";
  if(code.includes("invalid-email")) return "Enter a valid email address.";
  if(code.includes("unauthorized-domain")) return "This website domain is not authorized in Firebase.";
  if(code.includes("too-many-requests")) return "Too many attempts. Wait a little and try again.";
  return "Firebase could not complete that request.";
}

function stateHasUserData(candidate){
  return Object.keys(candidate?.logs||{}).length>0 ||
         Object.keys(candidate?.checkins||{}).length>0 ||
         Object.keys(candidate?.finished||{}).length>0;
}

function applyRemoteState(remote){
  applyingRemote=true;
  state=Object.assign(blankState(),remote||{});state.blockNumber=Number(state.blockNumber)||1;state.archivedBlocks=Array.isArray(state.archivedBlocks)?state.archivedBlocks:[];state.skippedDays=state.skippedDays||{};
  localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
  applyingRemote=false;
  applyStateToUi();
}

async function pushLocalState(force=false){
  if(!currentUser || applyingRemote || (!cloudReady&&!force)) return;
  setSyncStatus("Saving…","warn");
  const writeTime=state.metaUpdatedAt||Date.now();
  await setDoc(cloudDocRef(currentUser.uid),{
    state,
    ownerUid:currentUser.uid,
    clientUpdatedAt:writeTime,
    resetEpoch:Number(state.resetEpoch||0),
    lastDeviceId:deviceId,
    updatedAt:serverTimestamp(),
    schemaVersion:5
  },{merge:true});
  setSyncStatus("Synced","good");
  setLastSynced(Date.now());
}

function scheduleCloudSave(){
  if(!currentUser || applyingRemote) return;
  clearTimeout(syncTimer);
  syncTimer=setTimeout(()=>{
    pushLocalState().catch(()=>setSyncStatus(navigator.onLine?"Sync error":"Offline",navigator.onLine?"bad":"warn"));
  },700);
}

async function reconcileNow(){
  if(!currentUser) return;
  setSyncStatus("Syncing…","warn");
  const snap=await getDoc(cloudDocRef(currentUser.uid));
  if(!snap.exists()){
    await pushLocalState(true);
    cloudReady=true;
    return;
  }
  const data=snap.data();
  const remote=data.state||{};
  const remoteTime=Number(data.clientUpdatedAt||remote.metaUpdatedAt||0);
  const localTime=Number(state.metaUpdatedAt||0);

  if(remoteTime>localTime){
    applyRemoteState(remote);
  }else if(localTime>remoteTime){
    await pushLocalState(true);
  }
  cloudReady=true;
  setSyncStatus("Synced","good");
  setLastSynced(Date.now());
}

function startRealtimeSync(user){
  if(unsubscribeCloud) unsubscribeCloud();
  setSyncStatus("Connecting…","warn");

  unsubscribeCloud=onSnapshot(
    cloudDocRef(user.uid),
    {includeMetadataChanges:true},
    async snapshot=>{
      if(snapshot.metadata.hasPendingWrites) return;

      if(!snapshot.exists()){
        cloudReady=true;
        await pushLocalState(true);
        return;
      }

      const data=snapshot.data();
      const remote=data.state||{};
      const remoteTime=Number(data.clientUpdatedAt||remote.metaUpdatedAt||0);
      const localTime=Number(state.metaUpdatedAt||0);
      const remoteReset=Number(data.resetEpoch||remote.resetEpoch||0);
      const localReset=Number(state.resetEpoch||0);

      if(remoteReset>localReset){
        applyRemoteState(Object.assign(blankState(),remote,{resetEpoch:remoteReset}));
      }else if(localReset>remoteReset){
        await pushLocalState(true);
      }else if(remoteTime>localTime){
        applyRemoteState(remote);
      }else if(localTime>remoteTime && cloudReady){
        scheduleCloudSave();
      }else if(!stateHasUserData(remote) && stateHasUserData(state) && remoteReset===0){
        await pushLocalState(true);
      }

      cloudReady=true;
      setSyncStatus(snapshot.metadata.fromCache&&!navigator.onLine?"Offline":"Synced",snapshot.metadata.fromCache&&!navigator.onLine?"warn":"good");
      setLastSynced(Date.now());
    },
    ()=>{
      cloudReady=true;
      setSyncStatus(navigator.onLine?"Cloud error":"Offline",navigator.onLine?"bad":"warn");
    }
  );
}

// Activity-based program weeks: a new Monday advances once only if the
// previous active training week contained real completed sets or a finish flag.
// Empty calendar weeks never consume a program week.
function localMondayKey(date=new Date()){
 const d=new Date(date.getFullYear(),date.getMonth(),date.getDate());
 d.setDate(d.getDate()-(d.getDay()+6)%7);
 return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
}
function hasTrainingActivity(week){
 const prefix=String(week)+"|";
 return Object.entries(state.finished||{}).some(([key,finished])=>key.startsWith(prefix)&&finished&&["Monday","Tuesday","Thursday","Saturday"].includes(key.split("|")[1])) ||
   Object.entries(state.logs||{}).some(([key,log])=>key.startsWith(prefix)&&["Monday","Tuesday","Thursday","Saturday"].includes(key.split("|")[1])&&hasCompletedSets(log));
}
function autoAdvanceTrainingWeek(){
 const monday=localMondayKey();
 // Older workout records have no reliable dates; never guess which calendar
 // Monday their saved program week belongs to. Seed tracking on first upgrade.
 if(!state.lastTrainingMonday){state.lastTrainingMonday=monday;saveState();return;}
 if(monday<=state.lastTrainingMonday)return;
 const active=Math.min(16,Math.max(1,Number(state.activeTrainingWeek)||1));
 const shouldAdvance=active<16&&hasTrainingActivity(active);
 const wasCurrentView=Number(state.currentWeek)===active;
 state.lastTrainingMonday=monday;
 if(shouldAdvance){state.activeTrainingWeek=active+1;if(wasCurrentView)state.currentWeek=active+1;}
 saveState();
}
function applyStateToUi(){
  autoAdvanceTrainingWeek();
  const anchorField=document.getElementById("weekOneMonday");
  if(anchorField)anchorField.value=state.weekOneMonday||"";
  document.body.classList.toggle("dark",state.dark);
  const week=document.getElementById("weekSelect");
  const settingsWeek=document.getElementById("settingsWeekSelect");
  if(week) week.value=state.currentWeek;
  if(settingsWeek) settingsWeek.value=state.activeTrainingWeek||state.currentWeek;
  const workout=document.getElementById("todayWorkoutSelect");
  if(workout&&PROGRAM[sessionWorkoutDay]){
    workout.value=sessionWorkoutDay;
  }
  renderToday();
  renderProgram();
  renderProgress();
}

const PROGRAM = {"Monday":{"title":"Lower + Core","exercises":[{"name":"Goblet Squat","load":"40 lb","sets":3,"reps":"10\u201312","rest":"90 sec"},{"name":"DB Romanian Deadlift","load":"40 lb each","sets":3,"reps":"8\u201312","rest":"2 min"},{"name":"Stationary Reverse Lunge","load":"15 lb each","sets":3,"reps":"8/side","rest":"90 sec"},{"name":"Standing DB Calf Raise","load":"40 lb each","sets":3,"reps":"12\u201315","rest":"60 sec"},{"name":"Plank","load":"Bodyweight","sets":3,"reps":"30\u201345 sec","rest":"60 sec"},{"name":"Bike / compact conditioning","load":"Moderate-hard","sets":1,"reps":"5\u20138 min","rest":"\u2014"}]},"Tuesday":{"title":"Pull + Chest Accessory","exercises":[{"name":"Chest-Supported DB Row","load":"40 lb each","sets":4,"reps":"8\u201312","rest":"2 min"},{"name":"Pull-Up","load":"Bodyweight","sets":4,"reps":"Clean reps","rest":"2 min"},{"name":"Pulley Straight-Arm Pulldown","load":"20 lb","sets":3,"reps":"10\u201315","rest":"75 sec"},{"name":"DB Curl","load":"20 lb each","sets":3,"reps":"8\u201312","rest":"75 sec"},{"name":"Dead Hang","load":"Bodyweight","sets":3,"reps":"30 sec","rest":"60 sec"},{"name":"Flat DB Bench Press","load":"50 lb each","sets":2,"reps":"8\u201312","rest":"2\u20133 min"},{"name":"Push-Up","load":"Bodyweight","sets":2,"reps":"8\u201312","rest":"75 sec"}]},"Wednesday":{"title":"Recovery","exercises":[{"name":"Easy walk or bike","load":"Easy pace","sets":1,"reps":"20\u201330 min","rest":"\u2014"},{"name":"Chest / shoulder mobility","load":"Bodyweight","sets":1,"reps":"5\u20138 min","rest":"\u2014"}]},"Thursday":{"title":"Chest + Shoulders","exercises":[{"name":"Incline DB Bench Press","load":"40 lb each","sets":3,"reps":"8\u201312","rest":"2 min"},{"name":"Single-Arm High-to-Low Pulley Fly","load":"15 lb","sets":3,"reps":"10\u201315/side","rest":"60\u201375 sec"},{"name":"Seated DB Shoulder Press","load":"20 lb each","sets":3,"reps":"8\u201312","rest":"90 sec"},{"name":"DB Lateral Raise","load":"15 lb each","sets":3,"reps":"10\u201315","rest":"60 sec"},{"name":"Overhead DB Triceps Extension","load":"30 lb","sets":3,"reps":"10\u201312","rest":"75 sec"},{"name":"Push-Up","load":"Bodyweight","sets":3,"reps":"Stop 2 reps before failure","rest":"90 sec"}]},"Friday":{"title":"Rest","exercises":[{"name":"Rest day","load":"\u2014","sets":1,"reps":"Recover for Saturday","rest":"\u2014"},{"name":"Optional easy walk","load":"Easy pace","sets":1,"reps":"15\u201330 min","rest":"\u2014"}]},"Saturday":{"title":"Heavy Chest + Upper","exercises":[{"name":"Incline DB Bench Press","load":"40 lb each","sets":4,"reps":"8\u201312","rest":"2\u20133 min"},{"name":"Flat DB Bench Press","load":"50 lb each","sets":4,"reps":"6\u201310","rest":"2\u20133 min"},{"name":"Chest-Supported DB Row","load":"40 lb each","sets":3,"reps":"8\u201312","rest":"2 min"},{"name":"Single-Arm High-to-Low Pulley Fly","load":"15 lb","sets":3,"reps":"10\u201315/side","rest":"60\u201375 sec"},{"name":"Pull-Up","load":"Bodyweight","sets":3,"reps":"Clean reps","rest":"2 min"},{"name":"Push-Up Finisher","load":"Bodyweight","sets":2,"reps":"Near technical failure","rest":"90 sec"}]},"Sunday":{"title":"Recovery","exercises":[{"name":"Easy walk or bike","load":"Easy pace","sets":1,"reps":"20\u201330 min","rest":"\u2014"},{"name":"Mobility: hips, chest, shoulders","load":"Bodyweight","sets":1,"reps":"8\u201310 min","rest":"\u2014"}]}};
const WEEK_PLAN = {"1":["Re-entry","Use listed loads","Low-middle rep range","2\u20133 RIR","Controlled"],"2":["Build","Same loads","+1 rep per set where possible","2 RIR","Controlled"],"3":["Build","Same loads","+1 rep again","1\u20132 RIR","Controlled"],"4":["Deload","Same or lighter","2 sets per lift","4 RIR","Easy"],"5":["Progress","Next available load only if earned","Low end of range","2\u20133 RIR","Controlled"],"6":["Build","Same load","+1 rep per set","2 RIR","Controlled"],"7":["Build","Same load","Toward top of range","1\u20132 RIR","Controlled"],"8":["Deload","Reduce sets ~40%","Low end","4 RIR","Easy"],"9":["Strength-hypertrophy","Heaviest controlled available","Lower half","2 RIR","Controlled"],"10":["Build","Same load","+1 rep per set","1\u20132 RIR","Controlled"],"11":["Build","Same load","Top of range","1 RIR","Controlled"],"12":["Deload","One step lighter where practical","2 easy sets","4 RIR","Easy"],"13":["Peak build","Heaviest controlled available","Low-middle range","2 RIR","1-sec pause"],"14":["Build","Same load","+1 rep per set","1\u20132 RIR","Pause reps"],"15":["Performance","Same load","Beat Week 14 total reps","0\u20131 RIR final set only","Controlled"],"16":["Reset","Base or lighter","2 easy sets","4\u20135 RIR","Easy"]};
const DAYS = Object.keys(PROGRAM);
const STORAGE_KEY = "macWorkoutDataV1";

let state = loadState();
state.blockNumber=Math.max(1,Number(state.blockNumber)||1);
if(!Array.isArray(state.archivedBlocks))state.archivedBlocks=[];
if(!state.skippedDays)state.skippedDays={};
let sessionWorkoutDay = dayName();
if(!Number.isFinite(Number(state.activeTrainingWeek)) || !state.activeTrainingWeek) state.activeTrainingWeek=Number(state.currentWeek)||1;
function blankState(){return {currentWeek:1,activeTrainingWeek:null,weekOneMonday:"",lastTrainingMonday:"",dark:false,logs:{},checkins:{},finished:{},selectedWorkoutDay:"",metaUpdatedAt:0,resetEpoch:0,prs:{},summaries:{},blockNumber:1,archivedBlocks:[],skippedDays:{}}}
function loadState(){try{return Object.assign(blankState(),JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}"));}catch(e){return blankState();}}
function saveState(){
  state.metaUpdatedAt=Date.now();
  localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
  scheduleCloudSave();
}
function keyFor(day,exIndex,exerciseName=""){
 const safeName=String(exerciseName||`exercise-${exIndex}`)
   .toLowerCase()
   .replace(/[^a-z0-9]+/g,"-")
   .replace(/^-|-$/g,"");
 return `${state.currentWeek}|${day}|${safeName}`;
}

function keyForWeek(week,day,exerciseName){
 const safeName=String(exerciseName||"exercise")
   .toLowerCase()
   .replace(/[^a-z0-9]+/g,"-")
   .replace(/^-|-$/g,"");
 return `${week}|${day}|${safeName}`;
}

function allBlockSnapshots(){
 return [...(state.archivedBlocks||[]).map(b=>({...b,archived:true})),{number:Number(state.blockNumber)||1,logs:state.logs,finished:state.finished,checkins:state.checkins,summaries:state.summaries}];
}
function exerciseEntries(name,throughCurrent=true){
 const arr=[];
 for(const block of allBlockSnapshots()){
  for(let w=1;w<=16;w++)for(const day of DAYS){
   if(throughCurrent && !block.archived && (w>Number(state.currentWeek)||(w===Number(state.currentWeek)&&DAYS.indexOf(day)>=DAYS.indexOf(activeWorkoutDay()))))continue;
   const log=block.logs?.[keyForWeek(w,day,name)];
   if(hasCompletedSets(log))arr.push({block:block.number,week:w,day,log});
  }
 }
 return arr;
}
function lastExerciseEntry(name){return exerciseEntries(name).at(-1)||null;}
function markDaySkipped(){
 const day=activeWorkoutDay(),key=`${state.currentWeek}|${day}`;
 if(state.finished[key]){alert('This workout is marked finished. It cannot also be skipped.');return;}
 if(!state.skippedDays[key] && PROGRAM[day].exercises.some(ex=>hasCompletedSets(state.logs[keyForWeek(state.currentWeek,day,ex.name)]))){alert("This day already has logged sets. Clear the sets before marking the entire day skipped.");return;}
 state.skippedDays[key]=!state.skippedDays[key];saveState();renderToday();renderProgress();
}
function startNewTrainingBlock(){
 const count=Object.keys(state.logs||{}).length;
 const message=`Start Block ${Number(state.blockNumber||1)+1} at Week 1? Your entire current 16-week block (${count} saved exercise records) will be archived. Your next targets will use all earlier blocks. Export a backup first.`;
 if(!confirm(message))return;
 // Preserve completed data in its own immutable historical block. Only reset current-block slots.
 const archived={number:Number(state.blockNumber)||1,logs:structuredClone(state.logs||{}),checkins:structuredClone(state.checkins||{}),finished:structuredClone(state.finished||{}),summaries:structuredClone(state.summaries||{}),skippedDays:structuredClone(state.skippedDays||{}),archivedAt:new Date().toISOString()};
 state.archivedBlocks.push(archived);
 state.blockNumber=archived.number+1;
 state.logs={};state.checkins={};state.finished={};state.summaries={};state.skippedDays={};
 state.currentWeek=1;state.activeTrainingWeek=1;state.lastTrainingMonday=localMondayKey();state.weekOneMonday=localMondayKey();
 saveState();applyStateToUi();alert(`Block ${state.blockNumber} started. Older workouts are preserved for progression and in exported backups.`);
}
function hasCompletedSets(log){return Array.isArray(log?.sets)&&log.sets.some(v=>Number(v)>0)}
function findPreviousLog(day,exerciseName){
 const hits=exerciseEntries(exerciseName).filter(h=>h.day===day);
 return hits.length?{...hits[hits.length-1]}:null;
}
function inheritedLoad(day,exerciseName,fallback){
 const latest=lastExerciseEntry(exerciseName);
 return latest&&String(latest.log.load||'').trim()?String(latest.log.load).trim():fallback;
}
function workingLoad(day,ex,log){return String(log?.load||inheritedLoad(day,ex.name,ex.load)).trim()||ex.load;}
function setRir(log,index){return Array.isArray(log?.setRirs)?String(log.setRirs[index]??''):'';}
function progressionRecommendation(day,ex){
 const prior=lastExerciseEntry(ex.name);
 if(!prior)return 'Log working sets and per-set RIR to establish a baseline.';
 const vals=cleanRepValues(prior.log),top=upperRepTarget(ex.reps),bottom=Number(String(ex.reps).match(/\d+/)?.[0]||0);
 const tracked=vals.map((_,i)=>setRir(prior.log,i));
 const effortComplete=vals.length>=Math.min(2,Number(ex.sets))&&tracked.length===vals.length&&tracked.every(r=>r!==''&&Number.isFinite(Number(r)));
 if(!effortComplete)return 'Track RIR on every completed set for an effort-aware recommendation; maintain current load meanwhile.';
 const rirs=tracked.map(Number),avg=rirs.reduce((a,b)=>a+b,0)/rirs.length;
 if(top&&vals.length>=Number(ex.sets)&&vals.every(n=>n>=top)&&avg>=1&&avg<=3)
  return 'Increase candidate: top rep range achieved at 1–3 RIR. Try the next available dumbbell increment only if form and recovery are good; confirm the load yourself.';
 if(avg>=4&&top&&vals.every(n=>n>=bottom))return 'Likely underloaded: add clean reps or consider more resistance if available.';
 if(avg<=0.5)return 'Very hard session: maintain the weight, recover well and aim for 1–3 RIR next time.';
 return 'Maintain the working weight. Add clean reps while keeping roughly 1–3 RIR.';
}
function cleanRepValues(log){
 return Array.isArray(log?.sets)
   ? log.sets.map(v=>Number(String(v||"").replace(/[^0-9.]/g,""))).filter(v=>Number.isFinite(v)&&v>0)
   : [];
}

function upperRepTarget(repsText){
 const match=String(repsText||"").match(/(\d+)\s*[–-]\s*(\d+)/);
 return match?Number(match[2]):null;
}

function previousPerformanceText(ex,previous){
 if(!previous) return "No prior workout recorded.";
 const sets=Array.isArray(previous.log.sets)
   ? previous.log.sets.filter(v=>String(v||"").trim()!=="")
   : [];
 const load=String(previous.log.load||ex.load||"").trim()||ex.load;
 return `Block ${previous.block} · Week ${previous.week}: ${load} • ${sets.length?sets.join(" / "):"sets not recorded"}`;
}

function buildProgressTarget(ex,previous){
 if(!previous) return "Establish a clean baseline today.";
 const values=cleanRepValues(previous.log);
 const load=String(previous.log.load||ex.load||"").trim()||ex.load;
 if(!values.length) return `Repeat ${load} with clean form and record every set.`;

 const top=upperRepTarget(ex.reps);
 const target=[...values];
 let changed=false;
 for(let i=0;i<target.length;i++){
   if(!top||target[i]<top){
     target[i]+=1;
     changed=true;
     break;
   }
 }
 if(changed) return `${load} • target ${target.join(" / ")} reps`;
 return `${load} • top of range reached; repeat cleanly before increasing difficulty or load.`;
}
function dayName(){return DAYS[(new Date()).getDay()===0?6:(new Date()).getDay()-1];}
function dateLabel(){return new Date().toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"});}
function setOptions(el){el.innerHTML="";for(let i=1;i<=16;i++){const o=document.createElement("option");o.value=i;o.textContent=`Week ${i}`;el.appendChild(o)}el.value=state.currentWeek;}
function activeWorkoutDay(){
 const selected=document.getElementById("todayWorkoutSelect")?.value;
 return selected||sessionWorkoutDay||dayName();
}

let restTimerSeconds=0,restTimerInterval=null;
function parseRestSeconds(text){
 const s=String(text||"").toLowerCase();
 let m=s.match(/(\d+)\s*[–-]\s*(\d+)\s*sec/); if(m)return Number(m[2]);
 m=s.match(/(\d+)\s*[–-]\s*(\d+)\s*min/); if(m)return Number(m[2])*60;
 m=s.match(/(\d+)\s*min/); if(m)return Number(m[1])*60;
 m=s.match(/(\d+)\s*sec/); if(m)return Number(m[1]);
 return 90;
}
function formatTimer(sec){return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,"0")}`;}
function renderRestTimer(){const p=document.getElementById("restTimerPanel"),d=document.getElementById("restTimerDisplay");if(!p||!d)return;if(restTimerSeconds<=0){p.classList.add("hidden");d.textContent="0:00";return}p.classList.remove("hidden");d.textContent=formatTimer(restTimerSeconds)}
function startRestTimer(seconds){clearInterval(restTimerInterval);restTimerSeconds=Number(seconds||0);if(restTimerSeconds<=0)return;renderRestTimer();restTimerInterval=setInterval(()=>{restTimerSeconds--;renderRestTimer();if(restTimerSeconds<=0){clearInterval(restTimerInterval);restTimerInterval=null;if(navigator.vibrate)navigator.vibrate([150,80,150])}},1000)}
function stopRestTimer(){clearInterval(restTimerInterval);restTimerInterval=null;restTimerSeconds=0;renderRestTimer()}
function numericLoad(t){const n=String(t||"").match(/\d+(\.\d+)?/);if(!n)return 0;const v=Number(n[0]),s=String(t||"").toLowerCase();return (s.includes("each")||s.includes("2 x")||s.includes("2×"))?v*2:v}
function exerciseHistory(day,name){
 const r=[];
 for(const block of allBlockSnapshots())for(let week=1;week<=16;week++){
  const l=block.logs?.[keyForWeek(week,day,name)];if(!hasCompletedSets(l))continue;
  const reps=cleanRepValues(l),load=numericLoad(l.load);
  r.push({block:block.number,week,day,load,reps,volume:load*reps.reduce((a,b)=>a+b,0),setRirs:l.setRirs||[],log:l});
 }
 return r;
}
function trendText(day,name){
 const h=exerciseHistory(day,name).filter(r=>r.block<state.blockNumber || r.week<=Number(state.currentWeek));
 if(!h.length)return 'Record completed sets to establish a baseline.';
 const latest=h.at(-1),current=state.logs[keyForWeek(state.currentWeek,day,name)];
 if(!hasCompletedSets(current))return `Last completed: Block ${latest.block}, Week ${latest.week} · ${latest.reps.join('/')} reps at ${latest.log.load}.`;
 const previous=h.filter(r=>!(r.block===state.blockNumber&&r.week===Number(state.currentWeek))).at(-1);
 if(!previous)return 'First recorded session. Complete another workout for a trend.';
 const currentVol=numericLoad(current.load)*cleanRepValues(current).reduce((a,b)=>a+b,0);
 const difference=Math.round(currentVol-previous.volume);
 return `${difference>0?'+':''}${difference.toLocaleString()} lb total volume vs Block ${previous.block} Week ${previous.week} (${previous.log.load}). Compare reps and RIR at similar weights.`;
}
function evaluateExercisePR(day,ex,log){
 const reps=cleanRepValues(log);if(!reps.length)return null;const load=numericLoad(log.load),bestReps=Math.max(...reps),volume=load*reps.reduce((a,b)=>a+b,0),k=`${day}|${ex.name}`,p=state.prs[k]||{bestLoad:0,bestReps:0,bestVolume:0},types=[];
 if(load>p.bestLoad)types.push(`load ${log.load||ex.load}`);if(bestReps>p.bestReps)types.push(`reps ${bestReps}`);if(volume>p.bestVolume&&load>0)types.push(`volume ${Math.round(volume)} lb-reps`);
 if(types.length)state.prs[k]={bestLoad:Math.max(p.bestLoad,load),bestReps:Math.max(p.bestReps,bestReps),bestVolume:Math.max(p.bestVolume,volume),updatedAt:Date.now()};
 return types.length?types:null
}
function buildCoachBriefing(){
 const day=activeWorkoutDay(),w=PROGRAM[day],box=document.getElementById("coachBriefing");if(!box)return;
 const p=day==="Saturday"?"Primary goal: chest strength and hypertrophy. Protect your pressing performance and use the full rest periods.":day==="Thursday"?"Secondary chest exposure: quality reps today so Saturday stays strong.":day==="Tuesday"?"Pull day with two controlled flat-bench sets (2–3 RIR). Save harder chest work for Thursday and Saturday.":day==="Monday"?"Lower-body strength and core. Keep technique clean and leave reps in reserve.":"Recovery day: finish fresher than you started.";
 const ex=w.exercises.find(x=>findPreviousLog(day,x.name)),target=ex?`${ex.name}: ${buildProgressTarget(ex,findPreviousLog(day,ex.name))}`:"Establish clean baseline numbers today.";
 box.innerHTML=`<div class="coach-point"><strong>Today's priority</strong>${p}</div><div class="coach-point"><strong>Main progression target</strong>${target}</div><div class="coach-point"><strong>Session rule</strong>Stay within the prescribed rest periods and finish inside 60 minutes.</div>`
}
function buildWorkoutSummary(day){
 const w=PROGRAM[day];let completed=0,total=0,volume=0;const prs=[];
 w.exercises.forEach((ex,i)=>{total+=Number(ex.sets||0);const l=state.logs[keyFor(day,i,ex.name)];if(!l)return;const reps=cleanRepValues(l);completed+=reps.length;volume+=numericLoad(l.load)*reps.reduce((a,b)=>a+b,0);const pr=evaluateExercisePR(day,ex,l);if(pr)prs.push(`${ex.name}: ${pr.join(", ")}`)});
 const s={day,week:state.currentWeek,completedSets:completed,totalSets:total,totalVolume:volume,adherence:total?Math.round(completed/total*100):0,prs,createdAt:new Date().toISOString()};state.summaries[`${state.currentWeek}|${day}`]=s;return s
}
function showWorkoutSummary(s){
 const m=document.getElementById("workoutSummaryModal"),c=document.getElementById("workoutSummaryContent");if(!m||!c)return;
 c.innerHTML=`<div class="summary-grid"><div class="summary-stat"><span>Sets completed</span><strong>${s.completedSets}/${s.totalSets}</strong></div><div class="summary-stat"><span>Completion</span><strong>${s.adherence}%</strong></div><div class="summary-stat"><span>Tracked volume</span><strong>${Math.round(s.totalVolume).toLocaleString()}</strong></div><div class="summary-stat"><span>New PRs</span><strong>${s.prs.length}</strong></div></div><h3>Coach recap</h3><p>${s.adherence>=90?"Strong session. Keep progressing conservatively.":s.adherence>=70?"Solid work. Complete more prescribed sets before adding load.":"Treat this as a partial session. Don't compensate by doubling volume later."}</p><h3>PRs</h3>${s.prs.length?`<div class="summary-pr-list">${s.prs.map(x=>`<div class="summary-pr">🔥 ${x}</div>`).join("")}</div>`:'<div class="muted">No new PRs this session.</div>'}`;
 m.classList.remove("hidden")
}
// Logs are keyed by planned program week and day; no calendar dates are inferred for old records.
function weekDayStatus(week,day){
 const finished=!!state.finished[`${week}|${day}`];
 const skipped=!!state.skippedDays?.[`${week}|${day}`];
 const program=PROGRAM[day];
 const logs=program.exercises.map((ex,i)=>state.logs[keyForWeek(week,day,ex.name)]);
 const logged=logs.filter(hasCompletedSets).length;
 const isRecovery=["Wednesday","Friday","Sunday"].includes(day);
 if(finished)return {kind:"finished",label:"Completed",detail:`${logged} exercises logged`};
 if(logged)return {kind:"partial",label:"Logged",detail:`${logged} of ${program.exercises.length} exercises`};
 if(skipped)return {kind:"skipped",label:"Skipped",detail:"Intentionally skipped; not counted as training"};
 if(isRecovery)return {kind:"recovery",label:day==="Friday"?"Rest":"Recovery",detail:"Optional activity not logged"};
 return {kind:"empty",label:"Not logged",detail:"No exercise sets recorded"};
}
function renderWeeklyTracker(){
 const week=Number(state.currentWeek),active=Number(state.activeTrainingWeek||week),isCurrent=week===active;
 for(const id of ["weeklyTracker","progressWeeklyTracker"]){
  const host=document.getElementById(id);if(!host)continue;
  host.innerHTML="";
  const heading=document.createElement("div");heading.className="week-track-heading";
  heading.innerHTML=`<div><div class="eyebrow">BLOCK ${state.blockNumber} · WEEKLY ACTIVITY</div><h3>Week ${week} of 16 <span class="week-track-current">${isCurrent?"Current training week":"Viewing history"}</span></h3></div>`;
  host.appendChild(heading);
  const weekNav=document.createElement("div");weekNav.className="week-track-nav";
  const previous=document.createElement("button");previous.type="button";previous.textContent="‹ Previous";previous.disabled=week<=1;
  const next=document.createElement("button");next.type="button";next.textContent="Next ›";next.disabled=week>=16;
  const back=document.createElement("button");back.type="button";back.textContent="Current week";back.disabled=isCurrent;
  const changeView=(target)=>{state.currentWeek=target;saveState();document.getElementById("weekSelect").value=target;renderToday();renderProgress();renderProgram();};
  previous.onclick=()=>changeView(week-1);next.onclick=()=>changeView(week+1);back.onclick=()=>changeView(active);
  weekNav.append(previous,back,next);host.appendChild(weekNav);
  const grid=document.createElement("div");grid.className="week-track-days";
  let done=0,partial=0;
  DAYS.forEach((day,index)=>{
   const status=weekDayStatus(week,day);if(status.kind==="finished")done++;if(status.kind==="partial")partial++;
   const b=document.createElement("button");b.type="button";b.className=`week-day week-day-${status.kind}`+(activeWorkoutDay()===day?" week-day-selected":"");
   b.title=`${day}: ${status.label} — ${status.detail}`;
   b.setAttribute("aria-label",`${day}: ${status.label}, ${status.detail}`);
   b.innerHTML=`<span class="week-day-label">${["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][index]}</span><span class="week-day-icon">${status.kind==="finished"?"✓":status.kind==="partial"?"●":status.kind==="recovery"?"–":status.kind==="skipped"?"×":"○"}</span><span class="week-day-caption">${status.kind==="finished"?"Done":status.kind==="partial"?"Logged":status.kind==="recovery"?"Rest":status.kind==="skipped"?"Skip":"Empty"}</span>`;
   b.onclick=()=>{sessionWorkoutDay=day;document.getElementById("todayWorkoutSelect").value=day;renderToday();renderProgress();showScreen("todayScreen","Today");};
   grid.appendChild(b);
  });
  host.appendChild(grid);
  const summary=document.createElement("p");summary.className="week-track-summary";summary.textContent=`${done} finished · ${partial} partially logged · 4 planned strength days (Mon, Tue, Thu, Sat). An empty day means no saved sets—not necessarily a missed workout.`;host.appendChild(summary);
 }
}
function renderToday(){
 const scheduled=dayName(),day=activeWorkoutDay(),workout=PROGRAM[day],guide=WEEK_PLAN[String(state.currentWeek)];
 document.getElementById("todayDate").textContent=dateLabel();
 document.getElementById("todayWorkout").textContent=`${day} — ${workout.title}`;
 document.getElementById("currentWeekLabel").textContent=`${state.currentWeek} · Block ${state.blockNumber}`;
 document.getElementById("weekGuidance").textContent=`${guide[0]}: ${guide[1]} • ${guide[2]} • ${guide[3]} • ${guide[4]}`;
 const note=document.getElementById("scheduleNote");
 if(note){
   const trainingDays=["Monday","Tuesday","Thursday","Saturday"];
   const timeTarget=trainingDays.includes(day)?"Target: 45–60 minutes.":"Recovery / rest day.";
   note.textContent=(day===scheduled
     ? `Scheduled for today: ${scheduled} — ${PROGRAM[scheduled].title}.`
     : `Make-up workout selected: ${day} — ${workout.title}. Today’s scheduled workout is ${scheduled} — ${PROGRAM[scheduled].title}.`) + ` ${timeTarget}`;
 }
 const list=document.getElementById("exerciseList");list.innerHTML="";
 workout.exercises.forEach((ex,i)=>list.appendChild(makeExercise(day,ex,i,true)));
 buildCoachBriefing();
 renderWeeklyTracker();
}
function makeExercise(day,ex,i,editable){
 const card=document.createElement("article");
 card.className="exercise-card card";
 card.dataset.index=i;

 const logKey=keyFor(day,i,ex.name);
 const saved=state.logs[logKey]||{
   sets:Array(ex.sets).fill(""),
   rir:"",
   load:inheritedLoad(day,ex.name,ex.load),
   setRirs:Array(ex.sets).fill(""),
   skipped:false,
   exerciseName:ex.name
 };

 if(!Array.isArray(saved.sets)) saved.sets=[];
 while(saved.sets.length<ex.sets) saved.sets.push("");
 if(saved.sets.length>ex.sets) saved.sets=saved.sets.slice(0,ex.sets);
 if(!saved.load || (!hasCompletedSets(saved) && !saved.loadEdited)) saved.load=inheritedLoad(day,ex.name,ex.load);
 if(!Array.isArray(saved.setRirs)) saved.setRirs=Array(ex.sets).fill("");
 while(saved.setRirs.length<ex.sets) saved.setRirs.push("");
 if(saved.setRirs.length>ex.sets) saved.setRirs=saved.setRirs.slice(0,ex.sets);

 if(saved.skipped) card.classList.add("skipped");

 const head=document.createElement("div");
 head.className="exercise-head";
 head.innerHTML=`<div>
   <h3 class="exercise-name">${ex.name}</h3>
   <div class="exercise-prescription">${workingLoad(day,ex,saved)} • ${ex.sets} × ${ex.reps} • Rest ${ex.rest}</div>
 </div>`;

 if(editable){
   const b=document.createElement("button");
   b.className="skip-btn";
   b.textContent=saved.skipped?"Undo":"Skip";
   b.onclick=()=>{
     saved.skipped=!saved.skipped;
     saved.exerciseName=ex.name;
     state.logs[logKey]=saved;
     saveState();
     renderToday();
     renderProgram();
   };
   head.appendChild(b);
 }
 card.appendChild(head);

 const previous=findPreviousLog(day,ex.name);
 const progress=document.createElement("div");
 progress.className="progress-cue";
 progress.innerHTML=`
   <div class="progress-cue-row">
     <span>Last workout</span>
     <strong>${previousPerformanceText(ex,previous)}</strong>
   </div>
   <div class="progress-cue-row target">
     <span>Today's target</span>
     <strong>${previous?buildProgressTarget(ex,previous):workingLoad(day,ex,saved)+" • establish clean baseline"}</strong>
   </div>`;
 card.appendChild(progress);
 const trend=document.createElement("div");
 trend.className="trend-block";
 trend.innerHTML=`<span>Strength trend</span><strong>${trendText(day,ex.name)}</strong>`;
 card.appendChild(trend);
 const recommendation=document.createElement("div");recommendation.className="progression-tip";recommendation.textContent="Coach: "+progressionRecommendation(day,ex);card.appendChild(recommendation);

 const sets=document.createElement("div");
 sets.className="sets";
 for(let s=0;s<ex.sets;s++){
   const row=document.createElement("div");
   row.className="set-row"+(saved.sets[s]?" done":"");
   row.innerHTML=`<span>Set ${s+1}</span>`;

   const inp=document.createElement("input");
   inp.type="text";
   inp.inputMode="numeric";
   inp.placeholder="Reps";
   inp.setAttribute("aria-label",`Set ${s+1} completed repetitions`);
   inp.value=saved.sets[s]||"";
   inp.disabled=!editable;
   inp.oninput=()=>{
     const wasEmpty=!saved.sets[s];
     saved.sets[s]=inp.value;
     saved.exerciseName=ex.name;
     state.logs[logKey]=saved;
     saveState();
     row.classList.toggle("done",!!inp.value);
     if(wasEmpty&&inp.value)startRestTimer(parseRestSeconds(ex.rest));
   };
   row.appendChild(inp);
   const effort=document.createElement('label');effort.className='set-effort';effort.textContent='RIR';
   const selector=document.createElement('select');
   selector.innerHTML='<option value="">—</option><option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4+</option>';
   selector.value=saved.setRirs[s]||'';selector.setAttribute('aria-label',`Set ${s+1} repetitions in reserve`);selector.disabled=!editable;
   selector.onchange=()=>{saved.setRirs[s]=selector.value;saved.exerciseName=ex.name;state.logs[logKey]=saved;saveState();};
   effort.appendChild(selector);row.appendChild(effort);
   sets.appendChild(row);
 }
 card.appendChild(sets);

 const foot=document.createElement("div");
 foot.className="exercise-footer";

 // Legacy whole-exercise RIR is preserved in saved data, never falsely assigned to a set.
 const load=document.createElement("label");
 load.innerHTML='Actual load<input type="text">';
 const loadInput=load.querySelector("input");
 loadInput.value=workingLoad(day,ex,saved);
 loadInput.placeholder=workingLoad(day,ex,saved);
 loadInput.disabled=!editable;
 loadInput.oninput=e=>{
   saved.load=e.target.value;
   saved.loadEdited=true;
   saved.exerciseName=ex.name;
   state.logs[logKey]=saved;
   saveState();
 };

 foot.append(load);
 card.appendChild(foot);
 return card;
}
function renderProgram(){
 const day=document.getElementById("programDaySelect").value||dayName();
 const list=document.getElementById("programList");
 list.innerHTML="";
 PROGRAM[day].exercises.forEach((ex,i)=>list.appendChild(makeExercise(day,ex,i,true)));
}
function finishWorkout(){const day=activeWorkoutDay();delete state.skippedDays[`${state.currentWeek}|${day}`];state.finished[`${state.currentWeek}|${day}`]=true;const s=buildWorkoutSummary(day);saveState();stopRestTimer();renderProgress();renderToday();renderProgram();showWorkoutSummary(s);}
function saveCheckin(){
 const w=state.currentWeek;state.checkins[w]={weight:val("bodyWeight"),waist:val("waist"),sleep:val("sleep"),energy:val("energy"),soreness:val("soreness"),notes:val("weeklyNotes"),date:new Date().toISOString()};saveState();renderProgress();alert("Weekly check-in saved.");
}
function val(id){return document.getElementById(id).value}
function renderStrengthDashboard(){
 const container=document.getElementById('strengthDashboard');if(!container)return;
 const names=['Incline DB Bench Press','Flat DB Bench Press','Chest-Supported DB Row'];
 container.innerHTML='';
 names.forEach(name=>{
   const histories=[];
   for(const day of DAYS){if(!PROGRAM[day].exercises.some(e=>e.name===name))continue;
     for(const h of exerciseHistory(day,name))histories.push({...h,day});}
   histories.sort((a,b)=>a.block-b.block||a.week-b.week||DAYS.indexOf(a.day)-DAYS.indexOf(b.day));
   const box=document.createElement('div');box.className='strength-card';
   const heading=document.createElement('strong');heading.textContent=name;box.appendChild(heading);
   if(!histories.length){const note=document.createElement('p');note.textContent='No completed workout history yet.';box.appendChild(note);}
   else {
     const latest=histories[histories.length-1],first=histories[0];
     const summary=document.createElement('p');summary.textContent=`Latest: Block ${latest.block} Week ${latest.week} ${latest.day} · ${latest.reps.join('/')} reps · ${Math.round(latest.volume).toLocaleString()} lb volume`;
     box.appendChild(summary);
     const detail=document.createElement('p');detail.textContent=`First recorded volume: ${Math.round(first.volume).toLocaleString()} lb · Change: ${Math.round(latest.volume-first.volume)>=0?'+':''}${Math.round(latest.volume-first.volume).toLocaleString()} lb`;
     box.appendChild(detail);
   }
   container.appendChild(box);
 });
}
function renderProgress(){
 renderWeeklyTracker();
 renderStrengthDashboard();
 const finished=allBlockSnapshots().reduce((n,b)=>n+Object.keys(b.finished||{}).filter(k=>b.finished[k]).length,0),planned=((state.blockNumber-1)*16+state.currentWeek)*4;
 document.getElementById("statWorkouts").textContent=finished;
 document.getElementById("statAdherence").textContent=`${Math.min(100,Math.round(finished/Math.max(1,planned)*100))}%`;
 const checks=allBlockSnapshots().flatMap(b=>Object.entries(b.checkins||{}).map(([w,c])=>[`${b.number}-${String(w).padStart(2,"0")}`,c])).sort((a,b)=>a[0].localeCompare(b[0]));const latest=checks.at(-1)?.[1]||{};
 document.getElementById("statWeight").textContent=latest.weight?latest.weight+" lb":"—";document.getElementById("statWaist").textContent=latest.waist?latest.waist+' in':"—";
 const cur=state.checkins[state.currentWeek]||{};for(const id of ["bodyWeight","waist","sleep","energy","soreness","weeklyNotes"])document.getElementById(id).value=cur[{bodyWeight:"weight",waist:"waist",sleep:"sleep",energy:"energy",soreness:"soreness",weeklyNotes:"notes"}[id]]||"";
 const h=document.getElementById("historyList");h.innerHTML="";
 for(const block of allBlockSnapshots()){
  const head=document.createElement("h3");head.textContent=`Block ${block.number}${block.archived?' · Archived':' · Current'}`;h.appendChild(head);
  for(let w=1;w<=16;w++){
   const c=block.checkins?.[w]||{},done=Object.keys(block.finished||{}).filter(k=>k.startsWith(w+"|")&&block.finished[k]).length;
   const logged=Object.entries(block.logs||{}).some(([k,v])=>k.startsWith(w+"|")&&hasCompletedSets(v));
   if(!done&&!logged&&!c.date)continue;
   const d=document.createElement("div");d.className="history-item";
   const label=document.createElement("strong");label.textContent=`Week ${w}`;
   const detail=document.createElement("div");detail.textContent=c.weight?`${c.weight} lb`:'No weight check-in';
   const notes=document.createElement("div");notes.className="muted";notes.textContent=c.notes||'';detail.appendChild(notes);
   const badge=document.createElement("span");badge.className="badge";badge.textContent=`${done} finished`;
   d.append(label,detail,badge);h.appendChild(d);
  }
 }drawChart(checks);
}
function drawChart(checks){const c=document.getElementById("weightChart"),ctx=c.getContext("2d"),ratio=devicePixelRatio||1,w=c.clientWidth||320,h=190;c.width=w*ratio;c.height=h*ratio;ctx.scale(ratio,ratio);ctx.clearRect(0,0,w,h);const pts=checks.filter(x=>Number(x[1].weight));if(pts.length<1){ctx.fillStyle=getComputedStyle(document.body).getPropertyValue("--muted");ctx.font="14px -apple-system";ctx.fillText("Add weekly weights to see your trend.",14,28);return}const vals=pts.map(x=>Number(x[1].weight)),min=Math.min(...vals)-2,max=Math.max(...vals)+2,pad=28;ctx.strokeStyle="#d9e2ec";ctx.beginPath();ctx.moveTo(pad,10);ctx.lineTo(pad,h-pad);ctx.lineTo(w-8,h-pad);ctx.stroke();ctx.strokeStyle="#1f6feb";ctx.lineWidth=3;ctx.beginPath();pts.forEach((p,i)=>{const x=pad+(w-pad-12)*(i/Math.max(1,pts.length-1)),y=10+(h-pad-14)*(1-(Number(p[1].weight)-min)/(max-min||1));i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();}
function exportData(){const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`mac-workout-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href)}
function importData(file){const r=new FileReader();r.onload=()=>{try{const backup=JSON.parse(r.result);if(!backup||typeof backup!=="object"||!backup.logs||typeof backup.logs!=="object")throw Error("Invalid backup");if(!confirm("Importing replaces this device’s current training data and may sync it to the cloud. Export a backup first. Continue?"))return;state=Object.assign(blankState(),backup);saveState();location.reload()}catch(e){alert("That backup file could not be read.")}};r.readAsText(file)}
function showScreen(id,title){document.querySelectorAll(".screen").forEach(s=>s.classList.toggle("active",s.id===id));document.querySelectorAll(".bottom-nav button").forEach(b=>b.classList.toggle("active",b.dataset.screen===id));document.getElementById("screenTitle").textContent=title;if(id==="progressScreen")renderProgress();if(id==="programScreen")renderProgram();window.scrollTo(0,0)}
function init(){
 autoAdvanceTrainingWeek();
 const anchorField=document.getElementById("weekOneMonday");
 anchorField.value=state.weekOneMonday||"";
 anchorField.addEventListener("change",()=>{
  const value=anchorField.value;
  if(value && new Date(value+"T12:00:00").getDay()!==1){alert("Choose a Monday for Week 1.");anchorField.value=state.weekOneMonday||"";return;}
  state.weekOneMonday=value;
  saveState();applyStateToUi();
 });
 document.body.classList.toggle("dark",state.dark);
 ["weekSelect","settingsWeekSelect"].forEach(id=>{const e=document.getElementById(id);setOptions(e);e.value=id==="settingsWeekSelect"?state.activeTrainingWeek:state.currentWeek;e.onchange=()=>{if(id==="settingsWeekSelect"){state.activeTrainingWeek=Number(e.value);state.currentWeek=state.activeTrainingWeek;state.lastTrainingMonday=localMondayKey();}else{state.currentWeek=Number(e.value);}saveState();document.getElementById("weekSelect").value=state.currentWeek;document.getElementById("settingsWeekSelect").value=state.activeTrainingWeek;renderToday();renderProgress();renderProgram();}});
 const todaySelect=document.getElementById("todayWorkoutSelect");
 DAYS.forEach(d=>{const o=document.createElement("option");o.value=d;o.textContent=d+" — "+PROGRAM[d].title;todaySelect.appendChild(o)});
 const initialDay=dayName();
 sessionWorkoutDay=initialDay;
 todaySelect.value=initialDay;
 todaySelect.onchange=()=>{
   sessionWorkoutDay=todaySelect.value;
   renderToday();
 };
 const ds=document.getElementById("programDaySelect");DAYS.forEach(d=>{const o=document.createElement("option");o.value=d;o.textContent=d+" — "+PROGRAM[d].title;ds.appendChild(o)});ds.value=dayName();ds.onchange=renderProgram;
 document.querySelectorAll(".bottom-nav button").forEach(b=>b.onclick=()=>showScreen(b.dataset.screen,b.textContent.trim().replace(/[●▦↗⚙]/g,"")));
 document.getElementById("themeBtn").onclick=()=>{state.dark=!state.dark;saveState();document.body.classList.toggle("dark",state.dark);renderProgress()};
 document.getElementById("finishWorkoutBtn").onclick=finishWorkout;
 document.getElementById("skipDayBtn").onclick=markDaySkipped;
 document.getElementById("newBlockBtn").onclick=startNewTrainingBlock;
 document.getElementById("restTimerAddBtn").onclick=()=>{restTimerSeconds+=30;renderRestTimer();};
 document.getElementById("restTimerStopBtn").onclick=stopRestTimer;
 document.getElementById("closeSummaryBtn").onclick=()=>document.getElementById("workoutSummaryModal").classList.add("hidden");document.getElementById("saveCheckinBtn").onclick=saveCheckin;document.getElementById("exportBtn").onclick=exportData;
 document.getElementById("importInput").onchange=e=>e.target.files[0]&&importData(e.target.files[0]);document.getElementById("resetBtn").onclick=clearAllWorkoutData;
 renderToday();renderProgress();if("serviceWorker" in navigator)navigator.serviceWorker.register("service-worker.js").catch(()=>{});
}


async function clearAllWorkoutData(){
  const confirmed=confirm(
    "Erase every workout entry, completed workout, and progress check-in from this account on all devices? This cannot be undone."
  );
  if(!confirmed) return;

  const resetButton=document.getElementById("resetBtn");
  const originalText=resetButton.textContent;
  resetButton.disabled=true;
  resetButton.textContent="Erasing everywhere…";
  setSyncStatus("Erasing…","warn");

  clearTimeout(syncTimer);

  try{
    if(unsubscribeCloud){
      unsubscribeCloud();
      unsubscribeCloud=null;
    }

    const resetEpoch=Date.now();
    applyingRemote=true;
    state=blankState();
    state.resetEpoch=resetEpoch;
    state.metaUpdatedAt=resetEpoch;
    localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
    applyStateToUi();

    if(currentUser){
      await setDoc(
        cloudDocRef(currentUser.uid),
        {
          state,
          ownerUid:currentUser.uid,
          clientUpdatedAt:resetEpoch,
          resetEpoch,
          lastDeviceId:deviceId,
          updatedAt:serverTimestamp(),
          schemaVersion:6
        },
        {merge:false}
      );
    }

    applyingRemote=false;
    cloudReady=true;
    setLastSynced(Date.now());
    setSyncStatus(currentUser?"Synced":"Local cleared",currentUser?"good":"warn");

    if(currentUser){
      startRealtimeSync(currentUser);
    }

    alert("All workout data was erased from the cloud and this device. Other signed-in devices will clear when they reconnect.");
  }catch(error){
    applyingRemote=false;
    cloudReady=true;
    setSyncStatus("Erase failed","bad");
    if(currentUser && !unsubscribeCloud){
      startRealtimeSync(currentUser);
    }
    alert("The reset did not reach Firebase. Check your connection and try again.");
  }finally{
    resetButton.disabled=false;
    resetButton.textContent=originalText;
  }
}

function bindCloudUi(){
  const signInBtn=document.getElementById("signInBtn");
  const createBtn=document.getElementById("createAccountBtn");

  signInBtn.addEventListener("click",async()=>{
    const email=val("authEmail").trim();
    const password=val("authPassword");
    if(!email||!password){
      showAuthMessage("Enter both your email and password.");
      return;
    }
    signInBtn.disabled=true;
    signInBtn.textContent="Signing in…";
    showAuthMessage("Connecting…",false);
    try{
      await signInWithEmailAndPassword(auth,email,password);
    }catch(error){
      showAuthMessage(friendlyAuthError(error));
      signInBtn.disabled=false;
      signInBtn.textContent="Sign in";
    }
  });

  createBtn.addEventListener("click",async()=>{
    const email=val("authEmail").trim();
    const password=val("authPassword");
    if(!email||!password){
      showAuthMessage("Enter both your email and password.");
      return;
    }
    createBtn.disabled=true;
    createBtn.textContent="Creating…";
    try{
      await createUserWithEmailAndPassword(auth,email,password);
    }catch(error){
      showAuthMessage(friendlyAuthError(error));
      createBtn.disabled=false;
      createBtn.textContent="Create account";
    }
  });

  document.getElementById("forgotPasswordBtn").addEventListener("click",async()=>{
    const email=val("authEmail").trim();
    if(!email){
      showAuthMessage("Enter your email first.");
      return;
    }
    try{
      await sendPasswordResetEmail(auth,email);
      showAuthMessage("Password-reset email sent.",false);
    }catch(error){
      showAuthMessage(friendlyAuthError(error));
    }
  });

  document.getElementById("syncNowBtn").addEventListener("click",()=>{
    reconcileNow().catch(()=>setSyncStatus(navigator.onLine?"Sync error":"Offline",navigator.onLine?"bad":"warn"));
  });

  document.getElementById("signOutBtn").addEventListener("click",()=>signOut(auth));
  document.getElementById("accountBtn").addEventListener("click",()=>showScreen("settingsScreen","Settings"));
}

init();
bindCloudUi();

setPersistence(auth,browserLocalPersistence)
  .catch(()=>{})
  .finally(()=>{
    onAuthStateChanged(auth,user=>{
      currentUser=user;
      const gate=document.getElementById("authGate");
      const account=document.getElementById("accountEmail");
      const signInBtn=document.getElementById("signInBtn");
      const createBtn=document.getElementById("createAccountBtn");

      signInBtn.disabled=false;
      signInBtn.textContent="Sign in";
      createBtn.disabled=false;
      createBtn.textContent="Create account";

      if(!user){
        cloudReady=false;
        if(unsubscribeCloud){unsubscribeCloud();unsubscribeCloud=null;}
        gate.classList.remove("hidden");
        account.textContent="Not signed in";
        setSyncStatus("Signed out","warn");
        return;
      }

      gate.classList.add("hidden");
      account.textContent=user.email||"Signed in";
      setSyncStatus("Connecting…","warn");
      applyStateToUi();
      startRealtimeSync(user);
    });
  });

window.addEventListener("online",()=>{
  if(currentUser) reconcileNow().catch(()=>setSyncStatus("Sync error","bad"));
});
window.addEventListener("offline",()=>setSyncStatus("Offline","warn"));
