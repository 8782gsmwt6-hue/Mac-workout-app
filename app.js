import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  enableIndexedDbPersistence
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
enableIndexedDbPersistence(db).catch(() => {});

let currentUser = null;
let cloudReady = false;
let appInitialized = false;
let syncTimer = null;
let suppressCloudSave = false;

function cloudDocRef(uid) {
  return doc(db, "users", uid, "apps", "macWorkout");
}

function setSyncStatus(text, mode = "") {
  const el = document.getElementById("syncStatus");
  if (!el) return;
  el.textContent = text;
  el.className = `sync-status ${mode}`.trim();
}

function showAuthMessage(message, isError = true) {
  const el = document.getElementById("authMessage");
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? "var(--danger)" : "#1b6b3a";
}

async function loadCloudState(user) {
  setSyncStatus("Loading…", "warn");
  const snapshot = await getDoc(cloudDocRef(user.uid));

  if (snapshot.exists()) {
    const cloud = snapshot.data().state || {};
    const cloudHasData =
      Object.keys(cloud.logs || {}).length > 0 ||
      Object.keys(cloud.checkins || {}).length > 0 ||
      Object.keys(cloud.finished || {}).length > 0;

    if (cloudHasData) {
      suppressCloudSave = true;
      state = Object.assign(blankState(), cloud);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      suppressCloudSave = false;
      applyStateToUi();
    } else {
      await saveCloudState(true);
    }
  } else {
    await saveCloudState(true);
  }

  cloudReady = true;
  setSyncStatus("Synced", "good");
}

async function saveCloudState(force = false) {
  if (!currentUser || suppressCloudSave || (!cloudReady && !force)) return;
  setSyncStatus("Saving…", "warn");
  await setDoc(
    cloudDocRef(currentUser.uid),
    {
      state,
      ownerUid: currentUser.uid,
      updatedAt: serverTimestamp(),
      schemaVersion: 2
    },
    { merge: true }
  );
  setSyncStatus("Synced", "good");
}

function scheduleCloudSave() {
  if (!currentUser || suppressCloudSave) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    saveCloudState().catch(() => setSyncStatus("Sync error", "bad"));
  }, 650);
}

function applyStateToUi() {
  document.body.classList.toggle("dark", state.dark);

  const weekSelect = document.getElementById("weekSelect");
  const settingsWeekSelect = document.getElementById("settingsWeekSelect");
  if (weekSelect) weekSelect.value = state.currentWeek;
  if (settingsWeekSelect) settingsWeekSelect.value = state.currentWeek;

  const todaySelect = document.getElementById("todayWorkoutSelect");
  if (todaySelect && state.selectedWorkoutDay && PROGRAM[state.selectedWorkoutDay]) {
    todaySelect.value = state.selectedWorkoutDay;
  }

  const programDaySelect = document.getElementById("programDaySelect");
  if (programDaySelect && !programDaySelect.value) {
    programDaySelect.value = dayName();
  }

  renderToday();
  renderProgram();
  renderProgress();
}

function friendlyAuthError(error) {
  const code = error?.code || "";
  if (code.includes("invalid-credential")) return "The email or password is incorrect.";
  if (code.includes("email-already-in-use")) return "That email already has an account.";
  if (code.includes("weak-password")) return "Use a password with at least 6 characters.";
  if (code.includes("invalid-email")) return "Enter a valid email address.";
  if (code.includes("too-many-requests")) return "Too many attempts. Wait a little and try again.";
  return "Something went wrong. Please try again.";
}

