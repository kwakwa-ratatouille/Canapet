// canapet-art.js — dessin vectoriel de Cana'pet (direction « Le salon du dimanche »)
// Toutes les fonctions renvoient des chaînes SVG. Aucune dépendance.
// Les textes SVG utilisent la police Fredoka 700 : elle doit être chargée par la page.
/* ===== Base ===== */
const P='#3a2140',ROSE='#ff4f9a',VIO='#7b4dff',SOL='#ffd60a',MEN='#1fc9a0',CIEL='#2ec5ff',NUIT='#2a1838',VIO2='#9b72ff';
const COL=['#ff4f9a','#ff3b3b','#ff9a1f','#ffd60a','#7bd13b','#1fc9a0','#2ec5ff','#3a6bff','#9b5cff','#e08bff','#a0643a','#f2f2f2'];
const COLN=['Rose','Rouge','Orange','Jaune','Vert','Menthe','Ciel','Bleu','Violet','Lilas','Noisette','Blanc'];
const sw=(w=4,c=P)=>`stroke="${c}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const F=`font-family="Fredoka, Nunito, system-ui, sans-serif" font-weight="700"`;
const FT=`font-family="Nunito, system-ui, sans-serif" font-weight="800"`;
const NS='xmlns="http://www.w3.org/2000/svg"';
const svg=(vb,inner,extra='')=>`<svg viewBox="${vb}" ${NS} ${extra}>${inner}</svg>`;
const strip=s=>s.replace(/<[^>]+>/g,'');

function cloudD(cx,cy,s){
  const pts=[[-.9,.45],[-.75,-.3],[.15,-.55],[.85,-.05],[.7,.45]],rs=[.42,.5,.45,.38];
  let d=`M${cx+pts[0][0]*s} ${cy+pts[0][1]*s}`;
  for(let i=1;i<5;i++)d+=`A${rs[i-1]*s} ${rs[i-1]*s} 0 0 1 ${cx+pts[i][0]*s} ${cy+pts[i][1]*s}`;
  d+=`A${3*s} ${3*s} 0 0 1 ${cx+pts[0][0]*s} ${cy+pts[0][1]*s}Z`;
  return d;
}
const cloud=(cx,cy,s,fill='#fff',w=4,st=P)=>`<path d="${cloudD(cx,cy,s)}" fill="${fill}" ${sw(w,st)}/>`;
const cloudSt=(cx,cy,s,fill)=>`<path d="${cloudD(cx,cy+s*.22,s)}" fill="${P}" ${sw(s*.6)}/><path d="${cloudD(cx,cy,s)}" fill="#fff" ${sw(s*.6,'#fff')}/>${cloud(cx,cy,s,fill,Math.max(3,s*.2))}`;
const heart=(x,y,r,fill)=>`<path d="M${x} ${y+r}C${x-r*1.8} ${y-r*.2} ${x-r*.9} ${y-r*1.6} ${x} ${y-r*.5}C${x+r*.9} ${y-r*1.6} ${x+r*1.8} ${y-r*.2} ${x} ${y+r}Z" fill="${fill}" ${sw(Math.max(2,r*.35))}/>`;
function star(x,y,r,fill,w=3){let d='';for(let i=0;i<10;i++){const a=Math.PI/5*i-Math.PI/2,rr=i%2?r*.45:r;d+=(i?'L':'M')+(x+Math.cos(a)*rr).toFixed(1)+' '+(y+Math.sin(a)*rr).toFixed(1);}return `<path d="${d}Z" fill="${fill}" ${sw(w)}/>`}
/* texte « autocollant » : ombre prune + rebord blanc + texte */
function wmText(x,y,size,anchor,content,fill){
  const pl=strip(content);
  return `<text x="${x}" y="${y+size*.08}" font-size="${size}" text-anchor="${anchor}" ${F} fill="${P}" ${sw(size*.28)}>${pl}</text>`+
  `<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}" ${F} fill="#fff" ${sw(size*.28,'#fff')}>${pl}</text>`+
  `<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}" ${F} fill="${fill}" ${sw(size*.11)} paint-order="stroke">${content}</text>`;
}
const plain=(x,y,size,txt,fill=P,anchor='middle',font=F)=>`<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}" ${font} fill="${fill}">${txt}</text>`;
const label=(x,y,size,txt,fill='#fff',anchor='middle')=>`<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}" ${F} fill="${fill}" ${sw(size*.16)} paint-order="stroke">${txt}</text>`;

/* Logotype 400 × 124 */
function wm(mode='cloud'){
  if(mode==='cloud') return wmText(215,92,80,'end','Cana',ROSE)+cloudSt(231,40,15,SOL)+wmText(247,92,80,'start','pet',ROSE);
  return wmText(200,92,80,'middle',`Cana<tspan fill="${SOL}">’</tspan>pet`,ROSE);
}
const wmSvg=(mode,cls='w')=>svg('0 0 400 124',wm(mode),`class="${cls}" role="img" aria-label="Cana'pet"`);

/* ===== Relief bonbon ===== */
const hex2=c=>{c=c.replace('#','');if(c.length===3)c=c.split('').map(x=>x+x).join('');return [0,2,4].map(i=>parseInt(c.slice(i,i+2),16));};
const rgb2=(a)=>'#'+a.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
const mixC=(c,t,k)=>{const a=hex2(c),b=hex2(t);return rgb2(a.map((v,i)=>v+(b[i]-v)*k));};
/** Remplace les couleurs pleines par des dégradés bombés (définis dans le même bout de SVG). */
function relief(str){
  const seen=new Set();
  const out=str.replace(/fill="(#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?)"/g,(m,c)=>{
    const lc=c.toLowerCase();
    if(lc===P) return m;
    const id='cpg'+lc.slice(1);
    seen.add(lc);
    return `fill="url(#${id})"`;
  });
  let defs='';
  for(const c of seen){
    const id='cpg'+c.slice(1);
    const light=mixC(c,'#ffffff',.5),dark=mixC(c,'#3a2140',.28);
    defs+=`<radialGradient id="${id}" cx=".34" cy=".26" r=".9" fx=".3" fy=".2"><stop offset="0" stop-color="${light}"/><stop offset=".5" stop-color="${c}"/><stop offset="1" stop-color="${dark}"/></radialGradient>`;
  }
  return (defs?`<defs>${defs}</defs>`:'')+out;
}

/* ===== Look de chaque perso : [regard, pose] ===== */
const LOOK={coussin:['cool','hip'],tartine:['sleepy','cross'],cornichon:['angry','flex'],beignet:['round','wave'],oeuf:['round','shy'],fromage:['wink','thumbs'],tomate:['angry','cross'],brocoli:['cool','flex'],cupcake:['round','wave'],sushi:['sleepy','hip'],frites:['wink','thumbs'],bonbon:['star','wave'],chaussette:['sleepy','shy'],pizza:['cool','thumbs'],glace:['round','hip'],avocat:['wink','cross'],macaron:['star','shy'],banane:['angry','wave'],nuage:['sleepy','hip'],saucisse:['wink','flex'],champi:['round','shy'],tasse:['sleepy','thumbs'],oignon:['angry','cross'],patate:['cool','hip'],popcorn:['star','wave']};

/** Visage « content », différent selon le regard du perso. */
function faceLook(cx,cy,s,look){
  const e=12.5*s,r=10*s;let g='';
  g+=`<ellipse cx="${cx-20*s}" cy="${cy+11*s}" rx="${5.5*s}" ry="${3*s}" fill="#ff7fb3" opacity=".28"/><ellipse cx="${cx+20*s}" cy="${cy+11*s}" rx="${5.5*s}" ry="${3*s}" fill="#ff7fb3" opacity=".28"/>`;
  const eye=(x,big=1,pupil='dot')=>{
    const rr=r*big;
    let o=`<ellipse cx="${x}" cy="${cy}" rx="${rr}" ry="${rr*1.05}" fill="#fff" ${sw(3*s)}/>`;
    if(pupil==='star') o+=star(x+1*s,cy+1*s,5.5*s*big,SOL,2*s);
    else o+=`<circle cx="${x+1.5*s}" cy="${cy+1.5*s}" r="${4.8*s*big}" fill="${P}"/><circle cx="${x+3.2*s}" cy="${cy-0.8*s}" r="${1.8*s*big}" fill="#fff"/>`;
    return o;
  };
  const lid=(x,depth)=>`<path d="M${x-r-1*s} ${cy+(depth-1)*s}Q${x} ${cy-r-6*s} ${x+r+1*s} ${cy+(depth-1)*s}Q${x} ${cy+(depth-4)*s} ${x-r-1*s} ${cy+(depth-1)*s}Z" fill="${P}"/>`;
  const my=cy+14*s;
  switch(look){
  case 'round':
    g+=eye(cx-e,1.15)+eye(cx+e,1.15);
    g+=`<path d="M${cx-e-6*s} ${cy-17*s}Q${cx-e} ${cy-21*s} ${cx-e+6*s} ${cy-17*s}M${cx+e-6*s} ${cy-17*s}Q${cx+e} ${cy-21*s} ${cx+e+6*s} ${cy-17*s}" fill="none" ${sw(3*s)}/>`;
    g+=`<path d="M${cx-8*s} ${my-1*s}Q${cx} ${my+11*s} ${cx+8*s} ${my-1*s}Z" fill="${P}" ${sw(2.5*s)}/><path d="M${cx-4*s} ${my+5*s}Q${cx} ${my+2*s} ${cx+4*s} ${my+5*s}Z" fill="#ff7fb3"/>`;
    break;
  case 'sleepy':
    g+=eye(cx-e)+eye(cx+e);
    // Paupières lourdes, à plat
    for(const x of [cx-e,cx+e]) g+=`<path d="M${x-r-1*s} ${cy+1*s}H${x+r+1*s}V${cy-r-2*s}H${x-r-1*s}Z" fill="${P}"/>`;
    g+=`<path d="M${cx-6*s} ${my+1*s}H${cx+6*s}" ${sw(3.5*s)}/>`;
    break;
  case 'angry':
    g+=eye(cx-e)+eye(cx+e);
    g+=`<path d="M${cx-e-r} ${cy-6*s}L${cx-e+r} ${cy-1*s}L${cx-e+r} ${cy-r-3*s}L${cx-e-r} ${cy-r-3*s}ZM${cx+e+r} ${cy-6*s}L${cx+e-r} ${cy-1*s}L${cx+e-r} ${cy-r-3*s}L${cx+e+r} ${cy-r-3*s}Z" fill="${P}"/>`;
    g+=`<path d="M${cx-e-8*s} ${cy-17*s}L${cx-e+7*s} ${cy-11*s}M${cx+e+8*s} ${cy-17*s}L${cx+e-7*s} ${cy-11*s}" fill="none" ${sw(4*s)}/>`;
    g+=`<rect x="${cx-9*s}" y="${my-3*s}" width="${18*s}" height="${8*s}" rx="${3*s}" fill="#fff" ${sw(2.8*s)}/><path d="M${cx-3*s} ${my-3*s}V${my+5*s}M${cx+3*s} ${my-3*s}V${my+5*s}" ${sw(2*s)}/>`;
    break;
  case 'wink':
    g+=`<path d="M${cx-e-6.5*s} ${cy+1*s}Q${cx-e} ${cy-6*s} ${cx-e+6.5*s} ${cy+1*s}" fill="none" ${sw(3.8*s)}/>`+eye(cx+e)+lid(cx+e,0);
    g+=`<path d="M${cx+e-6*s} ${cy-16*s}Q${cx+e+2*s} ${cy-20*s} ${cx+e+9*s} ${cy-15*s}" fill="none" ${sw(3.6*s)}/>`;
    g+=`<path d="M${cx-8*s} ${my+1*s}Q${cx+1*s} ${my+7*s} ${cx+9*s} ${my-3*s}" fill="none" ${sw(3.6*s)}/><path d="M${cx+2*s} ${my+4*s}Q${cx+6*s} ${my+11*s} ${cx+8*s} ${my+2*s}Z" fill="#ff5a7a" ${sw(2.2*s)}/>`;
    break;
  case 'star':
    g+=eye(cx-e,1.1,'star')+eye(cx+e,1.1,'star');
    g+=`<path d="M${cx-10*s} ${my-2*s}Q${cx} ${my+14*s} ${cx+10*s} ${my-2*s}Z" fill="${P}" ${sw(2.5*s)}/><path d="M${cx-7*s} ${my-1*s}H${cx+7*s}" stroke="#fff" stroke-width="${2.6*s}" stroke-linecap="round"/>`;
    break;
  default: // cool
    g+=eye(cx-e)+eye(cx+e)+lid(cx-e,0)+lid(cx+e,0);
    g+=`<path d="M${cx-e-8*s} ${cy-14*s}L${cx-e+6*s} ${cy-12*s}M${cx+e-6*s} ${cy-15*s}Q${cx+e+2*s} ${cy-19*s} ${cx+e+9*s} ${cy-15*s}" fill="none" ${sw(3.6*s)}/>`;
    g+=`<path d="M${cx-8*s} ${my+1*s}Q${cx+1*s} ${my+6*s} ${cx+9*s} ${my-3*s}" fill="none" ${sw(3.6*s)}/>`;
  }
  return g;
}

