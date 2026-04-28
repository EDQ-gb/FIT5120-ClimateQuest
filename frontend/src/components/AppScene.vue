<template>
  <div class="page">
    <!-- Canvas scene -->
    <div class="scene-wrap">
      <canvas ref="cvs"></canvas>
      <div class="scene-hud">
        <div>
          <div class="hud-name">{{ sceneLabel }}</div>
          <div class="hud-sub">Complete tasks to restore your scene</div>
        </div>
        <div class="hud-pct">{{ scene.progress||0 }}%</div>
      </div>
    </div>

    <!-- Progress bar -->
    <div class="prog-row">
      <span class="sub-text">Restore progress</span>
      <span class="cyan fw7">{{ scene.progress||0 }}%</span>
    </div>
    <div class="prog-track"><div class="prog-fill" :style="{ width: (scene.progress||0)+'%' }"></div></div>

    <!-- Habitat selector -->
    <div>
      <div class="card-title">Choose Your Habitat</div>
      <div class="habitat-row">
        <div v-for="opt in opts" :key="opt.type"
             class="habitat-opt" :class="{ active: scene.type===opt.type }"
             @click="select(opt.type)">
          <div class="opt-icon">{{ opt.icon }}</div>
          <div class="opt-name">{{ opt.name }}</div>
          <div class="opt-desc">{{ opt.desc }}</div>
        </div>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid-2">
      <div class="glass-card">
        <div class="stat-label">CO₂ Saved</div>
        <div class="stat-num cyan">{{ ((co2Saved)/1000).toFixed(2) }}</div>
        <div class="sub-text">kg CO₂ → scene growth</div>
      </div>
      <div class="glass-card">
        <div class="stat-label">Tasks Completed</div>
        <div class="stat-num green">{{ allTimeTasks }}</div>
        <div class="sub-text">total actions taken</div>
      </div>
    </div>

    <div class="info-card">
      <div class="info-title">🌱 How your scene grows</div>
      <p class="info-body">Every task adds 2% to your restore progress. Correct quiz answers add 3%. Each point represents real CO₂ saved — calculated using Australian Government NGA Emission Factors.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { getScene as fetchScene, selectScene, getProgress } from '../api/features.js'

defineProps({ user: Object })

const cvs         = ref(null)
const scene       = ref({ type: 'forest', progress: 0 })
const co2Saved    = ref(0)
const allTimeTasks = ref(0)

const sceneLabel = computed(() => ({ forest:'🌲 Rainforest', glacier:'❄️ Polar Glacier', desert:'🌵 Desert Oasis' }[scene.value.type] || '🌍 Scene'))

const opts = [
  { type:'forest',  icon:'🌲', name:'Forest',  desc:'Regrow lost rainforest' },
  { type:'glacier', icon:'❄️', name:'Glacier', desc:'Reform Arctic ice'      },
  { type:'desert',  icon:'🌵', name:'Desert',  desc:'Restore desert oasis'   },
]

async function select(type) {
  if (scene.value.type === type) return
  const res = await selectScene(type)
  if (res) { scene.value = res; draw() }
}

// ── Canvas ───────────────────────────────────────────────────────────────────
function lerp(a,b,t){ return a+(b-a)*t }
function lerpColor(c1,c2,t){
  const h = s=>[parseInt(s.slice(1,3),16),parseInt(s.slice(3,5),16),parseInt(s.slice(5,7),16)]
  const [r1,g1,b1]=h(c1),[r2,g2,b2]=h(c2)
  return `rgb(${Math.round(lerp(r1,r2,t))},${Math.round(lerp(g1,g2,t))},${Math.round(lerp(b1,b2,t))})`
}
function seeded(n,lo,hi,seed){ let s=seed; const a=[]; for(let i=0;i<n;i++){s=(s*9301+49297)%233280;a.push(lo+(hi-lo)*s/233280)} return a }

function draw(){
  const canvas=cvs.value; if(!canvas) return
  const dpr=window.devicePixelRatio||1
  const cw=canvas.offsetWidth, ch=canvas.offsetHeight
  if(!cw||!ch) return
  canvas.width=cw*dpr; canvas.height=ch*dpr
  const ctx=canvas.getContext('2d'); ctx.scale(dpr,dpr)
  const W=cw, H=ch, p=Math.max(0,Math.min(100,scene.value.progress||0))
  if(scene.value.type==='glacier') drawGlacier(ctx,W,H,p)
  else if(scene.value.type==='desert') drawDesert(ctx,W,H,p)
  else drawForest(ctx,W,H,p)
}