const PROGRAM = {"Monday": {"title": "Push A", "exercises": [{"name": "Flat DB Bench Press", "load": "50 lb each", "sets": 4, "reps": "6\u201310", "rest": "2\u20133 min"}, {"name": "Incline DB Bench Press", "load": "40 lb each", "sets": 3, "reps": "8\u201312", "rest": "2 min"}, {"name": "Seated DB Shoulder Press", "load": "30 lb each", "sets": 3, "reps": "8\u201312", "rest": "2 min"}, {"name": "DB Lateral Raise", "load": "15 lb each", "sets": 3, "reps": "12\u201320", "rest": "60\u201390 sec"}, {"name": "Pulley Triceps Pressdown", "load": "20 lb", "sets": 3, "reps": "10\u201315", "rest": "60\u201390 sec"}]}, "Tuesday": {"title": "Pull A", "exercises": [{"name": "Hyperbell Bent-Over Row", "load": "2 \u00d7 50 lb DBs", "sets": 4, "reps": "6\u201310", "rest": "2\u20133 min"}, {"name": "One-Arm DB Row", "load": "50 lb", "sets": 3, "reps": "8\u201312/side", "rest": "2 min"}, {"name": "Pulley Lat Pulldown", "load": "40 lb", "sets": 3, "reps": "8\u201312", "rest": "2 min"}, {"name": "Pulley Face Pull", "load": "15 lb", "sets": 3, "reps": "12\u201320", "rest": "60\u201390 sec"}, {"name": "Jayflex EZ-Bar Curl", "load": "2 \u00d7 20 lb DBs", "sets": 3, "reps": "8\u201312", "rest": "60\u201390 sec"}]}, "Wednesday": {"title": "Legs A", "exercises": [{"name": "Hyperbell Romanian Deadlift", "load": "2 \u00d7 50 lb DBs", "sets": 4, "reps": "8\u201312", "rest": "2\u20133 min"}, {"name": "Goblet Squat", "load": "50 lb", "sets": 4, "reps": "10\u201315", "rest": "2 min"}, {"name": "Bulgarian Split Squat", "load": "30 lb each", "sets": 3, "reps": "8\u201312/side", "rest": "2 min"}, {"name": "DB Hip Thrust on Bench", "load": "50 lb", "sets": 3, "reps": "10\u201315", "rest": "90 sec"}, {"name": "Single-Leg Calf Raise", "load": "30 lb", "sets": 3, "reps": "12\u201320/side", "rest": "60 sec"}, {"name": "Plank", "load": "Bodyweight", "sets": 3, "reps": "30\u201360 sec", "rest": "60 sec"}]}, "Thursday": {"title": "Push B", "exercises": [{"name": "Incline DB Bench Press", "load": "40 lb each", "sets": 4, "reps": "8\u201312", "rest": "2 min"}, {"name": "Decline DB Bench Press", "load": "50 lb each", "sets": 3, "reps": "8\u201312", "rest": "2 min"}, {"name": "One-Arm Pulley Chest Fly", "load": "15 lb", "sets": 3, "reps": "12\u201320/side", "rest": "60\u201390 sec"}, {"name": "Lean-Away Pulley Lateral Raise", "load": "15 lb", "sets": 3, "reps": "12\u201320/side", "rest": "60 sec"}, {"name": "Overhead DB Triceps Extension", "load": "30 lb", "sets": 3, "reps": "10\u201315", "rest": "60\u201390 sec"}, {"name": "Push-Up", "load": "Bodyweight", "sets": 2, "reps": "Near failure", "rest": "90 sec"}]}, "Friday": {"title": "Pull B", "exercises": [{"name": "Chest-Supported DB Row", "load": "40 lb each", "sets": 4, "reps": "8\u201312", "rest": "2 min"}, {"name": "Pulley Straight-Arm Pulldown", "load": "20 lb", "sets": 3, "reps": "10\u201315", "rest": "60\u201390 sec"}, {"name": "One-Arm Pulley Row", "load": "30 lb", "sets": 3, "reps": "10\u201315/side", "rest": "90 sec"}, {"name": "Incline Rear-Delt DB Fly", "load": "15 lb each", "sets": 3, "reps": "12\u201320", "rest": "60 sec"}, {"name": "DB Hammer Curl", "load": "20 lb each", "sets": 3, "reps": "8\u201312", "rest": "60\u201390 sec"}, {"name": "Jayflex EZ-Bar Reverse Curl", "load": "2 \u00d7 15 lb DBs", "sets": 2, "reps": "10\u201315", "rest": "60 sec"}]}, "Saturday": {"title": "Legs B + Athletic", "exercises": [{"name": "Hyperbell Front Squat", "load": "2 \u00d7 40 lb DBs", "sets": 4, "reps": "8\u201312", "rest": "2\u20133 min"}, {"name": "DB Reverse Lunge", "load": "30 lb each", "sets": 3, "reps": "8\u201312/side", "rest": "2 min"}, {"name": "Single-Leg Romanian Deadlift", "load": "30 lb", "sets": 3, "reps": "10\u201315/side", "rest": "90 sec"}, {"name": "DB Step-Up", "load": "20 lb each", "sets": 3, "reps": "10\u201312/side", "rest": "90 sec"}, {"name": "Farmer Carry", "load": "50 lb each", "sets": 4, "reps": "30\u201345 sec", "rest": "60 sec"}, {"name": "Dead Bug", "load": "Bodyweight", "sets": 3, "reps": "8\u201312/side", "rest": "60 sec"}]}, "Sunday": {"title": "Recovery", "exercises": [{"name": "Easy walk or light bike", "load": "Bodyweight", "sets": 1, "reps": "30\u201345 min", "rest": "\u2014"}, {"name": "Mobility: hips, chest, shoulders", "load": "Bodyweight", "sets": 1, "reps": "10 min", "rest": "\u2014"}, {"name": "Optional easy stretching", "load": "Bodyweight", "sets": 1, "reps": "5\u201310 min", "rest": "\u2014"}]}};
const WEEK_PLAN = {"1": ["Base", "Use listed load", "Bottom of rep range", "2\u20133 RIR", "Normal tempo"], "2": ["Build", "Same load", "+1 rep per set where possible", "2 RIR", "Normal tempo"], "3": ["Build", "Same load", "+1 rep per set again", "1\u20132 RIR", "Normal tempo"], "4": ["Deload", "Same load", "2 sets only; low end", "4 RIR", "Controlled"], "5": ["Base+", "Same or next available load if earned", "Bottom of range", "2\u20133 RIR", "Normal tempo"], "6": ["Build", "Same load", "+1 rep per set", "2 RIR", "Normal tempo"], "7": ["Build", "Same load", "+1 rep per set", "1\u20132 RIR", "Normal tempo"], "8": ["Deload", "Same load", "2 sets only; low end", "4 RIR", "Controlled"], "9": ["Intensify", "Heaviest controlled available load", "Low\u2013middle range", "2 RIR", "3-sec lowering"], "10": ["Build", "Same load", "+1 rep per set", "1\u20132 RIR", "3-sec lowering"], "11": ["Build", "Same load", "Top of range where possible", "1 RIR", "3-sec lowering"], "12": ["Deload", "One step lighter where practical", "2 sets at low end", "4 RIR", "Normal tempo"], "13": ["Peak", "Heaviest controlled available load", "Minimum reps", "2 RIR", "1-sec pause"], "14": ["Build", "Same load", "+1 rep per set", "1\u20132 RIR", "Pause reps"], "15": ["Performance", "Same load", "Beat Week 14 total reps", "0\u20131 RIR final set only", "Controlled"], "16": ["Reset", "Listed base load or lighter", "2 easy sets", "4\u20135 RIR", "Normal tempo"]};
const DAYS = Object.keys(PROGRAM);
const STORAGE_KEY = "macWorkoutDataV1";