/* ===== Visage ===== */
function face(cx,cy,m='happy',s=1){
  const e=12.5*s,r=10*s,p=4.8*s;let g='';
  const ch=m==='toot'?.5:.28;
  g+=`<ellipse cx="${cx-20*s}" cy="${cy+11*s}" rx="${5.5*s}" ry="${3*s}" fill="#ff7fb3" opacity="${ch}"/><ellipse cx="${cx+20*s}" cy="${cy+11*s}" rx="${5.5*s}" ry="${3*s}" fill="#ff7fb3" opacity="${ch}"/>`;
  for(const [k,x] of [[-1,cx-e],[1,cx+e]]){
    if(m==='win'||m==='toot'){
      g+=`<path d="M${x-6.5*s} ${cy+2*s}Q${x} ${cy-7*s} ${x+6.5*s} ${cy+2*s}" fill="none" ${sw(3.8*s)}/>`;
    }else{
      const py=m==='sad'?cy+2.5*s:cy+1*s,ry=m==='wow'?r*1.25:r;
      g+=`<ellipse cx="${x}" cy="${cy}" rx="${r}" ry="${ry}" fill="#fff" ${sw(3*s)}/><circle cx="${x+1.5*s*k*-1+1.5*s}" cy="${py+1.5*s}" r="${p}" fill="${P}"/><circle cx="${x+3.2*s}" cy="${py-0.8*s}" r="${1.8*s}" fill="#fff"/>`;
      // Paupière mi-close (regard assuré) sauf quand on est surpris
      if(m==='happy') g+=`<path d="M${x-r-1*s} ${cy-1*s}Q${x} ${cy-ry-6*s} ${x+r+1*s} ${cy-1*s}Q${x} ${cy-5*s} ${x-r-1*s} ${cy-1*s}Z" fill="${P}"/>`;
    }
  }
  // Sourcils
  if(m==='happy') g+=`<path d="M${cx-e-8*s} ${cy-14*s}L${cx-e+6*s} ${cy-12*s}M${cx+e-6*s} ${cy-15*s}Q${cx+e+2*s} ${cy-19*s} ${cx+e+9*s} ${cy-15*s}" fill="none" ${sw(3.6*s)}/>`;
  if(m==='wow') g+=`<path d="M${cx-e-7*s} ${cy-17*s}Q${cx-e} ${cy-22*s} ${cx-e+7*s} ${cy-17*s}M${cx+e-7*s} ${cy-17*s}Q${cx+e} ${cy-22*s} ${cx+e+7*s} ${cy-17*s}" fill="none" ${sw(3.4*s)}/>`;
  if(m==='win') g+=`<path d="M${cx-e-7*s} ${cy-12*s}L${cx-e+6*s} ${cy-15*s}M${cx+e-6*s} ${cy-15*s}L${cx+e+7*s} ${cy-12*s}" fill="none" ${sw(3.4*s)}/>`;
  const my=cy+14*s;
  if(m==='sad') g+=`<path d="M${cx-e-7*s} ${cy-11*s}L${cx-e+5*s} ${cy-15*s}M${cx+e+7*s} ${cy-11*s}L${cx+e-5*s} ${cy-15*s}" fill="none" ${sw(3*s)}/>`;
  // Sourire en coin
  if(m==='happy') g+=`<path d="M${cx-8*s} ${my+1*s}Q${cx+1*s} ${my+6*s} ${cx+9*s} ${my-3*s}" fill="none" ${sw(3.6*s)}/>`;
  if(m==='wow') g+=`<ellipse cx="${cx}" cy="${my+3*s}" rx="${4.5*s}" ry="${5.5*s}" fill="${P}"/>`;
  if(m==='sad') g+=`<path d="M${cx-6*s} ${my+6*s}Q${cx} ${my} ${cx+6*s} ${my+6*s}" fill="none" ${sw(3.5*s)}/><path d="M${cx+e+2*s} ${cy+8*s}Q${cx+e+7*s} ${cy+15*s} ${cx+e+2*s} ${cy+17*s}Q${cx+e-3*s} ${cy+15*s} ${cx+e+2*s} ${cy+8*s}Z" fill="${CIEL}" ${sw(2*s)}/>`;
  if(m==='win') g+=`<path d="M${cx-11*s} ${my-2*s}Q${cx} ${my+15*s} ${cx+11*s} ${my-2*s}Z" fill="${P}" ${sw(3*s)}/><path d="M${cx-7*s} ${my-1*s}H${cx+7*s}" stroke="#fff" stroke-width="${3*s}" stroke-linecap="round"/>`;
  if(m==='toot') g+=`<path d="M${cx-6*s} ${my+1*s}Q${cx+1*s} ${my+5*s} ${cx+7*s} ${my-1*s}" fill="none" ${sw(3.4*s)}/>`;
  return g;
}
function selfie(cx,cy,s){
  return `<circle cx="${cx}" cy="${cy+2*s}" r="${25*s}" fill="#fff" ${sw(3.5*s)}/><circle cx="${cx}" cy="${cy+2*s}" r="${20*s}" fill="#bfe6ff"/><circle cx="${cx}" cy="${cy-3*s}" r="${7.5*s}" fill="#7da6d4"/><path d="M${cx-13*s} ${cy+17*s}Q${cx} ${cy-1*s} ${cx+13*s} ${cy+17*s}Z" fill="#7da6d4"/><circle cx="${cx}" cy="${cy+2*s}" r="${20*s}" fill="none" ${sw(3*s)}/>`;
}
function feet(c){
  const shoe=(x,dir)=>{
    const t=dir<0?`M${x+13} 139H${x-17}C${x-19} 129 ${x-12} 123 ${x-2} 123C${x+8} 123 ${x+13} 128 ${x+13} 134Z`:`M${x-13} 139H${x+17}C${x+19} 129 ${x+12} 123 ${x+2} 123C${x-8} 123 ${x-13} 128 ${x-13} 134Z`;
    return `<path d="${t}" fill="${c}" ${sw(3.5)}/><path d="M${x-16} 135.5H${x+16}" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/><path d="M${x-4} 127L${x+3} 125M${x-3} 131L${x+4} 129" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`;
  };
  return shoe(46,-1)+shoe(74,1);
}
/** Jambes « tuyau » : de la hanche (cachée sous le corps) jusqu'aux baskets. */
function legs(){
  return `<path d="M54 86Q50 106 46 125M66 86Q70 106 74 125" fill="none" ${sw(5)}/>`;
}
/** Bras « tuyau » avec gants blancs, posés selon l'humeur. sx = demi-largeur aux épaules, sy = hauteur des épaules. */
function arms(m,sx,sy,pose='hip'){
  const L=60-sx,R=60+sx;let d='',hands=[];
  const glove=(x,y)=>`<circle cx="${x}" cy="${y}" r="6.5" fill="#fff" ${sw(3.5)}/><path d="M${x-5} ${y-3}Q${x-9} ${y-6} ${x-7} ${y-9}" fill="#fff" ${sw(3)}/>`;
  if(m==='win'){d=`M${L} ${sy}Q${L-14} ${sy-12} ${L-12} ${sy-32}M${R} ${sy}Q${R+14} ${sy-12} ${R+12} ${sy-32}`;hands=[[L-12,sy-35],[R+12,sy-35]];}
  else if(m==='wow'){d=`M${L} ${sy}Q${L-16} ${sy-4} ${L-14} ${sy-20}M${R} ${sy}Q${R+16} ${sy-4} ${R+14} ${sy-20}`;hands=[[L-14,sy-23],[R+14,sy-23]];}
  else if(m==='sad'){d=`M${L} ${sy}Q${L-6} ${sy+14} ${L-4} ${sy+26}M${R} ${sy}Q${R+6} ${sy+14} ${R+4} ${sy+26}`;hands=[[L-4,sy+29],[R+4,sy+29]];}
  else if(pose==='cross'){
    // Bras croisés devant soi
    d=`M${L} ${sy}Q${L-6} ${sy+18} ${66} ${sy+14}M${R} ${sy}Q${R+6} ${sy+20} ${54} ${sy+18}`;
    hands=[[68,sy+13],[52,sy+18]];
  }else if(pose==='flex'){
    // Biceps !
    d=`M${L} ${sy}Q${L-20} ${sy+2} ${L-16} ${sy-20}M${R} ${sy}Q${R+20} ${sy+2} ${R+16} ${sy-20}`;
    hands=[[L-16,sy-23],[R+16,sy-23]];
  }else if(pose==='wave'){
    // Un petit coucou
    d=`M${L} ${sy}Q${L-8} ${sy+14} ${L-8} ${sy+26}M${R} ${sy}Q${R+20} ${sy-6} ${R+16} ${sy-30}`;
    hands=[[L-8,sy+29],[R+16,sy-33]];
  }else if(pose==='thumbs'){
    // Pouce levé
    d=`M${L} ${sy}Q${L-8} ${sy+14} ${L-8} ${sy+26}M${R} ${sy}Q${R+18} ${sy+8} ${R+20} ${sy-6}`;
    hands=[[L-8,sy+29]];
    return `<path d="${d}" fill="none" ${sw(5)}/>`+glove(L-8,sy+29)+`<ellipse cx="${R+20}" cy="${sy-8}" rx="9" ry="7" fill="#fff" ${sw(3.5)}/><path d="M${R+14} ${sy-12}Q${R+8} ${sy-19} ${R+11} ${sy-23}Q${R+15} ${sy-25} ${R+19} ${sy-14}" fill="#fff" ${sw(3)}/>`;
  }else if(pose==='shy'){
    // Mains jointes devant, timide
    d=`M${L} ${sy}Q${L-4} ${sy+20} ${56} ${sy+26}M${R} ${sy}Q${R+4} ${sy+20} ${64} ${sy+26}`;
    hands=[[55,sy+27],[65,sy+27]];
  }else{
    // Main sur la hanche à gauche, l'autre bras décontracté
    d=`M${L} ${sy}Q${L-18} ${sy+6} ${L-2} ${sy+20}M${R} ${sy}Q${R+12} ${sy+12} ${R+10} ${sy+26}`;
    hands=[[L+1,sy+21],[R+10,sy+29]];
  }
  return `<path d="${d}" fill="none" ${sw(5)}/>`+hands.map(([x,y])=>glove(x,y)).join('');
}