function drawForest(ctx,W,H,p){
  const pn=p/100
  const skyG=ctx.createLinearGradient(0,0,0,H*.6)
  // Softer, less saturated palette (eye-friendly)
  skyG.addColorStop(0,lerpColor('#14201b','#3b5c52',pn)); skyG.addColorStop(1,lerpColor('#1b2a20','#5b845f',pn))
  ctx.fillStyle=skyG; ctx.fillRect(0,0,W,H)
  if(p>15){ const b=Math.min(1,(p-15)/50),sg=ctx.createRadialGradient(W*.72,H*.12,0,W*.72,H*.12,70); sg.addColorStop(0,`rgba(255,238,170,${.16+b*.28})`); sg.addColorStop(.4,`rgba(255,216,132,${.10+b*.14})`); sg.addColorStop(1,'rgba(255,200,120,0)'); ctx.fillStyle=sg; ctx.beginPath(); ctx.arc(W*.72,H*.12,70,0,Math.PI*2); ctx.fill(); ctx.fillStyle=`rgba(255,246,214,${.45+b*.18})`; ctx.beginPath(); ctx.arc(W*.72,H*.12,13,0,Math.PI*2); ctx.fill() }
  ctx.fillStyle=lerpColor('#16231c','#3d6350',pn); ctx.beginPath(); ctx.moveTo(0,H*.55); ctx.bezierCurveTo(W*.18,H*.38,W*.38,H*.44,W*.5,H*.46); ctx.bezierCurveTo(W*.65,H*.49,W*.82,H*.36,W,H*.44); ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.closePath(); ctx.fill()
  const gG=ctx.createLinearGradient(0,H*.6,0,H); gG.addColorStop(0,lerpColor('#1a2a1d','#67a26f',pn)); gG.addColorStop(1,lerpColor('#0f1712','#35523a',pn)); ctx.fillStyle=gG; ctx.fillRect(0,H*.6,W,H*.4)
  const maxT=18,numT=Math.ceil(p/100*maxT),xs=seeded(maxT,W*.06,W*.94,7),szs=seeded(maxT,.5,1.1,77)
  for(let i=0;i<numT;i++){ const x=xs[i],sz=szs[i],baseY=H*.63+(xs[i]/W)*H*.06; drawTree(ctx,x,baseY,sz,pn) }
  if(p<40){ const mg=ctx.createLinearGradient(0,H*.55,0,H*.75); mg.addColorStop(0,'rgba(20,30,20,0)'); mg.addColorStop(.5,`rgba(8,18,8,${.35*(1-p/40)})`); mg.addColorStop(1,'rgba(4,10,4,0)'); ctx.fillStyle=mg; ctx.fillRect(0,H*.55,W,H*.2) }
  drawHUD(ctx,W,H,'🌲',p)
}
function drawTree(ctx,x,baseY,sz,pn){
  const h=72*sz,trunk=h*.22; ctx.save(); ctx.translate(x,baseY)
  ctx.fillStyle=lerpColor('#1a0c06','#4a2810',pn); ctx.beginPath(); ctx.moveTo(-5*sz,0); ctx.lineTo(5*sz,0); ctx.lineTo(3*sz,-trunk); ctx.lineTo(-3*sz,-trunk); ctx.closePath(); ctx.fill()
  ;[1.0,.76,.54].forEach((sc,i)=>{ const cy=-trunk-h*.28*i,cg=ctx.createRadialGradient(0,cy-8*sc,1,0,cy,30*sz*sc); cg.addColorStop(0,lerpColor('#143018','#5d8f55',pn)); cg.addColorStop(1,lerpColor('#0f1d12','#345a35',pn)); ctx.fillStyle=cg; ctx.beginPath(); ctx.ellipse(0,cy,28*sz*sc,28*sz*sc,0,0,Math.PI*2); ctx.fill() })
  ctx.restore()
}
function drawGlacier(ctx,W,H,p){
  const pn=p/100
  const sg=ctx.createLinearGradient(0,0,0,H*.5); sg.addColorStop(0,lerpColor('#0e1220','#1a2a42',pn)); sg.addColorStop(1,lerpColor('#0f1c2c','#2f5b86',pn)); ctx.fillStyle=sg; ctx.fillRect(0,0,W,H)
  if(p>10){ const ab=Math.min(1,(p-10)/55); [['#9be7d6','#9db7ff',.14],['#a8d8ff','#c4a7ff',.22]].forEach(([c1,c2,ny])=>{ const y=H*ny,aG=ctx.createLinearGradient(0,0,W,0); const al=Math.round(ab*36).toString(16).padStart(2,'0'); aG.addColorStop(0,c1+'00'); aG.addColorStop(.3,c1+al); aG.addColorStop(.7,c2+al); aG.addColorStop(1,c2+'00'); ctx.fillStyle=aG; ctx.beginPath(); ctx.moveTo(0,y-18); ctx.bezierCurveTo(W*.4,y-30,W*.7,y-10,W,y-18); ctx.lineTo(W,y+18); ctx.bezierCurveTo(W*.7,y+30,W*.4,y+10,0,y+18); ctx.closePath(); ctx.fill() }) }
  const seaG=ctx.createLinearGradient(0,H*.45,0,H); seaG.addColorStop(0,lerpColor('#0f2234','#1d4e7b',pn)); seaG.addColorStop(1,lerpColor('#081321','#0f2a44',pn)); ctx.fillStyle=seaG; ctx.fillRect(0,H*.45,W,H)
  ctx.fillStyle=lerpColor('#132433','#d7ebf7',pn); ctx.beginPath(); ctx.moveTo(0,H*.52); ctx.bezierCurveTo(W*.22,H*.44,W*.48,H*.5,W*.56,H*.47); ctx.bezierCurveTo(W*.72,H*.43,W*.88,H*.5,W,H*.48); ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.closePath(); ctx.fill()
  const maxI=10,numI=Math.max(2,Math.floor(p/100*maxI)),ixs=seeded(maxI,W*.05,W*.92,33),iszs=seeded(maxI,.45,1.2,66)
  for(let i=0;i<numI;i++){ const x=ixs[i],sz=iszs[i],h=60*sz*(.18+pn*.82); ctx.save(); ctx.translate(x,H*.47+(x/W)*H*.06); const ig=ctx.createLinearGradient(0,-h,0,0); ig.addColorStop(0,lerpColor('#1c2e3a','#dceef8',pn)); ig.addColorStop(1,lerpColor('#111e28','#a8cce0',pn)); ctx.fillStyle=ig; ctx.beginPath(); ctx.moveTo(0,-h); ctx.lineTo(26*sz,0); ctx.lineTo(-22*sz,0); ctx.closePath(); ctx.fill(); ctx.restore() }
  drawHUD(ctx,W,H,'❄️',p)
}
function drawDesert(ctx,W,H,p){
  const pn=p/100
  // Softer desert palette
  const skyG=ctx.createLinearGradient(0,0,0,H*.55); skyG.addColorStop(0,lerpColor('#211617','#3a2830',pn)); skyG.addColorStop(1,lerpColor('#c08a62','#e2b07a',pn)); ctx.fillStyle=skyG; ctx.fillRect(0,0,W,H)
  const sunG=ctx.createRadialGradient(W*.68,H*.14,0,W*.68,H*.14,70); sunG.addColorStop(0,`rgba(255,226,170,${.22+pn*.32})`); sunG.addColorStop(.5,`rgba(255,206,140,${.12+pn*.18})`); sunG.addColorStop(1,'rgba(255,190,120,0)'); ctx.fillStyle=sunG; ctx.beginPath(); ctx.arc(W*.68,H*.14,70,0,Math.PI*2); ctx.fill(); ctx.fillStyle=`rgba(255,246,214,${.55+pn*.15})`; ctx.beginPath(); ctx.arc(W*.68,H*.14,16,0,Math.PI*2); ctx.fill()
  const sandG=ctx.createLinearGradient(0,H*.5,0,H); sandG.addColorStop(0,lerpColor('#3b2a1a','#e0c49a',pn)); sandG.addColorStop(1,lerpColor('#24170e','#b38b5a',pn)); ctx.fillStyle=sandG; ctx.fillRect(0,H*.5,W,H*.5)
  ;[[.35,.55],[.70,.58],[.10,.62]].forEach(([dx,bot])=>{ const dG=ctx.createLinearGradient(0,H*.6,0,H*bot); dG.addColorStop(0,lerpColor('#2b1b0f','#c2a06e',pn)); dG.addColorStop(1,lerpColor('#1e1209','#8e6b3e',pn)); ctx.fillStyle=dG; ctx.beginPath(); ctx.moveTo(0,H*bot); ctx.bezierCurveTo(W*(dx+.1),H*.62,W*(dx+.28),H*(bot-.03),W*(dx+.42),H*(bot-.03)); ctx.bezierCurveTo(W*(dx+.58),H*(bot+.02),W*(dx+.72),H*(bot-.01),W,H*bot); ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.closePath(); ctx.fill() })
  if(p>8){ const oR=W*.06+W*.11*pn,ox=W*.38,oy=H*.62,oG=ctx.createRadialGradient(ox,oy,0,ox,oy,oR); oG.addColorStop(0,`rgba(84,136,170,${.28+pn*.32})`); oG.addColorStop(.6,`rgba(46,96,132,${.20+pn*.20})`); oG.addColorStop(1,'rgba(20,50,80,0)'); ctx.fillStyle=oG; ctx.beginPath(); ctx.ellipse(ox,oy,oR,oR*.55,0,0,Math.PI*2); ctx.fill() }
  drawHUD(ctx,W,H,'🌵',p)
}
function drawHUD(ctx,W,H,icon,p){
  ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.roundRect(W-115,H-44,106,32,8); ctx.fill()
  ctx.fillStyle='rgba(255,255,255,0.78)'; ctx.font='bold 11px Inter'; ctx.textAlign='right'; ctx.textBaseline='middle'
  ctx.fillText(`${icon} ${p}% restored`,W-14,H-28); ctx.textAlign='left'; ctx.textBaseline='alphabetic'
}