let state = loadState();
function blankState(){return {currentWeek:1,dark:false,logs:{},checkins:{},finished:{},selectedWorkoutDay:""}}
function loadState(){try{return Object.assign(blankState(),JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}"));}catch(e){return blankState();}}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));scheduleCloudSave();}
function keyFor(day,exIndex){return `${state.currentWeek}|${day}|${exIndex}`;}
function dayName(){return DAYS[(new Date()).getDay()===0?6:(new Date()).getDay()-1];}
function dateLabel(){return new Date().toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"});}
function setOptions(el){el.innerHTML="";for(let i=1;i<=16;i++){const o=document.createElement("option");o.value=i;o.textContent=`Week ${i}`;el.appendChild(o)}el.value=state.currentWeek;}
function activeWorkoutDay(){
 const selected=document.getElementById("todayWorkoutSelect")?.value;
 return selected||state.selectedWorkoutDay||dayName();
}
function renderToday(){
 const scheduled=dayName(),day=activeWorkoutDay(),workout=PROGRAM[day],guide=WEEK_PLAN[String(state.currentWeek)];
 document.getElementById("todayDate").textContent=dateLabel();
 document.getElementById("todayWorkout").textContent=`${day} — ${workout.title}`;
 document.getElementById("currentWeekLabel").textContent=state.currentWeek;
 document.getElementById("weekGuidance").textContent=`${guide[0]}: ${guide[1]} • ${guide[2]} • ${guide[3]} • ${guide[4]}`;
 const note=document.getElementById("scheduleNote");
 if(note){
   note.textContent=day===scheduled
     ? `Scheduled for today: ${scheduled} — ${PROGRAM[scheduled].title}`
     : `Make-up workout selected: ${day} — ${workout.title}. Today’s scheduled workout is ${scheduled} — ${PROGRAM[scheduled].title}.`;
 }
 const list=document.getElementById("exerciseList");list.innerHTML="";
 workout.exercises.forEach((ex,i)=>list.appendChild(makeExercise(day,ex,i,true)));
}
function makeExercise(day,ex,i,editable){
 const card=document.createElement("article");card.className="exercise-card card";card.dataset.index=i;
 const saved=state.logs[keyFor(day,i)]||{sets:Array(ex.sets).fill(""),rir:"",load:ex.load,skipped:false};
 if(saved.skipped)card.classList.add("skipped");
 const head=document.createElement("div");head.className="exercise-head";
 head.innerHTML=`<div><h3 class="exercise-name">${ex.name}</h3><div class="exercise-prescription">${ex.load} • ${ex.sets} × ${ex.reps} • Rest ${ex.rest}</div></div>`;
 if(editable){const b=document.createElement("button");b.className="skip-btn";b.textContent=saved.skipped?"Undo":"Skip";b.onclick=()=>{saved.skipped=!saved.skipped;state.logs[keyFor(day,i)]=saved;saveState();renderToday();};head.appendChild(b)}
 card.appendChild(head);
 const sets=document.createElement("div");sets.className="sets";
 for(let s=0;s<ex.sets;s++){const row=document.createElement("div");row.className="set-row"+(saved.sets[s]?" done":"");row.innerHTML=`<span>Set ${s+1}</span>`;const inp=document.createElement("input");inp.type="text";inp.inputMode="numeric";inp.placeholder=ex.reps;inp.value=saved.sets[s]||"";inp.disabled=!editable;inp.oninput=()=>{saved.sets[s]=inp.value;state.logs[keyFor(day,i)]=saved;saveState();row.classList.toggle("done",!!inp.value)};row.appendChild(inp);sets.appendChild(row)}card.appendChild(sets);
 const foot=document.createElement("div");foot.className="exercise-footer";
 const rir=document.createElement("label");rir.innerHTML='RIR<select><option value="">—</option><option>0</option><option>1</option><option>2</option><option>3</option><option>4+</option></select>';rir.querySelector("select").value=saved.rir;rir.querySelector("select").disabled=!editable;rir.querySelector("select").onchange=e=>{saved.rir=e.target.value;state.logs[keyFor(day,i)]=saved;saveState()};
 const load=document.createElement("label");load.innerHTML='Actual load<input type="text">';load.querySelector("input").value=saved.load||ex.load;load.querySelector("input").disabled=!editable;load.querySelector("input").oninput=e=>{saved.load=e.target.value;state.logs[keyFor(day,i)]=saved;saveState()};
 foot.append(rir,load);card.appendChild(foot);return card;
}
function renderProgram(){const day=document.getElementById("programDaySelect").value||dayName(),list=document.getElementById("programList");list.innerHTML="";PROGRAM[day].exercises.forEach((ex,i)=>list.appendChild(makeExercise(day,ex,i,false)));}
function finishWorkout(){const day=activeWorkoutDay();state.finished[`${state.currentWeek}|${day}`]=true;saveState();alert(`${day} — ${PROGRAM[day].title} saved. Strong work.`);renderProgress();}
function saveCheckin(){
 const w=state.currentWeek;state.checkins[w]={weight:val("bodyWeight"),waist:val("waist"),sleep:val("sleep"),energy:val("energy"),soreness:val("soreness"),notes:val("weeklyNotes"),date:new Date().toISOString()};saveState();renderProgress();alert("Weekly check-in saved.");
}
function val(id){return document.getElementById(id).value}
function renderProgress(){
 const finished=Object.keys(state.finished).filter(k=>state.finished[k]).length,planned=state.currentWeek*6;
 document.getElementById("statWorkouts").textContent=finished;
 document.getElementById("statAdherence").textContent=`${Math.min(100,Math.round(finished/Math.max(1,planned)*100))}%`;
 const checks=Object.entries(state.checkins).sort((a,b)=>Number(a[0])-Number(b[0]));const latest=checks.at(-1)?.[1]||{};
 document.getElementById("statWeight").textContent=latest.weight?latest.weight+" lb":"—";document.getElementById("statWaist").textContent=latest.waist?latest.waist+' in':"—";
 const cur=state.checkins[state.currentWeek]||{};for(const id of ["bodyWeight","waist","sleep","energy","soreness","weeklyNotes"])document.getElementById(id).value=cur[{bodyWeight:"weight",waist:"waist",sleep:"sleep",energy:"energy",soreness:"soreness",weeklyNotes:"notes"}[id]]||"";
 const h=document.getElementById("historyList");h.innerHTML="";for(let w=1;w<=16;w++){const c=state.checkins[w]||{},done=Object.keys(state.finished).filter(k=>k.startsWith(w+"|")&&state.finished[k]).length;const d=document.createElement("div");d.className="history-item";d.innerHTML=`<strong>W${w}</strong><div>${c.weight?c.weight+" lb":"No check-in"}<div class="muted">${c.notes||""}</div></div><span class="badge">${done} workouts</span>`;h.appendChild(d)}drawChart(checks);
}
function drawChart(checks){const c=document.getElementById("weightChart"),ctx=c.getContext("2d"),ratio=devicePixelRatio||1,w=c.clientWidth||320,h=190;c.width=w*ratio;c.height=h*ratio;ctx.scale(ratio,ratio);ctx.clearRect(0,0,w,h);const pts=checks.filter(x=>Number(x[1].weight));if(pts.length<1){ctx.fillStyle=getComputedStyle(document.body).getPropertyValue("--muted");ctx.font="14px -apple-system";ctx.fillText("Add weekly weights to see your trend.",14,28);return}const vals=pts.map(x=>Number(x[1].weight)),min=Math.min(...vals)-2,max=Math.max(...vals)+2,pad=28;ctx.strokeStyle="#d9e2ec";ctx.beginPath();ctx.moveTo(pad,10);ctx.lineTo(pad,h-pad);ctx.lineTo(w-8,h-pad);ctx.stroke();ctx.strokeStyle="#1f6feb";ctx.lineWidth=3;ctx.beginPath();pts.forEach((p,i)=>{const x=pad+(w-pad-12)*(i/Math.max(1,pts.length-1)),y=10+(h-pad-14)*(1-(Number(p[1].weight)-min)/(max-min||1));i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();}
function exportData(){const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`mac-workout-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href)}
function importData(file){const r=new FileReader();r.onload=()=>{try{state=Object.assign(blankState(),JSON.parse(r.result));saveState();location.reload()}catch(e){alert("That backup file could not be read.")}};r.readAsText(file)}
function showScreen(id,title){document.querySelectorAll(".screen").forEach(s=>s.classList.toggle("active",s.id===id));document.querySelectorAll(".bottom-nav button").forEach(b=>b.classList.toggle("active",b.dataset.screen===id));document.getElementById("screenTitle").textContent=title;if(id==="progressScreen")renderProgress();if(id==="programScreen")renderProgram();window.scrollTo(0,0)}
function init(){
 if(appInitialized) return;
 appInitialized = true;

 document.body.classList.toggle("dark",state.dark);

 ["weekSelect","settingsWeekSelect"].forEach(id=>{
   const e=document.getElementById(id);
   setOptions(e);
   e.onchange=()=>{
     state.currentWeek=Number(e.value);
     saveState();
     document.getElementById("weekSelect").value=state.currentWeek;
     document.getElementById("settingsWeekSelect").value=state.currentWeek;
     renderToday();
     renderProgress();
   };
 });

 const todaySelect=document.getElementById("todayWorkoutSelect");
 todaySelect.innerHTML="";
 DAYS.forEach(d=>{
   const o=document.createElement("option");
   o.value=d;
   o.textContent=d+" — "+PROGRAM[d].title;
   todaySelect.appendChild(o);
 });
 const initialDay=state.selectedWorkoutDay&&PROGRAM[state.selectedWorkoutDay]
   ? state.selectedWorkoutDay
   : dayName();
 todaySelect.value=initialDay;
 state.selectedWorkoutDay=initialDay;
 todaySelect.onchange=()=>{
   state.selectedWorkoutDay=todaySelect.value;
   saveState();
   renderToday();
 };

 const ds=document.getElementById("programDaySelect");
 ds.innerHTML="";
 DAYS.forEach(d=>{
   const o=document.createElement("option");
   o.value=d;
   o.textContent=d+" — "+PROGRAM[d].title;
   ds.appendChild(o);
 });
 ds.value=dayName();
 ds.onchange=renderProgram;

 document.querySelectorAll(".bottom-nav button").forEach(b=>{
   b.onclick=()=>showScreen(
     b.dataset.screen,
     b.textContent.trim().replace(/[●▦↗⚙]/g,"")
   );
 });

 document.getElementById("themeBtn").onclick=()=>{
   state.dark=!state.dark;
   saveState();
   document.body.classList.toggle("dark",state.dark);
   renderProgress();
 };

 document.getElementById("finishWorkoutBtn").onclick=finishWorkout;
 document.getElementById("saveCheckinBtn").onclick=saveCheckin;
 document.getElementById("exportBtn").onclick=exportData;
 document.getElementById("importInput").onchange=e=>e.target.files[0]&&importData(e.target.files[0]);
 document.getElementById("resetBtn").onclick=()=>{
   if(confirm("Erase all workout entries and progress?")){
     localStorage.removeItem(STORAGE_KEY);
     location.reload();
   }
 };

 renderToday();
 renderProgram();
 renderProgress();

 if("serviceWorker" in navigator){
   navigator.serviceWorker.register("service-worker.js").catch(()=>{});
 }
}

function bindAuthControls() {
  const signInButton = document.getElementById("signInBtn");
  signInButton.addEventListener("click", async () => {
    const email = val("authEmail").trim();
    const password = val("authPassword");

    if (!email || !password) {
      showAuthMessage("Enter both your email and password.");
      return;
    }

    const originalText = signInButton.textContent;
    signInButton.disabled = true;
    signInButton.textContent = "Signing in…";
    showAuthMessage("Connecting to Firebase…", false);

    const timeoutId = setTimeout(() => {
      if (signInButton.disabled) {
        showAuthMessage("Sign-in is taking too long. Check your connection and try again.");
        signInButton.disabled = false;
        signInButton.textContent = originalText;
      }
    }, 12000);

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      clearTimeout(timeoutId);

      currentUser = credential.user;
      document.getElementById("authGate").classList.add("hidden");
      document.getElementById("accountEmail").textContent = credential.user.email || "Signed in";
      setSyncStatus("Loading…", "warn");
      applyStateToUi();

      loadCloudState(credential.user).catch(() => {
        cloudReady = true;
        setSyncStatus("Offline", "warn");
      });
    } catch (error) {
      clearTimeout(timeoutId);
      showAuthMessage(friendlyAuthError(error));
      signInButton.disabled = false;
      signInButton.textContent = originalText;
    }
  });

  document.getElementById("createAccountBtn").addEventListener("click", async () => {
    showAuthMessage("");
    try {
      await createUserWithEmailAndPassword(auth, val("authEmail").trim(), val("authPassword"));
      showAuthMessage("Account created.", false);
    } catch (error) {
      showAuthMessage(friendlyAuthError(error));
    }
  });

  document.getElementById("forgotPasswordBtn").addEventListener("click", async () => {
    const email = val("authEmail").trim();
    if (!email) {
      showAuthMessage("Enter your email first.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      showAuthMessage("Password-reset email sent.", false);
    } catch (error) {
      showAuthMessage(friendlyAuthError(error));
    }
  });

  document.getElementById("signOutBtn").addEventListener("click", () => signOut(auth));
  document.getElementById("syncNowBtn").addEventListener("click", () => {
    saveCloudState(true).catch(() => setSyncStatus("Sync error", "bad"));
  });
  document.getElementById("accountBtn").addEventListener("click", () => {
    showScreen("settingsScreen", "Settings");
  });
}

init();
bindAuthControls();

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  const gate = document.getElementById("authGate");
  const email = document.getElementById("accountEmail");

  if (!user) {
    cloudReady = false;
    setSyncStatus("Signed out");
    email.textContent = "Not signed in";
    gate.classList.remove("hidden");
    return;
  }

  gate.classList.add("hidden");
  email.textContent = user.email || "Signed in";
  setSyncStatus("Connecting…", "warn");
  applyStateToUi();

  try {
    await loadCloudState(user);
  } catch (error) {
    cloudReady = true;
    setSyncStatus(navigator.onLine ? "Cloud error" : "Offline", navigator.onLine ? "bad" : "warn");
    applyStateToUi();
  }
});

window.addEventListener("online", () => {
  if (currentUser) saveCloudState(true).catch(() => setSyncStatus("Sync error", "bad"));
});
window.addEventListener("offline", () => setSyncStatus("Offline", "warn"));