/* ===== Les 13 corps (repère 120 × 150, sol à y = 138) ===== */
const K={
 coussin:{n:'Coussin péteur',fy:90,top:56,hx:78,b:()=>`<path d="M50 60L40 30Q39 25 44 25H55Q60 25 58 30L63 60Z" fill="#ff86bd" ${sw()}/><ellipse cx="49.5" cy="26" rx="10.5" ry="4.5" fill="#ff86bd" ${sw(3.5)}/><ellipse cx="60" cy="88" rx="48" ry="33" fill="${ROSE}" ${sw()}/><ellipse cx="36" cy="72" rx="12" ry="4.5" fill="#ffa2cf" transform="rotate(-18 36 72)"/>`},
 tartine:{n:'Tartine',fy:84,top:24,b:()=>`<path d="M24 122V62C10 56 12 26 38 28C46 16 74 16 82 28C108 26 110 56 96 62V122Z" fill="#d9883e" ${sw()}/><path d="M32 115V59C23 53 25 36 40 36C48 27 72 27 80 36C95 36 97 53 88 59V115Z" fill="#ffd590"/><path d="M38 42C50 34 70 34 82 42C84 50 77 49 75 55C73 61 66 56 62 50C56 48 50 56 46 52C40 48 34 48 38 42Z" fill="#ff3b6b" ${sw(3)}/>`},
 cornichon:{n:'Cornichon',fy:72,top:26,aw:27,b:()=>`<ellipse cx="60" cy="74" rx="30" ry="50" fill="#7bb33b" ${sw()}/>`+[[44,42],[77,54],[42,102],[79,96],[60,32],[64,112]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="3.2" fill="#5a9228"/>`).join('')},
 beignet:{n:'Beignet',fy:98,fs:.9,top:30,b:()=>`<path d="M12 76a48 48 0 1 0 96 0a48 48 0 1 0 -96 0ZM51 64a9 9 0 1 0 18 0a9 9 0 1 0 -18 0Z" fill="#e8a35a" fill-rule="evenodd" ${sw()}/><path d="M22 72C20 44 40 34 60 34C82 34 100 46 98 72C98 82 92 80 90 86C86 92 80 84 74 86C66 90 58 84 50 88C42 92 36 84 30 86C24 88 22 80 22 72ZM50 64a10 10 0 1 0 20 0a10 10 0 1 0 -20 0Z" fill="#ff9ccf" fill-rule="evenodd" ${sw(3)}/>`+[[34,56,ROSE,30],[44,44,SOL,-20],[76,44,CIEL,40],[86,60,MEN,-30],[62,44,VIO,10],[38,70,SOL,60],[82,74,ROSE,-50]].map(([x,y,c,a])=>`<rect x="${x-4}" y="${y-1.6}" width="8" height="3.2" rx="1.6" fill="${c}" transform="rotate(${a} ${x} ${y})"/>`).join('')},
 oeuf:{n:'Œuf',fy:82,top:22,aw:38,b:()=>`<path d="M60 20C88 20 100 70 100 90C100 112 82 122 60 122C38 122 20 112 20 90C20 70 32 20 60 20Z" fill="#fffaf0" ${sw()}/><ellipse cx="44" cy="46" rx="6" ry="11" fill="#fff" transform="rotate(20 44 46)"/>`},
 fromage:{n:'Fromage',fy:92,top:40,hx:72,b:()=>`<path d="M14 66L106 50V120H14Z" fill="#ffd23a" ${sw()}/><path d="M14 66L80 30L106 50Z" fill="#ffe680" ${sw()}/><circle cx="28" cy="108" r="6" fill="#efb515"/><circle cx="94" cy="66" r="5" fill="#efb515"/><circle cx="96" cy="106" r="7" fill="#efb515"/><circle cx="80" cy="44" r="3.5" fill="#f3c93a"/>`},
 tomate:{n:'Tomate',fy:82,top:40,b:()=>`<circle cx="60" cy="80" r="44" fill="#ff4a3a" ${sw()}/><ellipse cx="40" cy="58" rx="9" ry="5" fill="#ff8a7a" transform="rotate(-30 40 58)"/><path d="M60 44L46 34L57 37L60 24L64 37L76 33Z" fill="#4fae3e" ${sw(3.5)}/>`},
 brocoli:{n:'Brocoli',fy:96,fs:.8,top:16,b:()=>`<rect x="36" y="66" width="48" height="58" rx="16" fill="#c4ea86" ${sw()}/><circle cx="34" cy="58" r="22" fill="#3fa34a" ${sw()}/><circle cx="86" cy="58" r="22" fill="#3fa34a" ${sw()}/><circle cx="60" cy="40" r="26" fill="#3fa34a" ${sw()}/><circle cx="60" cy="64" r="16" fill="#3fa34a"/><circle cx="48" cy="32" r="5" fill="#5fc066"/><circle cx="26" cy="52" r="4" fill="#5fc066"/>`},
 cupcake:{n:'Cupcake',fy:98,fs:.78,top:32,b:()=>`<path d="M26 80H94L84 122H36Z" fill="${CIEL}" ${sw()}/><path d="M42 82L46 120M60 82V120M78 82L74 120" fill="none" stroke="#fff" stroke-width="3" opacity=".6"/><path d="M22 82C10 74 18 56 32 58C30 40 50 36 56 44C62 30 84 34 84 50C100 48 106 72 96 82Z" fill="#fff0f7" ${sw()}/><path d="M62 28Q66 18 74 16" fill="none" ${sw(3)}/><circle cx="62" cy="34" r="8" fill="#ff3b3b" ${sw(3.5)}/>`},
 sushi:{n:'Sushi',fy:98,fs:.8,top:44,b:()=>`<rect x="20" y="66" width="80" height="56" rx="24" fill="#fffaf2" ${sw()}/><path d="M14 74C14 50 40 42 60 44C84 42 108 50 106 74C90 82 30 82 14 74Z" fill="#ff8a5a" ${sw()}/><path d="M30 56Q36 66 32 76M52 50Q58 62 54 78M76 50Q82 62 78 78" fill="none" stroke="#ffd2bd" stroke-width="3.5" stroke-linecap="round"/><rect x="88" y="62" width="11" height="58" rx="3" fill="#2b4a3e" ${sw(3)}/>`},
 frites:{n:'Frites',fy:94,fs:.82,top:26,b:()=>[[30,32],[42,22],[54,28],[66,18],[77,28],[86,36],[37,40],[72,38]].map(([x,y])=>`<rect x="${x}" y="${y}" width="11" height="50" rx="3" fill="#ffd23a" ${sw(3)}/>`).join('')+`<path d="M22 66H98L87 122H33Z" fill="#ff3b3b" ${sw()}/><path d="M30 76H90" stroke="#fff" stroke-width="3" opacity=".45" stroke-linecap="round"/>`},
 bonbon:{n:'Bonbon',fy:80,fs:.8,top:46,b:()=>`<path d="M32 78L6 58L10 98Z" fill="${SOL}" ${sw()}/><path d="M88 78L114 58L110 98Z" fill="${SOL}" ${sw()}/><circle cx="60" cy="78" r="33" fill="#9b5cff" ${sw()}/><path d="M38 56Q60 70 52 110M66 46Q84 70 88 92" fill="none" stroke="#c9a8ff" stroke-width="6" stroke-linecap="round"/>`},
 chaussette:{n:'Chaussette',fy:68,fs:.9,top:22,aw:24,b:()=>`<path d="M36 22H84V86C84 92 88 96 96 98C110 102 110 122 94 122H48C32 122 34 106 36 96Z" fill="#fff" ${sw()}/><path d="M36 22H84V42H36Z" fill="${CIEL}" ${sw()}/><path d="M38 32H82" stroke="#fff" stroke-width="4"/><path d="M86 104C92 104 100 106 102 114" fill="none" stroke="${ROSE}" stroke-width="6" stroke-linecap="round"/>`},
 // —— Nouveaux personnages (ajoutés au catalogue d'origine, même style) ——
 pizza:{n:'Pizza',fy:74,fs:.8,top:26,aw:24,b:()=>`<path d="M18 42Q60 18 102 42L64 124Q60 130 56 124Z" fill="#ffcf6b" ${sw()}/><path d="M18 42Q60 18 102 42L98 52Q60 30 22 52Z" fill="#d9883e" ${sw()}/><circle cx="44" cy="62" r="7" fill="#e8453c" ${sw(2.5)}/><circle cx="80" cy="68" r="6" fill="#e8453c" ${sw(2.5)}/><circle cx="60" cy="100" r="6" fill="#e8453c" ${sw(2.5)}/><path d="M86 56Q90 70 86 78" fill="none" stroke="#ffe7a8" stroke-width="4" stroke-linecap="round"/>`},
 glace:{n:'Glace',fy:64,fs:.85,top:22,aw:34,b:()=>`<path d="M34 84H86L62 128Q60 132 58 128Z" fill="#e8a35a" ${sw()}/><path d="M42 92L70 120M56 88L78 104M50 104L66 90" stroke="#c97a35" stroke-width="3" stroke-linecap="round"/><path d="M24 80C14 74 18 56 30 56C26 34 46 24 60 28C76 22 96 34 92 54C104 56 106 76 96 82C90 92 84 82 80 90C74 96 70 86 64 92C56 98 52 86 46 92C38 96 34 84 24 80Z" fill="#ff9ccf" ${sw()}/><ellipse cx="44" cy="44" rx="8" ry="4" fill="#ffc6e3" transform="rotate(-25 44 44)"/><circle cx="62" cy="22" r="8" fill="#ff3b3b" ${sw(3.5)}/>`},
 avocat:{n:'Avocat',fy:62,fs:.82,top:20,aw:34,b:()=>`<path d="M60 20C90 20 102 70 102 92C102 120 82 128 60 128C38 128 18 120 18 92C18 70 30 20 60 20Z" fill="#4f8f34" ${sw()}/><path d="M60 30C84 30 92 72 92 92C92 112 78 118 60 118C42 118 28 112 28 92C28 72 36 30 60 30Z" fill="#d8f0a0"/><circle cx="60" cy="98" r="15" fill="#a0643a" ${sw(3.5)}/><ellipse cx="55" cy="93" rx="5" ry="3" fill="#c98a5a"/>`},
 macaron:{n:'Macaron',fy:64,fs:.82,top:38,b:()=>`<ellipse cx="60" cy="108" rx="48" ry="20" fill="#ff9ccf" ${sw()}/><rect x="16" y="84" width="88" height="18" rx="9" fill="#fff3d6" ${sw()}/><path d="M14 88C14 56 34 42 60 42C86 42 106 56 106 88Z" fill="#ff9ccf" ${sw()}/><path d="M20 88Q30 82 40 88Q50 82 60 88Q70 82 80 88Q90 82 100 88" fill="none" stroke="#e86fae" stroke-width="3"/><ellipse cx="38" cy="56" rx="9" ry="4" fill="#ffc6e3" transform="rotate(-20 38 56)"/>`},
 banane:{n:'Banane',fy:66,fs:.82,top:18,aw:26,b:()=>`<path d="M50 22L56 12H66L70 22Z" fill="#7a5a2a" ${sw(3.5)}/><path d="M48 22H72C92 44 96 92 76 124C70 130 50 130 44 124C24 92 28 44 48 22Z" fill="#ffe066" ${sw()}/><path d="M56 30C48 60 48 96 56 120" fill="none" stroke="#f2c230" stroke-width="4" stroke-linecap="round"/><ellipse cx="78" cy="58" rx="4" ry="10" fill="#fff3a8"/>`},
 saucisse:{n:'Saucisse',fy:62,fs:.82,top:20,aw:26,b:()=>`<rect x="34" y="18" width="52" height="110" rx="26" fill="#d9654a" ${sw()}/><path d="M46 34Q42 70 46 108" fill="none" stroke="#f08a6a" stroke-width="5" stroke-linecap="round"/><path d="M38 96Q60 104 82 96M38 82Q60 90 82 82" fill="none" stroke="#ffd23a" stroke-width="5" stroke-linecap="round"/>`},
 champi:{n:'Champignon',fy:92,fs:.8,top:16,aw:30,b:()=>`<rect x="38" y="68" width="44" height="58" rx="18" fill="#fff6e0" ${sw()}/><path d="M10 72C10 30 34 18 60 18C86 18 110 30 110 72Z" fill="#ff3b3b" ${sw()}/><circle cx="36" cy="44" r="8" fill="#fff"/><circle cx="66" cy="32" r="7" fill="#fff"/><circle cx="88" cy="54" r="6" fill="#fff"/><circle cx="56" cy="58" r="5" fill="#fff"/>`},
 tasse:{n:'Tasse',fy:84,fs:.84,top:44,aw:34,b:()=>`<path d="M24 54H96V108Q96 126 76 126H44Q24 126 24 108Z" fill="#2ec5ff" ${sw()}/><path d="M96 66Q116 66 116 84Q116 102 96 100" fill="none" ${sw(6)}/><ellipse cx="60" cy="54" rx="36" ry="9" fill="#a0643a" ${sw()}/><path d="M44 40Q38 30 46 22M62 38Q56 26 64 16M80 40Q74 30 82 22" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".8"/>`},
 oignon:{n:'Oignon',fy:84,fs:.84,top:18,aw:36,b:()=>`<path d="M60 22C66 34 104 52 104 88C104 116 84 128 60 128C36 128 16 116 16 88C16 52 54 34 60 22Z" fill="#e8b4ff" ${sw()}/><path d="M60 30Q44 70 50 126M60 30Q76 70 70 126" fill="none" stroke="#c98ae8" stroke-width="4"/><path d="M60 22V8M56 10L60 4L64 10" fill="none" stroke="#7bd13b" stroke-width="5" stroke-linecap="round"/>`},
 patate:{n:'Patate',fy:78,fs:.86,top:30,aw:38,b:()=>`<path d="M22 70C18 42 40 30 62 32C90 30 106 50 102 80C100 112 82 126 58 126C32 126 24 102 22 70Z" fill="#d9a066" ${sw()}/><circle cx="40" cy="58" r="3.5" fill="#a0643a"/><circle cx="86" cy="96" r="4" fill="#a0643a"/><circle cx="74" cy="48" r="3" fill="#a0643a"/><circle cx="34" cy="100" r="3" fill="#a0643a"/>`},
 popcorn:{n:'Pop-corn',fy:96,fs:.78,top:20,aw:34,b:()=>`<path d="M26 70H94L84 126H36Z" fill="#fff" ${sw()}/><path d="M40 70L44 126M60 70V126M80 70L76 126" stroke="#ff3b3b" stroke-width="8"/><path d="M26 70H94L84 126H36Z" fill="none" ${sw()}/>`+[[32,62],[48,50],[64,44],[80,52],[92,64],[56,62],[40,40],[72,32],[88,42]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="12" fill="#fff3b0" ${sw(3)}/>`).join('')},
 nuage:{n:'Nuage',fy:84,fs:.85,top:44,b:()=>`<path d="${cloudD(60,92,54)}" fill="#ffffff" ${sw()}/><ellipse cx="38" cy="72" rx="10" ry="5" fill="#e3f2ff" transform="rotate(-20 38 72)"/><path d="M20 112Q60 124 100 112" fill="none" stroke="#cfe7ff" stroke-width="5" stroke-linecap="round"/>`},
};
const KEYS=Object.keys(K);