onMounted(async () => {
  const [s, prog] = await Promise.all([fetchScene(), getProgress()])
  if (s) scene.value = s
  if (prog) { co2Saved.value = prog.co2Saved||0; allTimeTasks.value = prog.allTimeTasks||0 }
  draw()
  window.addEventListener('resize', draw)
})
onUnmounted(() => window.removeEventListener('resize', draw))
watch(() => [scene.value.type, scene.value.progress], draw)
</script>

<style scoped>
.page    { display:flex;flex-direction:column;gap:16px; }
.scene-wrap { position:relative;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.12);background:#0d1512; }
canvas   { display:block;width:100%;height:280px; }
.scene-hud { position:absolute;bottom:0;left:0;right:0;padding:12px 18px;background:linear-gradient(transparent,rgba(0,0,0,0.65));display:flex;align-items:center;justify-content:space-between; }
.hud-name { font-size:.95rem;font-weight:700;color:#fff; }
.hud-sub  { font-size:.72rem;color:rgba(255,255,255,0.5);margin-top:2px; }
.hud-pct  { font-size:1.5rem;font-weight:800;color:#a7e1dd; }
.prog-row { display:flex;align-items:center;justify-content:space-between;margin-bottom:6px; }
.prog-track { background:rgba(255,255,255,0.1);border-radius:99px;height:7px;overflow:hidden; }
.prog-fill  { height:100%;border-radius:99px;transition:width .6s;background:linear-gradient(90deg,#2f8f86,#a7e1dd); }
.sub-text { font-size:.78rem;color:rgba(255,255,255,0.4); }
.cyan  { color:#a7e1dd; }
.green { color:#52d496; }
.fw7   { font-weight:700; }
.card-title { font-size:.72rem;font-weight:700;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:1.2px;margin-bottom:10px; }
.habitat-row { display:flex;gap:12px; }
.habitat-opt { flex:1;padding:16px 12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:12px;text-align:center;cursor:pointer;transition:all .25s; }
.habitat-opt:hover { border-color:rgba(167,225,221,0.45); }
.habitat-opt.active { border-color:#a7e1dd;background:rgba(167,225,221,0.10); }
.opt-icon { font-size:1.8rem;margin-bottom:5px; }
.opt-name { font-size:.88rem;font-weight:700;color:#fff;margin-bottom:3px; }
.opt-desc { font-size:.7rem;color:rgba(255,255,255,0.45); }
.grid-2 { display:grid;grid-template-columns:1fr 1fr;gap:14px; }
.glass-card { background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.14);border-radius:16px;padding:20px; }
.stat-label { font-size:.7rem;font-weight:700;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:1.2px;margin-bottom:8px; }
.stat-num   { font-size:2.2rem;font-weight:800;line-height:1; }
.info-card  { background:rgba(82,212,150,0.04);border:1px solid rgba(82,212,150,0.15);border-radius:14px;padding:18px; }
.info-title { font-size:.9rem;font-weight:700;color:#52d496;margin-bottom:8px; }
.info-body  { font-size:.85rem;color:rgba(255,255,255,0.5);line-height:1.55; }
@media(max-width:500px){ .habitat-row{flex-direction:column;} .grid-2{grid-template-columns:1fr;} }
</style>