function hat(t,x,y,c){
  switch(t){
  case 'couronne':return `<path d="M${x-18} ${y+2}L${x-21} ${y-20}L${x-9} ${y-10}L${x} ${y-24}L${x+9} ${y-10}L${x+21} ${y-20}L${x+18} ${y+2}Z" fill="${SOL}" ${sw(3.5)}/><circle cx="${x}" cy="${y-6}" r="3.5" fill="${ROSE}"/>`;
  case 'casquette':return `<path d="M${x-4} ${y}H${x+34}Q${x+30} ${y+8} ${x+8} ${y+6}Z" fill="${c}" ${sw(3.5)}/><path d="M${x-22} ${y+2}C${x-22} ${y-26} ${x+22} ${y-26} ${x+22} ${y+2}Z" fill="${c}" ${sw(3.5)}/><circle cx="${x}" cy="${y-19}" r="3" fill="${P}"/>`;
  case 'haut':return `<rect x="${x-15}" y="${y-36}" width="30" height="36" rx="4" fill="${P}"/><rect x="${x-15}" y="${y-13}" width="30" height="7" fill="${ROSE}"/><ellipse cx="${x}" cy="${y}" rx="26" ry="6" fill="${P}"/>`;
  case 'bob':return `<path d="M${x-30} ${y+4}Q${x} ${y+12} ${x+30} ${y+4}L${x+19} ${y-6}C${x+17} ${y-26} ${x-17} ${y-26} ${x-19} ${y-6}Z" fill="${SOL}" ${sw(3.5)}/><path d="M${x-19} ${y-6}Q${x} ${y} ${x+19} ${y-6}" fill="none" ${sw(3)}/><circle cx="${x-7}" cy="${y-14}" r="2.5" fill="${ROSE}"/><circle cx="${x+8}" cy="${y-16}" r="2.5" fill="${ROSE}"/>`;
  case 'cornes':return [-1,1].map(k=>`<path d="M${x+k*8} ${y+4}C${x+k*12} ${y-8} ${x+k*22} ${y-14} ${x+k*24} ${y-26}C${x+k*30} ${y-14} ${x+k*26} ${y} ${x+k*20} ${y+6}Z" fill="#fff3d6" ${sw(3.5)}/>`).join('');
  case 'antenne':return `<path d="M${x} ${y+4}V${y-22}" fill="none" ${sw(3.5)}/><circle cx="${x}" cy="${y-27}" r="7" fill="${SOL}" ${sw(3.5)}/>`;
  case 'toque':return `<path d="M${x-14} ${y+2}V${y-12}C${x-28} ${y-14} ${x-26} ${y-36} ${x-12} ${y-32}C${x-10} ${y-46} ${x+10} ${y-46} ${x+12} ${y-32}C${x+26} ${y-36} ${x+28} ${y-14} ${x+14} ${y-12}V${y+2}Z" fill="#fff" ${sw(3.5)}/><path d="M${x-14} ${y-6}H${x+14}" ${sw(3)}/>`;
  case 'fete':return `<path d="M${x-15} ${y+2}L${x} ${y-34}L${x+15} ${y+2}Z" fill="${c}" ${sw(3.5)}/><path d="M${x-8} ${y-12}L${x+5} ${y-19}M${x-11} ${y-2}L${x+10} ${y-11}" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="${x}" cy="${y-37}" r="5.5" fill="${SOL}" ${sw(3)}/>`;
  case 'pirate':return `<path d="M${x-30} ${y+2}Q${x} ${y-8} ${x+30} ${y+2}C${x+24} ${y-14} ${x+14} ${y-30} ${x} ${y-30}C${x-14} ${y-30} ${x-24} ${y-14} ${x-30} ${y+2}Z" fill="${P}"/><circle cx="${x}" cy="${y-16}" r="5.5" fill="#fff"/><path d="M${x-7} ${y-7}L${x+7} ${y-3}M${x-7} ${y-3}L${x+7} ${y-7}" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>`;
  case 'aureole':return `<ellipse cx="${x}" cy="${y-18}" rx="21" ry="6.5" fill="none" stroke="${P}" stroke-width="10"/><ellipse cx="${x}" cy="${y-18}" rx="21" ry="6.5" fill="none" stroke="${SOL}" stroke-width="5"/>`;
  case 'fleur':return [0,1,2,3,4].map(k=>{const a=k*1.2566;return `<circle cx="${x+14+Math.cos(a)*8}" cy="${y-8+Math.sin(a)*8}" r="6.5" fill="${ROSE}" ${sw(3)}/>`;}).join('')+`<circle cx="${x+14}" cy="${y-8}" r="5" fill="${SOL}" ${sw(3)}/>`;
  case 'bonnet':return `<path d="M${x-20} ${y+2}C${x-20} ${y-28} ${x+20} ${y-28} ${x+20} ${y+2}Z" fill="${c}" ${sw(3.5)}/><rect x="${x-23}" y="${y-7}" width="46" height="11" rx="5.5" fill="#fff" ${sw(3)}/><circle cx="${x}" cy="${y-27}" r="7" fill="#fff" ${sw(3)}/>`;
  case 'sorciere':return `<path d="M${x-15} ${y}L${x+4} ${y-42}L${x+14} ${y-32}L${x+15} ${y}Z" fill="${VIO}" ${sw(3.5)}/><rect x="${x-15}" y="${y-10}" width="30" height="6" fill="${SOL}"/><ellipse cx="${x}" cy="${y+1}" rx="31" ry="6" fill="${VIO}" ${sw(3.5)}/>`;
  case 'noeud':return `<path d="M${x+2} ${y-2}L${x-18} ${y-14}V${y+10}ZM${x+2} ${y-2}L${x+22} ${y-14}V${y+10}Z" fill="${ROSE}" ${sw(3.5)}/><circle cx="${x+2}" cy="${y-2}" r="5" fill="${ROSE}" ${sw(3.5)}/>`;
  }
  return '';
}
function acc(t,cx,cy,s){
  const e=12*s;
  switch(t){
  case 'lunettes':return [cx-e,cx+e].map(x=>`<circle cx="${x}" cy="${cy}" r="${10.5*s}" fill="#fff" fill-opacity=".25" ${sw(3*s)}/>`).join('')+`<path d="M${cx-e+10.5*s} ${cy-1*s}Q${cx} ${cy-4*s} ${cx+e-10.5*s} ${cy-1*s}" fill="none" ${sw(3*s)}/>`;
  case 'soleil':return [cx-e,cx+e].map(x=>`<rect x="${x-10*s}" y="${cy-7*s}" width="${20*s}" height="${14*s}" rx="${6*s}" fill="${P}"/><path d="M${x-5*s} ${cy-3*s}L${x-1*s} ${cy-3*s}" stroke="#fff" stroke-width="${2.5*s}" stroke-linecap="round"/>`).join('')+`<path d="M${cx-3*s} ${cy-3*s}H${cx+3*s}" ${sw(3*s)}/>`;
  case 'moustache':{const y=cy+12*s;return `<path d="M${cx} ${y}C${cx-6*s} ${y-5*s} ${cx-18*s} ${y-4*s} ${cx-20*s} ${y+5*s}C${cx-12*s} ${y+2*s} ${cx-6*s} ${y+3*s} ${cx} ${y+1*s}C${cx+6*s} ${y+3*s} ${cx+12*s} ${y+2*s} ${cx+20*s} ${y+5*s}C${cx+18*s} ${y-4*s} ${cx+6*s} ${y-5*s} ${cx} ${y}Z" fill="${P}" ${sw(2*s)}/>`;}
  case 'monocle':return `<circle cx="${cx+e}" cy="${cy}" r="${11*s}" fill="#fff" fill-opacity=".25" ${sw(3*s)}/><path d="M${cx+e+8*s} ${cy+8*s}Q${cx+e+18*s} ${cy+20*s} ${cx+e+10*s} ${cy+32*s}" fill="none" stroke="${SOL}" stroke-width="${2.5*s}" stroke-linecap="round"/>`;
  case 'coeurs':return heart(cx-e,cy+1*s,11*s,ROSE)+heart(cx+e,cy+1*s,11*s,ROSE)+`<path d="M${cx-3*s} ${cy-3*s}H${cx+3*s}" ${sw(3*s)}/>`;
  case 'masque':return `<path d="M${cx-26*s} ${cy-6*s}Q${cx} ${cy-13*s} ${cx+26*s} ${cy-6*s}Q${cx+27*s} ${cy+9*s} ${cx+12*s} ${cy+9*s}Q${cx} ${cy+2*s} ${cx-12*s} ${cy+9*s}Q${cx-27*s} ${cy+9*s} ${cx-26*s} ${cy-6*s}Z" fill="${P}"/>`+[cx-e,cx+e].map(x=>`<ellipse cx="${x}" cy="${cy}" rx="${5*s}" ry="${4*s}" fill="#fff"/>`).join('');
  case 'barbe':return `<path d="M${cx-20*s} ${cy+12*s}Q${cx} ${cy+48*s} ${cx+20*s} ${cy+12*s}Q${cx+10*s} ${cy+24*s} ${cx} ${cy+20*s}Q${cx-10*s} ${cy+24*s} ${cx-20*s} ${cy+12*s}Z" fill="#9a6a44" ${sw(2.5*s)}/>`;
  case 'rougir':return [cx-20*s,cx+20*s].map(x=>`<ellipse cx="${x}" cy="${cy+12*s}" rx="${7*s}" ry="${4*s}" fill="${ROSE}" fill-opacity=".55"/>`).join('');
  case 'bisou':return heart(cx+e+18*s,cy-8*s,7*s,ROSE)+heart(cx+e+28*s,cy-20*s,4.5*s,ROSE);
  }
  return '';
}
const SC=.84,DY=10,X0=60*(1-SC);
/** Position d'un point du corps (repère d'origine) dans le dessin final. */
const BY=y=>y*SC-DY;
function perso(kind,c=ROSE,o={}){
  const k=K[kind],s=k.fs||1;let g='';
  if(o.toot) g+=cloud(14,116,20,'#fff',3.5)+cloud(-2,96,11,'#fff',3)+star(30,92,6,SOL,2.5)+star(-2,124,4,SOL,2);
  const mood=o.arms?'win':o.mood||'happy';
  g+=legs()+relief(feet(c));
  const raw=k.b(c);
  // Ombrage façon BD qui épouse la silhouette : ombre en bas à droite, lumière en haut à gauche
  const id='s'+kind;
  const black=raw.replace(/fill="[^"]*"/g,'fill="#000"').replace(/stroke="[^"]*"/g,'stroke="none"');
  const box='x="-60" y="-60" width="260" height="260"';
  const shade=`<defs><clipPath id="c${id}">${black}</clipPath><mask id="m${id}" maskUnits="userSpaceOnUse" ${box}><rect ${box} fill="#fff"/><g transform="translate(-10 -9)">${black}</g></mask><mask id="h${id}" maskUnits="userSpaceOnUse" ${box}><rect ${box} fill="#fff"/><g transform="translate(6 6)">${black}</g></mask></defs><g clip-path="url(#c${id})"><rect ${box} fill="#3a2140" opacity=".2" mask="url(#m${id})"/><rect ${box} fill="#fff" opacity=".38" mask="url(#h${id})"/></g>`;
  let body=relief(raw)+shade;
  const base=LOOK[kind]||['cool','hip'];
  // Le joueur peut choisir son regard et sa pose (sinon ceux du perso)
  const look=[o.eyes||base[0],o.pose||base[1]];
  body+=o.selfie?selfie(60,k.fy,s):(o.mood||'happy')==='happy'?faceLook(60,k.fy,s,look[0]):face(60,k.fy,o.mood,s);
  if(o.acc) body+=acc(o.acc,60,k.fy,s);
  if(o.hat) body+=relief(hat(o.hat,k.hx||60,k.top,c));
  g+=`<g transform="translate(${X0} ${-DY}) scale(${SC})">${body}</g>`;
  g+=arms(mood==='toot'?'happy':mood,(k.aw||36)*SC,BY(k.fy+20),look[1]);
  return g;
}
const VB='-6 -36 132 180';
const persoSvg=(k,c,o={})=>svg(VB,perso(k,c,o),`role="img" aria-label="${K[k].n}"`);
const C=(k,c,o,x,y,s,extra='')=>`<g transform="translate(${x} ${y}) scale(${s})${extra}">${perso(k,c,o)}</g>`;

function coussinTQ(){
  return feet(SOL)+`<path d="M60 58L54 29Q53 24 58 24H68Q73 24 71 29L72 58Z" fill="#ff86bd" ${sw()}/><ellipse cx="63" cy="25" rx="10" ry="4.5" fill="#ff86bd" ${sw(3.5)}/><ellipse cx="54" cy="92" rx="46" ry="31" fill="#e0367f" ${sw()}/><ellipse cx="64" cy="86" rx="42" ry="31" fill="${ROSE}" ${sw()}/><ellipse cx="46" cy="70" rx="10" ry="4" fill="#ffa2cf" transform="rotate(-18 46 70)"/>`+face(74,88,'happy',.95);
}

/* ===== Canapé ===== */
function sofa(){
  return `<rect x="30" y="78" width="140" height="64" rx="24" fill="${VIO}" ${sw(5)}/><path d="M60 92V128M100 92V128M140 92V128" stroke="#9468ff" stroke-width="4" stroke-linecap="round"/><rect x="40" y="128" width="120" height="34" rx="12" fill="${VIO2}" ${sw(5)}/><rect x="14" y="104" width="38" height="60" rx="16" fill="${VIO2}" ${sw(5)}/><rect x="148" y="104" width="38" height="60" rx="16" fill="${VIO2}" ${sw(5)}/><rect x="30" y="162" width="12" height="15" rx="3" fill="${P}"/><rect x="158" y="162" width="12" height="15" rx="3" fill="${P}"/>`;
}

/* ===== Pistes de logo (repère 200 × 200) ===== */
const LOGOS=[
 {n:'Le roi du canapé',d:'La mascotte bien installée sur son canapé, un petit nuage s’échappe de la valve. Le jeu de mots se comprend sans lire.',lock:'cloud',v:['ok','Silhouette nette'],
  mark:()=>sofa()+C('coussin',SOL,{},44,24,.88)+cloud(56,42,14,'#fff',3.5)+star(36,26,6,SOL,2.5)+`<path d="M70 52Q74 48 72 44" fill="none" ${sw(3)}/>`},
 {n:'Les coussins-lettres',d:'Un canapé dont les trois coussins portent le C, le nuage et le p. Chaleureux, très « salon », mais chargé en petit.',lock:'tick',v:['moyen','Lettres justes à 32 px'],
  mark:()=>`<rect x="18" y="50" width="164" height="96" rx="26" fill="${VIO}" ${sw(5)}/>`+[[28,ROSE],[78,SOL],[128,MEN]].map(([x,c])=>`<rect x="${x}" y="62" width="44" height="58" rx="14" fill="${c}" ${sw(4)}/>`).join('')+label(50,106,44,'C')+cloud(100,90,15,'#fff',3.5)+label(150,102,44,'p')+`<rect x="30" y="124" width="140" height="36" rx="12" fill="${VIO2}" ${sw(5)}/><rect x="6" y="100" width="36" height="64" rx="15" fill="${VIO2}" ${sw(5)}/><rect x="158" y="100" width="36" height="64" rx="15" fill="${VIO2}" ${sw(5)}/><rect x="28" y="162" width="12" height="16" rx="3" fill="${P}"/><rect x="160" y="162" width="12" height="16" rx="3" fill="${P}"/>`},
 {n:'La bulle-prout',d:'Le nom écrit dans un nuage-bulle de BD. Très drôle sur un écran de chargement, mais le nom disparaît dès que c’est petit.',lock:null,v:['non','Nom illisible à 32 px'],
  mark:()=>`<path d="M60 136L40 182L94 140Z" fill="#fff" ${sw(5)}/>`+cloud(100,92,96,'#fff',5)+`<path d="M60 145L86 145" stroke="#fff" stroke-width="7"/>`+`<text x="100" y="104" font-size="36" text-anchor="middle" ${F} fill="${ROSE}" ${sw(6)} paint-order="stroke">Cana<tspan fill="${SOL}">’</tspan>pet</text><path d="M22 168q-8 4 -6 12M34 180q-4 6 0 12" fill="none" ${sw(3)}/>`},
 {n:'La manette-copain',d:'Le téléphone devient un petit bonhomme qui salue. Explique le principe (« ton téléphone est la manette ») mieux que les autres.',lock:'tick',v:['ok','Très lisible'],
  mark:()=>`<g transform="rotate(-8 100 100)"><path d="M150 66Q174 58 176 36" fill="none" ${sw(5)}/><circle cx="176" cy="32" r="8" fill="#fff" ${sw(4)}/><path d="M78 160V180M122 160V180" fill="none" ${sw(5)}/><path d="M60 192C59 182 66 177 76 177C85 177 89 182 89 188V192Z" fill="${ROSE}" ${sw(4)}/><path d="M111 192V188C111 182 115 177 124 177C134 177 141 182 140 192Z" fill="${ROSE}" ${sw(4)}/><rect x="48" y="16" width="104" height="150" rx="26" fill="${P}"/><rect x="58" y="28" width="84" height="104" rx="16" fill="${MEN}"/>${face(100,72,'happy',1.5)}<circle cx="80" cy="149" r="8" fill="${ROSE}"/><circle cx="120" cy="149" r="8" fill="${SOL}"/></g>`},
 {n:'Le monogramme C’p',d:'Un C rose, un nuage jaune, un p violet. Compact et costaud pour l’icône, mais sans mascotte il perd de la chaleur.',lock:'cloud',v:['ok','Lisible'],
  mark:()=>wmText(62,150,150,'middle','C',ROSE)+wmText(150,138,118,'middle','p',VIO)+cloudSt(110,52,22,SOL)},
 {n:'Le logotype nuage',d:'Le nom seul, l’apostrophe devient un petit nuage. Parfait en tête d’écran télé, trop long pour une icône.',lock:'only',v:['moyen','Lisible dès 48 px'],
  mark:()=>wmText(100,94,62,'middle','Cana',ROSE)+cloudSt(52,122,14,SOL)+wmText(76,164,62,'start','pet',ROSE)},
];
const markSvg=(i,cls='m')=>svg('0 0 200 200',LOGOS[i].mark(),`class="${cls}" role="img" aria-label="${LOGOS[i].n}"`);
const iconSvg=(i,dark,size)=>svg('0 0 200 200',`<rect width="200" height="200" rx="46" fill="${dark?NUIT:'#ffd1e6'}"/><g transform="translate(16 16) scale(.84)">${LOGOS[i].mark()}</g>`,size?`width="${size}" height="${size}" role="img" aria-label="Icône ${size} px"`:`role="img" aria-label="Icône d'appli"`);
function lockup(i,cls=''){
  const L=LOGOS[i];
  if(L.lock===null) return `<div class="lockup">${markSvg(i,'solo')}</div>`;
  if(L.lock==='only') return `<div class="lockup">${wmSvg('cloud','wide')}</div>`;
  return `<div class="lockup">${markSvg(i)}${wmSvg(L.lock)}</div>`;
}

/* ===== QR factice ===== */
function qr(x,y,sz,seed=11){
  const n=25,m=sz/n;let s=seed,d='';
  const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
  const zone=(i,j,t)=>(i<t&&j<t)||(i<t&&j>=n-t)||(i>=n-t&&j<t);
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){
    let on;
    if(zone(i,j,7)){const a=i<7?i:i-(n-7),b=j<7?j:j-(n-7);on=a===0||a===6||b===0||b===6||(a>=2&&a<=4&&b>=2&&b<=4);}
    else if(zone(i,j,8)) on=false;
    else if(Math.abs(i-12)<=2&&Math.abs(j-12)<=2) on=false;
    else on=rnd()<.48;
    if(on) d+=`M${(x+j*m).toFixed(1)} ${(y+i*m).toFixed(1)}h${m.toFixed(2)}v${m.toFixed(2)}h-${m.toFixed(2)}z`;
  }
  return `<rect x="${x-m*1.5}" y="${y-m*1.5}" width="${sz+3*m}" height="${sz+3*m}" rx="${m*2}" fill="#fff"/><path d="${d}" fill="${P}"/>`+heart(x+sz/2,y+sz/2+m*.3,m*1.6,ROSE);
}

/* ===== Écrans télé 1600 × 900 ===== */
const card=(x,y,w,h,fill='#fff',r=34,sh=10,stw=6)=>`<rect x="${x}" y="${y+sh}" width="${w}" height="${h}" rx="${r}" fill="${P}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${sw(stw)}/>`;
const tvBg=(a='#ffeaf5',b='#e3f2ff')=>`<rect width="1600" height="900" fill="${a}"/><path d="M1600 0V900H760C980 720 1020 260 1600 0Z" fill="${b}"/><circle cx="120" cy="860" r="140" fill="#fff" opacity=".45"/><circle cx="1520" cy="90" r="90" fill="#fff" opacity=".45"/>`;
const tv=(inner,label)=>svg('0 0 1600 900',inner,`role="img" aria-label="${label}"`);
const FAM=[['Mamie Jo','tartine',0,{hat:'noeud',acc:'lunettes'}],['Léo','cornichon',6,{hat:'casquette'}],['Inès','oeuf',3,{hat:'couronne'}],['Papa','fromage',7,{acc:'moustache'}],['Nour','tomate',5,{acc:'soleil'}],['Tom','cupcake',2,{hat:'antenne'}],['Zoé','chaussette',9,{acc:'bisou'}]];

function tvLobby(){
  let g=tvBg();
  g+=`<g transform="translate(40 26) scale(.78)">${wm('cloud')}</g>`;
  g+=card(1280,38,280,74,'#fff',37,7)+plain(1420,88,32,'7 / 12 joueurs',P,'middle',F);
  g+=card(60,150,560,690,'#fff',40,12);
  g+=qr(150,192,380);
  g+=plain(340,648,36,'Scanne avec ton téléphone');
  g+=plain(340,690,26,'ou tape ce code',P,'middle',FT).replace('fill=','opacity=".7" fill=');
  'BZKP'.split('').forEach((ch,i)=>{const x=148+i*100;g+=card(x,712,88,100,[ROSE,VIO,MEN,'#ff9a1f'][i],22,7,5)+label(x+44,786,62,ch);});
  for(let i=0;i<12;i++){
    const x=680+(i%4)*222,y=150+Math.floor(i/4)*232;
    if(i<FAM.length){
      const [nm,k,ci,o]=FAM[i],c=COL[ci];
      g+=card(x,y,200,210,'#fff',30,8,5)+`<circle cx="${x+100}" cy="${y+86}" r="66" fill="${c}" opacity=".22"/>`+C(k,c,o,x+55,y+32,.75);
      g+=plain(x+100,y+190,30,nm);
      if(i<5) g+=`<circle cx="${x+176}" cy="${y+24}" r="18" fill="${MEN}" ${sw(4)}/><path d="M${x+167} ${y+24}l6 6l11 -12" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
    }else{
      g+=`<rect x="${x}" y="${y}" width="200" height="210" rx="30" fill="#fff" fill-opacity=".45" stroke="${P}" stroke-opacity=".3" stroke-width="4" stroke-dasharray="14 12"/><path d="M${x+100} ${y+70}v50M${x+75} ${y+95}h50" stroke="${P}" stroke-opacity=".35" stroke-width="8" stroke-linecap="round"/>`+plain(x+100,y+172,26,'Place libre',P,'middle',FT).replace('fill=','opacity=".45" fill=');
    }
  }
  g+=plain(1114,884,26,'Mamie Jo lance la partie dès que tout le monde est prêt',P,'middle',FT);
  return tv(g,'Salon d’attente');
}
function tvGame(){
  let g=`<rect width="1600" height="900" fill="#cfeeff"/>`+cloud(300,150,70,'#fff',5)+cloud(1180,120,56,'#fff',5)+cloud(760,210,40,'#fff',4);
  const bar=(x1,y1,x2,y2,c)=>`<path d="M${x1} ${y1+10}L${x2} ${y2+10}" stroke="${P}" stroke-width="48" stroke-linecap="round"/><path d="M${x1} ${y1}L${x2} ${y2}" stroke="${P}" stroke-width="48" stroke-linecap="round"/><path d="M${x1} ${y1}L${x2} ${y2}" stroke="${c}" stroke-width="36" stroke-linecap="round"/>`;
  g+=bar(110,300,1000,370,'#7bd13b')+bar(1490,480,560,550,'#ff9ccf')+bar(110,650,1080,720,SOL);
  g+=`<rect x="-10" y="820" width="1620" height="100" fill="#7bd13b" ${sw(6)}/>`;
  /* obstacles */
  g+=`<circle cx="520" cy="${300+70*410/890-74}" r="54" fill="${ROSE}" ${sw(6)}/><path d="M488 ${300+70*410/890-100}q20 -10 40 0" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"/>`;
  g+=`<g transform="rotate(-20 980 480)"><rect x="860" y="470" width="240" height="26" rx="13" fill="${VIO}" ${sw(5)}/><circle cx="980" cy="483" r="18" fill="${SOL}" ${sw(5)}/></g>`;
  /* arrivée */
  g+=`<rect x="1250" y="620" width="22" height="210" fill="#fff" ${sw(5)}/><rect x="1500" y="620" width="22" height="210" fill="#fff" ${sw(5)}/>`;
  let ch='';for(let i=0;i<12;i++)for(let j=0;j<2;j++)if((i+j)%2===0)ch+=`<rect x="${1262+i*21.6}" y="${600+j*22}" width="21.6" height="22" fill="${P}"/>`;
  g+=`<rect x="1262" y="600" width="260" height="44" fill="#fff" ${sw(5)}/>${ch}<rect x="1262" y="600" width="260" height="44" fill="none" ${sw(5)}/>`;
  const on=(x,x1,y1,x2,y2)=>y1+(y2-y1)*(x-x1)/(x2-x1)-24-138*.55;
  g+=C('tomate',COL[5],{},300-33,on(300,110,300,1000,370),.55);
  g+=C('tartine',COL[0],{hat:'noeud'},760-33,on(760,110,300,1000,370),.55);
  g+=C('fromage',COL[7],{acc:'moustache',mood:'wow'},1200-33,on(1200,1490,480,560,550),.55);
  g+=`<g transform="translate(700 ${on(700,1490,480,560,550)+10}) rotate(-28 33 40)">${perso('cornichon',COL[6],{hat:'casquette',mood:'wow'}).replace(/^/,'<g transform="scale(.55)">')}</g></g>`;
  g+=C('oeuf',COL[3],{hat:'couronne'},420-33,on(420,110,650,1080,720),.55);
  g+=C('chaussette',COL[9],{},880-33,on(880,110,650,1080,720),.55);
  g+=C('cupcake',COL[2],{mood:'win',arms:true,hat:'antenne'},1120-33,820-138*.55,.55);
  /* HUD */
  g+=card(30,24,560,90,'#fff',45,8,5)+plain(70,82,40,'La Dégringolade',P,'start',F)+plain(560,80,26,'Manche 2 / 5',P,'end',FT);
  g+=`<circle cx="800" cy="76" r="62" fill="${P}"/><circle cx="800" cy="68" r="62" fill="${SOL}" ${sw(6)}/>`+plain(800,84,46,'0:42');
  g+=card(1410,686,160,186,'#fff',24,6,5)+qr(1430,702,120,5)+plain(1490,858,26,'BZKP');
  return tv(g,'Écran de jeu');
}
function tvResults(){
  let g=tvBg('#fff4c2','#ffe3f1');
  g+=wmText(800,108,68,'middle','Résultats de la manche',ROSE);
  g+=plain(800,158,30,'Manche 3 sur 5 · Sumo Tamponneur',P,'middle',FT);
  const R=[['Inès','oeuf',3,1450,300,{hat:'couronne'}],['Léo','cornichon',6,1320,200,{hat:'casquette'}],['Mamie Jo','tartine',0,1180,150,{hat:'noeud',acc:'lunettes'}],['Nour','tomate',5,990,100,{acc:'soleil'}],['Papa','fromage',7,860,50,{acc:'moustache'}],['Tom','cupcake',2,700,0,{hat:'antenne'}]];
  const medal=['#ffd60a','#dfe3f0','#ffb36b','#fff','#fff','#fff'];
  R.forEach(([nm,k,ci,pts,gain,o],i)=>{
    const y=196+i*110,c=COL[ci];
    g+=card(120,y,1040,94,'#fff',26,6,5);
    g+=`<circle cx="180" cy="${y+47}" r="30" fill="${medal[i]}" ${sw(5)}/>`+plain(180,y+59,34,i+1);
    g+=C(k,c,o,236,y+18,.45);
    g+=plain(320,y+60,34,nm,P,'start',F);
    const w=Math.round(pts/1450*420);
    g+=`<rect x="580" y="${y+28}" width="440" height="38" rx="19" fill="#f3e9f7"/><rect x="580" y="${y+28}" width="${w}" height="38" rx="19" fill="${c}" ${sw(4)}/>`;
    g+=plain(1140,y+60,32,pts,P,'end',F);
    if(gain) g+=card(1186,y+20,124,54,MEN,27,5,4)+label(1248,y+58,30,'+'+gain);
  });
  g+=card(1350,196,210,300,'#fff',30,8,5)+plain(1455,250,26,'Au suivant',P,'middle',FT)+`<g transform="translate(1385 270) scale(.7)">${GAMES[5].art()}</g>`+plain(1455,486,24,'Mini Bolides');
  g+=plain(1455,560,24,'Prochain jeu',P,'middle',FT).replace('fill=','opacity=".6" fill=')+plain(1455,600,24,'dans 5 s',P,'middle',FT).replace('fill=','opacity=".6" fill=');
  return tv(g,'Résultats');
}
function tvPodium(){
  let g=tvBg('#efe6ff','#ffe3f1');
  let s=3;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
  for(let i=0;i<46;i++){const x=rnd()*1600,y=rnd()*560+20,a=rnd()*180,c=COL[Math.floor(rnd()*10)];g+=`<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="18" height="10" rx="3" fill="${c}" transform="rotate(${a.toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})"/>`;}
  g+=wmText(800,130,84,'middle','Champions du canapé !',SOL);
  const B=[[400,560,'#dfe3f0','2','Léo','cornichon',6,{hat:'casquette'}],[675,450,SOL,'1','Inès','oeuf',3,{hat:'couronne',mood:'win',arms:true}],[950,620,'#ffb36b','3','Mamie Jo','tartine',0,{hat:'noeud',acc:'lunettes'}]];
  B.forEach(([x,y,c,n,nm,k,ci,o])=>{
    g+=card(x,y,250,850-y,c,28,10,6)+label(x+125,y+108,96,n,'#fff')+plain(x+125,y+168,32,nm);
    g+=C(k,COL[ci],o,x+125-66,y-152,1.1);
  });
  g+=sofaBig();
  g+=plain(800,888,26,'Rejouer ou nouveau tournoi : c’est l’hôte qui choisit sur son téléphone',P,'middle',FT);
  return tv(g,'Podium final');
}
function sofaBig(){return `<g transform="translate(1260 600) scale(1.25)" opacity=".9">${sofa()}${C('coussin',SOL,{mood:'win'},44,24,.88)}</g>`}

/* ===== Téléphones ===== */
function phone(inner,w=380,h=780,label=''){
  return svg(`0 0 ${w} ${h}`,`<rect x="0" y="8" width="${w}" height="${h-8}" rx="54" fill="${P}" opacity=".35"/><rect x="0" y="0" width="${w}" height="${h-8}" rx="54" fill="${P}"/><rect x="12" y="12" width="${w-24}" height="${h-32}" rx="44" fill="#ffeaf5"/><g transform="translate(12 12)">${inner}</g><rect x="${w/2-50}" y="20" width="100" height="22" rx="11" fill="${P}"/>`,`role="img" aria-label="${label}"`);
}
const btn=(x,y,w,h,fill,txt,size=34,sub='')=>card(x,y,w,h,fill,h/2>40?32:h/2,7,5)+label(x+w/2,y+h/2+(sub?2:size*.35),size)+(sub?plain(x+w/2,y+h/2+34,18,sub,'#fff','middle',FT):'');
function phHost(){
  let g=`<g transform="translate(36 48) scale(.7)">${wm('cloud')}</g>`;
  g+=card(20,150,316,108,'#fff',26,6,4)+plain(40,190,20,'Code de la partie',P,'start',FT)+plain(40,234,40,'BZKP',P,'start',F);
  FAM.forEach((f,i)=>{g+=`<circle cx="${190+i*20}" cy="${222}" r="14" fill="${COL[f[2]]}" ${sw(3.5)}/>`});
  g+=plain(316,190,20,'7 joueurs',P,'end',FT);
  g+=plain(178,312,26,'Tu es l’hôte ! On joue à quoi ?');
  g+=card(20,336,316,140,ROSE,32,8,5)+star(78,406,30,SOL,4)+label(206,410,42,'Tournoi')+plain(206,446,18,'5 jeux, un champion','#fff','middle',FT);
  g+=card(20,500,316,140,VIO,32,8,5)+`<rect x="52" y="540" width="26" height="26" rx="7" fill="${SOL}" ${sw(3.5)}/><rect x="84" y="540" width="26" height="26" rx="7" fill="${MEN}" ${sw(3.5)}/><rect x="52" y="572" width="26" height="26" rx="7" fill="${CIEL}" ${sw(3.5)}/><rect x="84" y="572" width="26" height="26" rx="7" fill="${ROSE}" ${sw(3.5)}/>`+label(214,574,36,'Choisir un jeu')+plain(214,610,18,'13 jeux au catalogue','#fff','middle',FT);
  g+=card(20,670,150,52,'#fff',26,5,4)+plain(95,704,20,'Inviter',P,'middle',F)+card(186,670,150,52,'#fff',26,5,4)+plain(261,704,20,'Réglages',P,'middle',F);
  return phone(g,380,780,'Écran de l’hôte');
}
function phEditor(){
  let g=plain(178,80,30,'Mon perso');
  g+=`<circle cx="178" cy="200" r="104" fill="#fff" ${sw(5)}/><ellipse cx="178" cy="298" rx="70" ry="12" fill="${P}" opacity=".12"/>`;
  g+=C('tartine',COL[5],{hat:'bob',acc:'soleil'},178-60*1.15,190-75*1.15,1.15);
  ['Perso','Couleur','Chapeau','Déco'].forEach((t,i)=>{const x=16+i*82;g+=`<rect x="${x}" y="330" width="76" height="36" rx="18" fill="${i===0?ROSE:'#fff'}" ${sw(3.5)}/>`+plain(x+38,354,16,t,i===0?'#fff':P,'middle',F);});
  ['coussin','tartine','cornichon','beignet','oeuf','fromage','tomate','brocoli'].forEach((k,i)=>{
    const x=16+(i%4)*84,y=382+Math.floor(i/4)*92;
    g+=`<rect x="${x}" y="${y}" width="76" height="84" rx="18" fill="#fff" ${sw(k==='tartine'?5:3, k==='tartine'?ROSE:P)}/>`+C(k,COL[5],{},x+38-60*.46,y+10+16,.46);
  });
  COL.forEach((c,i)=>{g+=`<circle cx="${30+i*27}" cy="${584}" r="11" fill="${c}" ${sw(i===5?5:3)}/>`});
  g+=card(16,612,150,50,'#fff',25,5,4)+`<rect x="34" y="626" width="26" height="20" rx="5" fill="${CIEL}" ${sw(3)}/><circle cx="47" cy="636" r="5" fill="#fff" ${sw(2.5)}/>`+plain(110,644,18,'Selfie',P,'middle',F);
  g+=card(180,612,160,50,SOL,25,5,4)+plain(260,644,18,'Au hasard',P,'middle',F);
  g+=card(16,680,324,52,MEN,26,6,5)+label(178,716,28,'C’est moi !');
  return phone(g,380,780,'Éditeur de personnage');
}
function phTwo(){
  let g=`<rect x="0" y="0" width="356" height="92" rx="44" fill="${COL[6]}"/><rect x="0" y="50" width="356" height="42" fill="${COL[6]}"/>`+C('cornichon',COL[6],{hat:'casquette'},20,22,.42)+plain(80,74,26,'Léo',P,'start',F)+plain(336,74,20,'Sumo Tamponneur',P,'end',FT);
  g+=`<circle cx="178" cy="282" r="120" fill="${P}"/><circle cx="178" cy="270" r="120" fill="${ROSE}" ${sw(6)}/><circle cx="140" cy="222" r="26" fill="#fff" opacity=".35"/>`+label(178,286,44,'POUSSER');
  g+=`<circle cx="178" cy="572" r="104" fill="${P}"/><circle cx="178" cy="560" r="104" fill="${SOL}" ${sw(6)}/><circle cx="146" cy="518" r="22" fill="#fff" opacity=".45"/>`+label(178,576,44,'SAUTER');
  g+=plain(178,718,18,'Tiens ton téléphone à une main',P,'middle',FT).replace('fill=','opacity=".6" fill=');
  return phone(g,380,780,'Manette à deux boutons');
}
function phStick(){
  let g=`<rect x="0" y="0" width="756" height="64" rx="40" fill="${COL[3]}"/><rect x="0" y="30" width="756" height="34" fill="${COL[3]}"/>`+C('oeuf',COL[3],{hat:'couronne'},120,10,.32)+plain(166,46,24,'Inès',P,'start',F)+plain(378,46,24,'Mini Bolides',P,'middle',F)+plain(640,46,20,'2e / 7',P,'end',FT);
  g+=`<circle cx="160" cy="214" r="104" fill="#fff" ${sw(6)}/><circle cx="160" cy="214" r="70" fill="none" stroke="${P}" stroke-opacity=".15" stroke-width="4" stroke-dasharray="10 10"/>`;
  [[0,-1],[0,1],[-1,0],[1,0]].forEach(([dx,dy])=>{const x=160+dx*86,y=214+dy*86;g+=`<path d="M${x-dy*8-dx*0} ${y-dx*8} L${x+dx*10} ${y+dy*10} L${x+dy*8} ${y+dx*8}Z" fill="${P}" opacity=".3"/>`});
  g+=`<circle cx="184" cy="${200+10}" r="48" fill="${P}"/><circle cx="184" cy="200" r="48" fill="${ROSE}" ${sw(6)}/><circle cx="170" cy="184" r="12" fill="#fff" opacity=".4"/>`;
  g+=`<circle cx="626" cy="${168+9}" r="62" fill="${P}"/><circle cx="626" cy="168" r="62" fill="${ROSE}" ${sw(6)}/>`+label(626,186,52,'A');
  g+=`<circle cx="510" cy="${258+8}" r="52" fill="${P}"/><circle cx="510" cy="258" r="52" fill="${VIO}" ${sw(6)}/>`+label(510,276,48,'B');
  g+=plain(626,268,18,'Turbo',P,'middle',FT)+plain(510,338,18,'Objet',P,'middle',FT);
  return svg('0 0 780 380',`<rect x="0" y="8" width="780" height="372" rx="54" fill="${P}" opacity=".35"/><rect x="0" y="0" width="780" height="372" rx="54" fill="${P}"/><rect x="12" y="12" width="756" height="348" rx="44" fill="#ffeaf5"/><g transform="translate(12 12)">${g}</g>`,`role="img" aria-label="Manette stick et boutons A B"`);
}

/* ===== Icônes des jeux (200 × 200) ===== */
const GAMES=[
 {n:'Course de pouces',d:'Tape le plus vite possible',bg:SOL,art:()=>{let f='';for(let i=0;i<4;i++)for(let j=0;j<4;j++)f+=`<rect x="${26+i*10}" y="${24+j*10}" width="10" height="10" fill="${(i+j)%2?'#fff':P}"/>`;return `<path d="M26 24V110" ${sw(5)}/>${f}<rect x="26" y="24" width="40" height="40" fill="none" ${sw(4)}/><ellipse cx="114" cy="152" rx="56" ry="18" fill="${P}"/><path d="M58 134V150A56 18 0 0 0 170 150V134Z" fill="#c2186b" ${sw(5)}/><ellipse cx="114" cy="134" rx="56" ry="18" fill="${ROSE}" ${sw(5)}/><rect x="94" y="34" width="40" height="96" rx="20" fill="#fff" ${sw(5)}/><rect x="102" y="42" width="24" height="24" rx="9" fill="#ffd6ea" ${sw(3)}/><path d="M92 128h44" ${sw(4)}/><path d="M50 116Q40 104 48 90M178 116Q188 104 180 90M62 104Q56 96 60 88M166 104Q172 96 168 88" fill="none" ${sw(4)}/>`}},
 {n:'La Dégringolade',d:'Course d’obstacles',bg:CIEL,art:()=>`<path d="M26 64L120 84" stroke="${P}" stroke-width="22" stroke-linecap="round"/><path d="M26 64L120 84" stroke="#fff" stroke-width="12" stroke-linecap="round"/><path d="M176 112L80 132" stroke="${P}" stroke-width="22" stroke-linecap="round"/><path d="M176 112L80 132" stroke="#fff" stroke-width="12" stroke-linecap="round"/><path d="M26 168H176" stroke="${P}" stroke-width="22" stroke-linecap="round"/><path d="M26 168H176" stroke="#7bd13b" stroke-width="12" stroke-linecap="round"/>`+`<g transform="translate(70 76) rotate(28) scale(.48) translate(-60 -80)">${perso('oeuf',ROSE,{mood:'wow'})}</g>`+star(150,52,12,SOL)+star(40,120,8,SOL)},
 {n:'Le Bar des Bobards',d:'Bluff aux cartes',bg:VIO,art:()=>`<g transform="rotate(-14 80 96)"><rect x="40" y="40" width="72" height="104" rx="12" fill="#fff" ${sw(5)}/>${label(76,112,62,'?',ROSE)}</g><g transform="rotate(12 124 96)"><rect x="88" y="36" width="72" height="104" rx="12" fill="#fff" ${sw(5)}/>${label(124,108,62,'!',SOL)}</g>`+C('cornichon',MEN,{acc:'soleil'},104,96,.56)},
 {n:'Pétards Mouillés',d:'Bombes qui font pschitt',bg:MEN,art:()=>`<path d="M134 66Q150 40 166 42" fill="none" ${sw(6)}/><g transform="rotate(35 128 70)"><rect x="112" y="58" width="32" height="22" rx="6" fill="#b8bcd4" ${sw(4)}/></g><circle cx="92" cy="122" r="54" fill="${VIO}" ${sw(5)}/><ellipse cx="68" cy="94" rx="12" ry="6" fill="#a98bff" transform="rotate(-35 68 94)"/>`+face(92,118,'wow',1.35)+cloud(168,40,16,'#fff',3.5)+`<path d="M164 8Q172 18 168 24Q162 26 160 18Q160 12 164 8Z" fill="${CIEL}" ${sw(3)}/><path d="M154 122Q160 130 156 136Q150 136 150 130Z" fill="${CIEL}" ${sw(3)}/>`},
 {n:'Sumo Tamponneur',d:'Pousse les autres hors du tapis',bg:'#ff9a1f',art:()=>`<ellipse cx="100" cy="138" rx="84" ry="42" fill="#fff3d6" ${sw(5)}/><ellipse cx="100" cy="138" rx="62" ry="28" fill="none" stroke="${P}" stroke-opacity=".25" stroke-width="4" stroke-dasharray="10 8"/>`+C('tomate',CIEL,{mood:'wow'},14,46,.62)+C('beignet',ROSE,{},96,46,.62)+star(100,64,16,SOL,4)},
 {n:'Mini Bolides',d:'Course de karts',bg:'#3a6bff',art:()=>C('cornichon',SOL,{hat:'casquette'},62,40,.6)+`<path d="M28 132Q32 104 70 104H130L152 90H172Q180 120 168 138H32Z" fill="${ROSE}" ${sw(5)}/><circle cx="60" cy="146" r="20" fill="${P}"/><circle cx="60" cy="146" r="7" fill="#fff"/><circle cx="150" cy="146" r="20" fill="${P}"/><circle cx="150" cy="146" r="7" fill="#fff"/><path d="M8 96H28M4 116H22M10 136H24" stroke="#fff" stroke-width="6" stroke-linecap="round"/>`},
 {n:'Flèches à Ventouse',d:'Tir à l’arc tout doux',bg:'#e08bff',art:()=>`<circle cx="92" cy="108" r="72" fill="#fff" ${sw(5)}/><circle cx="92" cy="108" r="52" fill="${ROSE}" ${sw(4)}/><circle cx="92" cy="108" r="32" fill="#fff" ${sw(4)}/><circle cx="92" cy="108" r="13" fill="${ROSE}" ${sw(4)}/><path d="M100 100L172 28" stroke="${P}" stroke-width="12" stroke-linecap="round"/><path d="M100 100L172 28" stroke="${SOL}" stroke-width="5" stroke-linecap="round"/><path d="M164 20L184 16L180 36ZM156 28L170 12M176 44L188 30" fill="${MEN}" ${sw(4)}/><ellipse cx="97" cy="103" rx="15" ry="8" fill="#ff3b3b" transform="rotate(45 97 103)" ${sw(4)}/><path d="M148 70Q156 74 154 82M162 56Q170 60 168 68" fill="none" ${sw(3.5)}/>`},
 {n:'Bagarre Molle',d:'Bataille d’oreillers',bg:'#7bd13b',art:()=>{const pil=(cx,cy,r,f)=>`<g transform="rotate(${r} ${cx} ${cy})"><path d="M${cx-42} ${cy-32}Q${cx} ${cy-42} ${cx+42} ${cy-32}Q${cx+52} ${cy} ${cx+42} ${cy+32}Q${cx} ${cy+42} ${cx-42} ${cy+32}Q${cx-52} ${cy} ${cx-42} ${cy-32}Z" fill="${f}" ${sw(5)}/><path d="M${cx-30} ${cy-20}Q${cx} ${cy-26} ${cx+30} ${cy-20}" fill="none" stroke="${P}" stroke-opacity=".25" stroke-width="3" stroke-linecap="round"/></g>`;const fe=(x,y,a)=>`<path d="M${x} ${y}q10 -14 20 0q-10 14 -20 0Z" fill="#fff" ${sw(3)} transform="rotate(${a} ${x} ${y})"/>`;return pil(70,120,-18,'#fff')+pil(130,92,16,'#ffd6ea')+face(130,92,'happy',.9)+fe(30,48,20)+fe(160,160,-30)+fe(100,30,60)+star(100,108,12,SOL)}},
 {n:'Cuisine en Panique',d:'Recettes à plusieurs',bg:ROSE,art:()=>`<path d="M132 140L188 160" stroke="${P}" stroke-width="22" stroke-linecap="round"/><path d="M134 140L184 158" stroke="#a0643a" stroke-width="12" stroke-linecap="round"/><ellipse cx="88" cy="146" rx="62" ry="30" fill="#5a3a63" ${sw(5)}/><ellipse cx="88" cy="140" rx="48" ry="20" fill="#7a5a83"/><path d="M58 64Q60 36 92 40Q124 34 128 60Q134 86 98 84Q60 92 58 64Z" fill="#fff" ${sw(5)}/><circle cx="94" cy="62" r="13" fill="${SOL}" ${sw(4)}/><path d="M40 108Q30 84 44 62M146 106Q160 86 148 66" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M160 24Q168 34 164 40Q158 42 156 34Q156 28 160 24Z" fill="${CIEL}" ${sw(3)}/><path d="M28 34Q36 44 32 50Q26 52 24 44Q24 38 28 34Z" fill="${CIEL}" ${sw(3)}/>`},
 {n:'Le Traître du Frigo',d:'Rôle caché',bg:CIEL,art:()=>`<rect x="52" y="22" width="92" height="164" rx="18" fill="${P}"/><rect x="52" y="22" width="92" height="56" rx="18" fill="#fff" ${sw(5)}/><path d="M52 78V168Q52 186 70 186H122V78Z" fill="#fff" ${sw(5)}/><rect x="52" y="22" width="92" height="164" rx="18" fill="none" ${sw(5)}/><rect x="108" y="40" width="8" height="24" rx="4" fill="${P}"/><rect x="108" y="94" width="8" height="34" rx="4" fill="${P}"/><circle cx="128" cy="112" r="5" fill="${SOL}"/><circle cx="139" cy="112" r="5" fill="${SOL}"/><circle cx="129" cy="113" r="2.2" fill="${P}"/><circle cx="140" cy="113" r="2.2" fill="${P}"/>${heart(80,138,9,ROSE)}<circle cx="78" cy="48" r="7" fill="${SOL}" ${sw(3)}/>`+card(146,24,40,44,'#fff',14,4,4)+label(166,58,32,'?',VIO)},
 {n:'Gribouillis',d:'Dessine, les autres devinent',bg:'#fff7e0',art:()=>`<path d="M24 156C44 116 62 176 80 138C88 120 96 126 100 132" fill="none" stroke="${ROSE}" stroke-width="9" stroke-linecap="round"/>`+star(56,64,22,'none',5).replace(`stroke="${P}"`,`stroke="${VIO}"`)+`<path d="M150 158q8 -10 16 0q8 10 16 0" fill="none" stroke="${MEN}" stroke-width="6" stroke-linecap="round"/><g transform="translate(132 84) rotate(35)"><rect x="-14" y="-56" width="28" height="86" fill="${SOL}" ${sw(4)}/><path d="M-14 30L0 58L14 30Z" fill="#ffe0b0" ${sw(4)}/><path d="M-5 48L0 58L5 48Z" fill="${P}"/><rect x="-14" y="-76" width="28" height="22" rx="7" fill="${ROSE}" ${sw(4)}/><rect x="-14" y="-58" width="28" height="8" fill="#c7c7d6" ${sw(3)}/></g>`},
 {n:'Le Grand Plateau',d:'Jeu de plateau et mini-jeux',bg:MEN,art:()=>{let g='';const sq=[[18,148],[52,148],[86,148],[120,148],[154,148],[154,114],[120,114],[86,114]];sq.forEach(([x,y],i)=>g+=`<rect x="${x}" y="${y}" width="30" height="30" rx="8" fill="${[ROSE,SOL,CIEL,'#fff',VIO,'#ff9a1f',ROSE,SOL][i]}" ${sw(4)}/>`);g+=`<path d="M93 112Q92 92 101 88Q110 92 109 112Z" fill="${ROSE}" ${sw(4)}/><circle cx="101" cy="84" r="9" fill="${ROSE}" ${sw(4)}/>`;g+=`<g transform="rotate(-14 62 66)"><rect x="34" y="38" width="58" height="58" rx="14" fill="#fff" ${sw(5)}/><circle cx="50" cy="54" r="6" fill="${P}"/><circle cx="63" cy="67" r="6" fill="${P}"/><circle cx="76" cy="80" r="6" fill="${P}"/></g>`+star(150,52,14,SOL);return g}},
 {n:'Coussin Clash',d:'Combat sur plateformes',bg:VIO,art:()=>`<rect x="34" y="150" width="132" height="24" rx="12" fill="${P}"/><rect x="34" y="144" width="132" height="24" rx="12" fill="${MEN}" ${sw(5)}/>`+cloud(54,180,12,'#fff',3)+cloud(146,180,12,'#fff',3)+C('coussin',SOL,{mood:'win',arms:true},46,30,.9)+star(26,52,10,SOL)+star(176,40,12,SOL)+star(172,96,7,'#fff')},
];
const gameSvg=i=>svg('0 0 200 200',`<rect x="6" y="12" width="188" height="182" rx="44" fill="${P}"/><rect x="6" y="6" width="188" height="182" rx="44" fill="${GAMES[i].bg}" ${sw(5)}/>${GAMES[i].art()}`,`role="img" aria-label="${GAMES[i].n}"`);

/* ===== Variables CSS ===== */
const CSS=`:root {
  /* Marque */
  --cp-rose: #ff4f9a;
  --cp-violet: #7b4dff;      /* le canapé */
  --cp-violet-clair: #9b72ff;
  --cp-soleil: #ffd60a;      /* le nuage, les étoiles */
  --cp-menthe: #1fc9a0;      /* validation, « prêt » */
  --cp-ciel: #2ec5ff;
  --cp-prune: #3a2140;       /* contours, texte */
  --cp-prune-doux: #6b5573;  /* texte secondaire */
  --cp-nuit: #2a1838;        /* fond « soirée » */
  --cp-blanc: #ffffff;

  /* Fonds */
  --cp-fond-1: #ffe3f1;
  --cp-fond-2: #e3f2ff;
  --cp-fond: linear-gradient(160deg, var(--cp-fond-1), var(--cp-fond-2));

  /* Couleurs des joueurs */
${COL.map((c,i)=>`  --cp-joueur-${i+1}: ${c};${' '.repeat(i<9?1:0)}  /* ${COLN[i]} */`).join('\n')}

  /* Dessin */
  --cp-contour: 4px;
  --cp-contour-tv: 6px;
  --cp-ombre: 0 5px 0 var(--cp-prune);
  --cp-ombre-tv: 0 10px 0 var(--cp-prune);
  --cp-rayon: 24px;
  --cp-rayon-pilule: 999px;
  --cp-autocollant: 0 0 0 6px var(--cp-blanc);

  /* Typographie */
  --cp-font-titre: 'Fredoka', 'Nunito', system-ui, sans-serif;  /* 700 titres, 600 boutons */
  --cp-font-texte: 'Nunito', system-ui, sans-serif;
  --cp-tv-titre: 72px;
  --cp-tv-texte: 32px;
  --cp-tv-mini: 28px;        /* jamais plus petit à la télé */
  --cp-tel-bouton: 24px;
  --cp-tel-texte: 17px;
}`;


// ---- API publique ----
export const COLORS = { P, ROSE, VIO, VIO2, SOL, MEN, CIEL, NUIT };
export const PLAYER_COLORS = COL;
export const PLAYER_COLOR_NAMES = COLN;
export const CHARACTERS = Object.fromEntries(KEYS.map(k => [k, K[k].n]));
export const HATS = ['couronne','casquette','haut','bob','cornes','antenne','noeud','toque','fete','pirate','aureole','fleur','bonnet','sorciere'];
/** Regards et poses au choix. */
export const EYES = ['cool','round','sleepy','angry','wink','star'];
export const POSES = ['hip','cross','flex','wave','thumbs','shy'];
export const LOOKS = LOOK;
export const ACCESSORIES = ['lunettes','soleil','moustache','monocle','bisou','coeurs','masque','barbe','rougir'];
export const MOODS = ['happy','wow','sad','win','toot'];
/** Personnage complet. kind: clé de CHARACTERS ; color: couleur des baskets ;
 *  opts: { mood, hat, acc, selfie, arms, toot }. Renvoie un <svg> (viewBox ${VB}). */
export function characterSvg(kind, color = ROSE, opts = {}) { return persoSvg(kind, color, opts); }
/** Même chose sans balise <svg>, à placer dans un <g> d'un SVG plus grand (repère 120×150, sol à y=138). */
export function characterGroup(kind, color = ROSE, opts = {}) { return perso(kind, color, opts); }
/** Pour un selfie : remplace le visage par un cercle. Coordonnées et rayon du visage de chaque perso. */
export function faceSlot(kind) { const k = K[kind], s = k.fs || 1; return { cx: 60, cy: BY(k.fy + 2 * s), r: 20 * s * SC }; }
export const CHARACTER_VIEWBOX = VB;
export { coussinTQ as mascotThreeQuarterGroup, sofa as sofaGroup, cloudD as cloudPath, star as starGroup, heart as heartGroup, wmText as stickerText };
/** Monogramme C'p (viewBox 0 0 200 200). */
export const monogramSvg = () => markSvg(4, '');
/** Logotype « Cana'pet » à apostrophe-nuage (viewBox 0 0 400 124). */
export const wordmarkSvg = () => svg('0 0 400 124', wm('cloud'), 'role="img" aria-label="Cana\'pet"');
/** Icône d'appli. dark=true pour le fond soirée. */
export const appIconSvg = (dark = false) => iconSvg(4, dark);
export const GAME_LIST = GAMES.map((g, i) => ({ slug: ['course-de-pouces','la-degringolade','le-bar-des-bobards','petards-mouilles','sumo-tamponneur','mini-bolides','fleches-a-ventouse','bagarre-molle','cuisine-en-panique','le-traitre-du-frigo','gribouillis','le-grand-plateau','coussin-clash'][i], name: g.n, tagline: g.d, color: g.bg }));
export const gameIconSvg = (i) => gameSvg(i);
export const tokensCss = CSS;
export { tvLobby, tvGame, tvResults, tvPodium, phHost, phEditor, phTwo, phStick, qr as fakeQrGroup };
