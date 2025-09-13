/* ========= Utilities ========= */
const $ = (id)=>document.getElementById(id);
const toast = (msg, ms=1800)=>{ const t=$('toast'); t.textContent=msg; t.style.display='block'; setTimeout(()=>t.style.display='none', ms); };
const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
const interp=(x,x0,x1,y0,y1)=>y0 + ((x-x0)/(x1-x0))*(y1-y0);
const good = (x)=>x!=null && !isNaN(x);

/* ========= Thresholds (QĐ 1460) ========= */
const BP = {
  BOD:[4,6,15,25,50], COD:[10,15,30,50,150], TOC:[4,6,15,25,50],
  // Giữ breakpoints NH4 theo bảng, nhưng mapping q cho NH4 sẽ custom ở dưới
  NH4:[0.3,0.6,0.9,5.0],
  NO3:[2,5,10,15], NO2_only:0.05, PO4:[0.1,0.2,0.3,0.5,4],
  Coli:[2500,5000,7500,10000], Ecoli:[20,50,100,200],
  As:[0.01,0.02,0.05,0.1], Cd:[0.005,0.008,0.01,0.1], Pb:[0.02,0.04,0.05,0.5],
  Cr6:[0.01,0.02,0.04,0.1], Cu:[0.1,0.2,0.5,1.0,2.0], Zn:[0.5,1.0,1.5,2.0,3.0], Hg:[0.001,0.0015,0.002,0.01],
  Aldrin:0.1, BHC:0.02, Dieldrin:0.1, DDTs:1.0, Hept:0.2,
  Turb:[5,20,30,70,100], // Độ đục (NTU)
  TSS:[20,30,50,100,130] // TSS (mg/L)
};

/* ========= WQI building blocks ========= */
function wqiFromBreakpoints(cp, t){ if (cp==null||isNaN(cp)) return null;
  const q=[100,75,50,25,10]; if (cp<=t[0]) return 100;
  for (let i=1;i<t.length;i++){ if (cp<=t[i]){ const [x0,x1]=[t[i-1],t[i]], [y0,y1]=[q[i-1],q[i]];
    return y0 + ((cp-x0)/(x1-x0))*(y1-y0);} } return 10; }

// NH4 theo mapping bạn yêu cầu
function wqiNH4(cp){
  if (cp==null || isNaN(cp)) return null;
  if (cp < 0.3) return 100;
  if (cp <= 0.6) return interp(cp, 0.3, 0.6, 75, 50);  // 75→50
  if (cp <= 0.9) return interp(cp, 0.6, 0.9, 50, 25);  // 50→25
  if (cp <  5.0) return interp(cp, 0.9, 5.0, 25, 10);  // 25→10
  return 10; // ≥5.0
}

function wqiGroupIV(param, cp){
  if (cp==null || isNaN(cp)) return null;
  switch(param){
    case 'BOD': return wqiFromBreakpoints(cp, BP.BOD);
    case 'COD': return wqiFromBreakpoints(cp, BP.COD);
    case 'TOC': return wqiFromBreakpoints(cp, BP.TOC);
    case 'NH4': return wqiNH4(cp); // dùng custom
    case 'NO3': return wqiFromBreakpoints(cp, BP.NO3);
    case 'NO2': return (cp<=BP.NO2_only?100:10);
    case 'PO4': return wqiFromBreakpoints(cp, BP.PO4);
  }
}

function wqiMetal(name, cp){
  const map={As:BP.As,Cd:BP.Cd,Pb:BP.Pb,Cr6:BP.Cr6,Cu:BP.Cu,Zn:BP.Zn,Hg:BP.Hg}[name];
  return map? wqiFromBreakpoints(cp,map) : null;
}
function wqiPesticide(name,val){
  if (val==null||isNaN(val)) return null;
  const lim={Aldrin:BP.Aldrin,BHC:BP.BHC,Dieldrin:BP.Dieldrin,DDTs:BP.DDTs,Hept:BP.Hept}[name];
  return (val<=lim)?100:10;
}

// Thêm hàm tính WQI cho Độ đục và TSS
function wqiTurbidity(val) {
  if (val == null || isNaN(val)) return null;
  const q = [100,75,50,25,1];
  const t = BP.Turb;
  if (val <= t[0]) return 100;
  for (let i = 1; i < t.length; i++) {
    if (val <= t[i]) {
      const [x0, x1] = [t[i-1], t[i]], [y0, y1] = [q[i-1], q[i]];
      return y0 + ((val-x0)/(x1-x0))*(y1-y0);
    }
  }
  return 1;
}
function wqiTSS(val) {
  if (val == null || isNaN(val)) return null;
  const q = [100,75,50,25,1];
  const t = BP.TSS;
  if (val <= t[0]) return 100;
  for (let i = 1; i < t.length; i++) {
    if (val <= t[i]) {
      const [x0, x1] = [t[i-1], t[i]], [y0, y1] = [q[i-1], q[i]];
      return y0 + ((val-x0)/(x1-x0))*(y1-y0);
    }
  }
  return 1;
}

/* === DO: tính theo từng đoạn Bảng 3 === */
function wqiDO(doMgL,tempC){
  if(!good(doMgL)||!good(tempC)) return null;
  const DOsat = 14.652 - 0.41022*tempC + 0.0079910*tempC*tempC - 0.000077774*tempC*tempC*tempC;
  const DOpct = (doMgL/DOsat)*100;

  let WQI;
  if (DOpct < 20 || DOpct > 200) {
    WQI = 10;
  } else if (DOpct >= 88 && DOpct <= 112) {
    WQI = 100;
  } else {
    const BPx = [20,50,75,88,112,125,150,200];
    const q   = [25,50,75,100,100,75,50,25];
    let i = -1;
    for (let k=0;k<BPx.length-1;k++){
      if (DOpct >= BPx[k] && DOpct <= BPx[k+1]) { i=k; break; }
    }
    if (i === -1) WQI = 10;
    else WQI = ((q[i+1]-q[i])/(BPx[i+1]-BPx[i]))*(DOpct-BPx[i]) + q[i];
  }
  return {WQI, DOsat, DOpct};
}

function wqiPH(ph){
  if(!good(ph)) return null;
  if (ph<5.5||ph>9) return 10;
  if (ph<6) return interp(ph,5.5,6,50,100);
  if (ph<=8.5) return 100;
  return interp(ph,8.5,9,100,50);
}

function aggregateWQI({wqiI, arrII, arrIII, arrIV, arrV, weighted=false}){
  const mult = (a)=>a.reduce((x,y)=>x*y,1), mean=(a)=>a.reduce((x,y)=>x+y,0)/a.length;
  const fI = (wqiI!=null)? (wqiI/100) : 1;
  const II=arrII.filter(good), III=arrIII.filter(good), IV=arrIV.filter(good), V=arrV.filter(good);
  if (!IV.length) return {WQI:null, IV:null, V:null, core:null};
  const fII = II.length? Math.pow(mult(II.map(v=>v/100)), 1/II.length) : 1;
  const fIII= III.length? Math.pow(mult(III.map(v=>v/100)), 1/III.length) : 1;
  const avgIV = mean(IV); const avgV = V.length? mean(V) : null;
  let core = avgIV;
  if (avgV!=null){ core = weighted ? Math.cbrt(avgIV*avgIV*avgV) : Math.sqrt(avgIV*avgV); }
  return {WQI: Math.round(clamp(100*fI*fII*fIII*(core/100),0,100)), IV:avgIV, V:avgV, core};
}

function classify(wqi){
  if (wqi==null) return {label:"–", color:"#e8eef7"};
  const gs=getComputedStyle(document.documentElement);
  if (wqi>=91) return {label:"Rất tốt", color:gs.getPropertyValue('--sea').trim()};
  if (wqi>=76) return {label:"Tốt", color:gs.getPropertyValue('--green').trim()};
  if (wqi>=51) return {label:"Trung bình", color:gs.getPropertyValue('--yellow').trim()};
  if (wqi>=26) return {label:"Xấu", color:gs.getPropertyValue('--orange').trim()};
  if (wqi>=10) return {label:"Kém", color:gs.getPropertyValue('--red').trim()};
  return {label:"Ô nhiễm rất nặng", color:gs.getPropertyValue('--brown').trim()};
}

/* ========= Explain helpers ========= */
const fmt = (v,d=3)=> (v==null||isNaN(v)) ? '–' : Number(v).toFixed(d);
function gm(arr){ return Math.pow(arr.reduce((a,b)=>a*b,1), 1/arr.length); }
function mean(arr){ return arr.reduce((a,b)=>a+b,0)/arr.length; }

// generic row for params dùng q mặc định
function explainBreakpointsRow(name, val, thresholds){
  if (val==null || isNaN(val)) return [name, 'Chưa nhập.'];
  const q=[100,75,50,25,10];
  if (val <= thresholds[0]) return [name, `\\( ${val} \\le ${thresholds[0]} \\Rightarrow \\text{WQI} = 100 \\)`];
  for (let i=1;i<thresholds.length;i++){
    const x0=thresholds[i-1], x1=thresholds[i];
    if (val <= x1){
      const y0=q[i-1], y1=q[i];
      const w = y0 + ((val-x0)/(x1-x0))*(y1-y0);
      return [name, `\\( ${x0} < ${val} \\le ${x1} \\Rightarrow \\text{WQI} \\approx ${fmt(w,1)} \\) (nội suy \\((${x0}\\to${y0}),(${x1}\\to${y1})\\))`];
    }
  }
  return [name, `\\( ${val} > ${thresholds[thresholds.length-1]} \\Rightarrow \\text{WQI} = 10 \\)`];
}

// diễn giải riêng cho NH4 theo mapping đã yêu cầu
function explainNH4(val){
  if (val==null || isNaN(val)) return ['N–NH₄', 'Chưa nhập.'];
  if (val < 0.3) return ['N–NH₄', `\\(${val}<0.3\\Rightarrow \\text{WQI}=100\\)`];
  if (val <= 0.6){
    const w = interp(val,0.3,0.6,75,50);
    return ['N–NH₄', `\\(0.3<${val}\\le0.6\\Rightarrow \\text{nội suy }(0.3\\to75),(0.6\\to50)\\Rightarrow \\text{WQI}\\approx ${fmt(w,1)}\\)`];
  }
  if (val <= 0.9){
    const w = interp(val,0.6,0.9,50,25);
    return ['N–NH₄', `\\(0.6<${val}\\le0.9\\Rightarrow \\text{nội suy }(0.6\\to50),(0.9\\to25)\\Rightarrow \\text{WQI}\\approx ${fmt(w,1)}\\)`];
  }
  if (val < 5.0){
    const w = interp(val,0.9,5.0,25,10);
    return ['N–NH₄', `\\(0.9<${val}<5.0\\Rightarrow \\text{nội suy }(0.9\\to25),(5.0\\to10)\\Rightarrow \\text{WQI}\\approx ${fmt(w,1)}\\)`];
  }
  return ['N–NH₄', `\\(${val}\\ge5.0\\Rightarrow \\text{WQI}=10\\)`];
}

function buildExplanation(ctx){
  const rows = [];
  // pH
  if (ctx.ph!=null && !isNaN(ctx.ph)){
    let desc = '';
    if (ctx.ph<5.5||ctx.ph>9) desc = `\\(\\text{pH}=${ctx.ph}\\notin[5.5,9]\\Rightarrow \\text{WQI}_{pH}=10\\)`;
    else if (ctx.ph<6) desc = `\\(5.5<${ctx.ph}\\le6\\Rightarrow \\text{nội suy }(5.5\\to50),(6\\to100)\\Rightarrow \\text{WQI}_{pH}\\approx ${fmt(ctx.wqi_pH,1)}\\)`;
    else if (ctx.ph<=8.5) desc = `\\(6\\le${ctx.ph}\\le8.5\\Rightarrow \\text{WQI}_{pH}=100\\)`;
    else desc = `\\(8.5<${ctx.ph}\\le9\\Rightarrow \\text{nội suy }(8.5\\to100),(9\\to50)\\Rightarrow \\text{WQI}_{pH}\\approx ${fmt(ctx.wqi_pH,1)}\\)`;
    rows.push(['pH', desc]);
  } else rows.push(['pH', 'Chưa nhập.']);

  // DO
  if (ctx.doRes){
    rows.push(['DO bão hòa',
      `\\(\\text{DO}_{sat}=14.652-0.41022T+0.0079910T^2-7.7774\\times10^{-5}T^3\\), với \\(T=${ctx.tempC}\\,^\\circ\\mathrm{C}\\Rightarrow \\text{DO}_{sat}\\approx ${fmt(ctx.doRes.DOsat,3)}\\,\\mathrm{mg/L}\\)`]);
    const Cp = ctx.doRes.DOpct;
    let rangeText = '';
    if (Cp < 20 || Cp > 200) rangeText = 'ngoài [20;200] ⇒ 10';
    else if (Cp < 50)        rangeText = '(20→25)–(50→50)';
    else if (Cp < 75)        rangeText = '(50→50)–(75→75)';
    else if (Cp < 88)        rangeText = '(75→75)–(88→100)';
    else if (Cp <=112)       rangeText = '[88;112] ⇒ 100';
    else if (Cp <=200)       rangeText = '(112→100)–(200→25)';
    rows.push(['DO%',
      `\\(\\text{DO}\\%=\\frac{${ctx.doMgL}}{${fmt(ctx.doRes.DOsat,3)}}\\times100\\approx ${fmt(Cp,1)}\\%\\). Nội suy theo ${rangeText} ⇒ \\(WQI_{DO}\\approx ${fmt(ctx.WQI_DO,1)}\\)`]);
  } else rows.push(['DO','Chưa đủ dữ liệu (cần DO mg/L và T °C).']);

  // IV
  const ivRows=[];
  ivRows.push(explainBreakpointsRow('BOD₅', ctx.BOD, BP.BOD));
  ivRows.push(explainBreakpointsRow('COD', ctx.COD, BP.COD));
  if (ctx.TOC!=null) ivRows.push(explainBreakpointsRow('TOC', ctx.TOC, BP.TOC));
  ivRows.push(explainNH4(ctx.NH4)); // NH4 riêng
  if (ctx.NO3!=null) ivRows.push(explainBreakpointsRow('N–NO₃', ctx.NO3, BP.NO3));
  if (ctx.NO2!=null) ivRows.push(['N–NO₂', `\\(${ctx.NO2} ${ctx.NO2<=BP.NO2_only?'\\le':'>'} ${BP.NO2_only}\\Rightarrow \\text{WQI}\\approx ${fmt(ctx.WQI_NO2,1)}\\)`]);
  ivRows.push(explainBreakpointsRow('P–PO₄', ctx.PO4, BP.PO4));
  if (ctx.TURB!=null) ivRows.push(explainBreakpointsRow('Độ đục (NTU)', ctx.TURB, BP.Turb));
  if (ctx.TSS!=null) ivRows.push(explainBreakpointsRow('TSS (mg/L)', ctx.TSS, BP.TSS));
  rows.push(...ivRows.filter(Boolean));

  // II pesticides
  function pest(name, val, lim){ if (val==null||isNaN(val)) return null;
    return [name, `\\(${val} ${val<=lim?'\\le':'>'} ${lim} \\Rightarrow \\text{WQI}=${val<=lim?100:10}\\)`]; }
  [['Aldrin',ctx.aldrin,BP.Aldrin],['BHC',ctx.bhc,BP.BHC],['Dieldrin',ctx.dieldrin,BP.Dieldrin],['Tổng DDTₛ',ctx.ddts,BP.DDTs],['Heptachlor & epoxide',ctx.hept,BP.Hept]]
    .forEach(([n,v,l])=>{ const r=pest(n,v,l); if(r) rows.push(r); });

  // III metals
  const metals=[['As',ctx.as,BP.As],['Cd',ctx.cd,BP.Cd],['Pb',ctx.pb,BP.Pb],['Cr⁶⁺',ctx.cr6,BP.Cr6],['Cu',ctx.cu,BP.Cu],['Zn',ctx.zn,BP.Zn],['Hg',ctx.hg,BP.Hg]];
  metals.forEach(([n,v,t])=>{ if(v!=null&&!isNaN(v)) rows.push(explainBreakpointsRow(n,v,t)); });

  // V
  if (ctx.coli!=null) rows.push(explainBreakpointsRow('Coliform (MPN/100mL)', ctx.coli, BP.Coli));
  if (ctx.ecoli!=null) rows.push(explainBreakpointsRow('E. coli (MPN/100mL)', ctx.ecoli, BP.Ecoli));

  // Aggregation + core (in ra phép tính)
  const fI = ctx.wqi_pH!=null? (ctx.wqi_pH/100) : 1;
  const gmII = ctx.presentII.length? gm(ctx.presentII) : 100;
  const gmIII= ctx.presentIII.length? gm(ctx.presentIII) : 100;
  const mIV  = ctx.presentIV.length? mean(ctx.presentIV): null;
  const mV   = ctx.presentV.length? mean(ctx.presentV) : null;

  const listIV = ctx.presentIV.map(v=>fmt(v,1)).join(' + ');
  if (mIV==null){
    rows.push(['Tổng hợp','Thiếu Nhóm IV ⇒ không thể công bố VN_WQI.']);
  }else{
    if (ctx.presentV.length){
      if (ctx.weighted){
        rows.push(['Tổng hợp',
          `\\(\\overline{IV}=\\frac{${listIV}}{${ctx.presentIV.length}}\\approx ${fmt(mIV,1)},\\; \\overline{V}\\approx ${fmt(mV,1)}\\Rightarrow
          \\text{core}=(\\overline{IV}^2\\cdot\\overline{V})^{1/3}\\approx ${fmt(Math.cbrt(mIV*mIV*mV),1)}\\)`]);
      }else{
        rows.push(['Tổng hợp',
          `\\(\\overline{IV}=\\frac{${listIV}}{${ctx.presentIV.length}}\\approx ${fmt(mIV,1)},\\; \\overline{V}\\approx ${fmt(mV,1)}\\Rightarrow
          \\text{core}=\\sqrt{\\overline{IV}\\cdot\\overline{V}}\\approx ${fmt(Math.sqrt(mIV*mV),1)}\\)`]);
      }
    }else{
      rows.push(['Tổng hợp',
        `\\(\\overline{IV}=\\frac{${listIV}}{${ctx.presentIV.length}}\\approx ${fmt(mIV,1)}\\Rightarrow \\text{core}=\\overline{IV}\\approx ${fmt(mIV,1)}\\)`]);
    }
  }

  rows.push(['Công thức cuối',
    mIV==null ? '—' :
    `\\(\\text{VN\\_WQI}=100\\times f_I \\times f_{II} \\times f_{III} \\times \\dfrac{\\text{core}}{100}\\) với \\(f_I=${fmt(fI,4)}\\), \\(f_{II}=${fmt(gmII/100,4)}\\), \\(f_{III}=${fmt(gmIII/100,4)}\\) ⇒ \\(\\approx ${ctx.aggWQI==null?'—':ctx.aggWQI}\\)`]);

  const html = `
    <table class="explain-table">
      <thead><tr><th>Mục</th><th>Diễn giải / Công thức</th></tr></thead>
      <tbody>
        ${rows.map(([k,v])=>`<tr><th>${k}</th><td>${v}</td></tr>`).join('')}
      </tbody>
    </table>`;
  return html;
}

/* ========= Form helpers ========= */
const FIELD_IDS=["ph","do","temp","bod","cod","toc","nh4","no3","no2","po4","turb","tss","coli","ecoli","as","cd","pb","cr6","cu","zn","hg","aldrin","bhc","dieldrin","ddts","hept","weighted"];

function readForm(){
  const data={};
  FIELD_IDS.forEach(id=>{
    if(id==="weighted"){ data[id] = $('weighted').checked ? 1 : 0; }
    else { const el=$(id); const v=el?el.value:""; data[id]= v===""? null : +v; }
  });
  return data;
}
function writeForm(data){
  FIELD_IDS.forEach(id=>{
    if(id==="weighted"){ $('weighted').checked = !!(data[id]); }
    else { const el=$(id); if(!el) return; el.value = (data[id]==null || data[id]==="") ? "" : data[id]; }
  });
}
function val(id){ const el=$(id); const v=parseFloat(el.value); return isNaN(v)?null:v; }

/* ========= Calculate & render ========= */
function calc(){
  const weighted = $('weighted').checked;

  const wqi_pH = wqiPH(val('ph'));
  const doRes = wqiDO(val('do'), val('temp')); const WQI_DO = doRes?doRes.WQI:null;
  const WQI_BOD = wqiGroupIV('BOD', val('bod'));
  const WQI_COD = wqiGroupIV('COD', val('cod'));
  const WQI_TOC = wqiGroupIV('TOC', val('toc'));
  const WQI_NH4 = wqiGroupIV('NH4', val('nh4'));
  const WQI_NO3 = wqiGroupIV('NO3', val('no3'));
  const WQI_NO2 = wqiGroupIV('NO2', val('no2'));
  const WQI_PO4 = wqiGroupIV('PO4', val('po4'));
  const WQI_TURB = wqiTurbidity(val('turb'));
  const WQI_TSS = wqiTSS(val('tss'));
  const WQI_Coli  = (val('coli')!=null)? wqiFromBreakpoints(val('coli'), BP.Coli) : null;
  const WQI_Ecoli = (val('ecoli')!=null)? wqiFromBreakpoints(val('ecoli'), BP.Ecoli) : null;
  const WQI_As = wqiMetal('As', val('as')); const WQI_Cd = wqiMetal('Cd', val('cd')); const WQI_Pb = wqiMetal('Pb', val('pb'));
  const WQI_Cr6= wqiMetal('Cr6', val('cr6')); const WQI_Cu = wqiMetal('Cu', val('cu')); const WQI_Zn = wqiMetal('Zn', val('zn')); const WQI_Hg = wqiMetal('Hg', val('hg'));
  const WQI_Ald = wqiPesticide('Aldrin', val('aldrin')); const WQI_BHC = wqiPesticide('BHC', val('bhc'));
  const WQI_Die = wqiPesticide('Dieldrin', val('dieldrin')); const WQI_DDT = wqiPesticide('DDTs', val('ddts')); const WQI_Hep = wqiPesticide('Hept', val('hept'));

  const presentIV = [WQI_DO,WQI_BOD,WQI_COD,WQI_TOC,WQI_NH4,WQI_NO3,WQI_NO2,WQI_PO4,WQI_TURB,WQI_TSS].filter(good);
  const presentV  = [WQI_Coli,WQI_Ecoli].filter(good);

  const agg = aggregateWQI({
    wqiI: wqi_pH,
    arrII: [WQI_Ald,WQI_BHC,WQI_Die,WQI_DDT,WQI_Hep],
    arrIII:[WQI_As,WQI_Cd,WQI_Pb,WQI_Cr6,WQI_Cu,WQI_Zn,WQI_Hg],
    arrIV: presentIV,
    arrV:  presentV,
    weighted
  });

  // Warnings
  const presentCount = [
    wqi_pH!=null,
    [WQI_Ald,WQI_BHC,WQI_Die,WQI_DDT,WQI_Hep].some(good),
    [WQI_As,WQI_Cd,WQI_Pb,WQI_Cr6,WQI_Cu,WQI_Zn,WQI_Hg].some(good),
    presentIV.length>0,
    presentV.length>0
  ].filter(Boolean).length;
  const warn=[];
  if (presentCount < 3) warn.push("Đang có < 3 nhóm thông số (yêu cầu ≥ 3).");
  if (!presentIV.length) warn.push("Thiếu toàn bộ Nhóm IV (bắt buộc).");
  if (presentIV.length < 3) warn.push("Nhóm IV hiện < 3 thông số (khuyến nghị ≥ 3).");
  $('warnings').classList.toggle('show', warn.length>0);
  $('warnings').innerHTML = warn.map(w=>`<div>⚠ ${w}</div>`).join("");

  // Output
  const score = agg.WQI; const cls = classify(score);
  $('score').textContent = score==null?"–":score;
  $('label').textContent = `Mức chất lượng: ${cls.label}`;
  $('score').style.color = cls.color; $('label').style.color = cls.color;
  const sticky = $('stickySummary'); sticky.textContent = `VN_WQI: ${score==null?"–":score} · ${cls.label}`; sticky.style.color = cls.color;

  // Details (bảng phụ)
  const rows=[]; const add=(k,v)=>rows.push(`<tr><td>${k}</td><td>${v==null?"–":(+v).toFixed(1)}</td></tr>`);
  rows.push(`<tr><th colspan="2">Nhóm I</th></tr>`); add("pH → WQI_pH", wqi_pH);
  rows.push(`<tr><th colspan="2">Nhóm II (GM)</th></tr>`); add("Aldrin",wqiPesticide('Aldrin',val('aldrin'))); add("BHC",wqiPesticide('BHC',val('bhc'))); add("Dieldrin",wqiPesticide('Dieldrin',val('dieldrin'))); add("DDTₛ",wqiPesticide('DDTs',val('ddts'))); add("Heptachlor",wqiPesticide('Hept',val('hept')));
  rows.push(`<tr><th colspan="2">Nhóm III (GM)</th></tr>`); add("As",WQI_As); add("Cd",WQI_Cd); add("Pb",WQI_Pb); add("Cr⁶⁺",WQI_Cr6); add("Cu",WQI_Cu); add("Zn",WQI_Zn); add("Hg",WQI_Hg);
  rows.push(`<tr><th colspan="2">Nhóm IV (TB)</th></tr>`);
  if (doRes) rows.push(`<tr><td>DO% bão hòa</td><td>${doRes.DOpct.toFixed(1)}% (DO_sat=${doRes.DOsat.toFixed(2)} mg/L)</td></tr>`);
  add("WQI_DO",WQI_DO); add("BOD₅",WQI_BOD); add("COD",WQI_COD); add("TOC",WQI_TOC); add("N–NH₄",WQI_NH4); add("N–NO₃",WQI_NO3); add("N–NO₂",WQI_NO2); add("P–PO₄",WQI_PO4); add("Độ đục (NTU)",WQI_TURB); add("TSS (mg/L)",WQI_TSS);
  rows.push(`<tr><th colspan="2">Nhóm V (TB)</th></tr>`); add("Coliform",WQI_Coli); add("E. coli",WQI_Ecoli);
  // tổng hợp IV/V/core để kiểm tra
  rows.push(`<tr><th colspan="2">Kiểm tra core</th></tr>`);
  rows.push(`<tr><td>TB Nhóm IV</td><td>${agg.IV==null?'–':agg.IV.toFixed(1)}</td></tr>`);
  rows.push(`<tr><td>TB Nhóm V</td><td>${agg.V==null?'–':agg.V.toFixed(1)}</td></tr>`);
  rows.push(`<tr><td>core</td><td>${agg.core==null?'–':agg.core.toFixed(1)}</td></tr>`);
  $('detail').innerHTML = `<table><thead><tr><th>Thông số</th><th>WQI</th></tr></thead><tbody>${rows.join("")}</tbody></table>`;

  // Explain table with LaTeX
  const presentII = [wqiPesticide('Aldrin',val('aldrin')),wqiPesticide('BHC',val('bhc')),wqiPesticide('Dieldrin',val('dieldrin')),wqiPesticide('DDTs',val('ddts')),wqiPesticide('Hept',val('hept'))].filter(good);
  const presentIII= [WQI_As,WQI_Cd,WQI_Pb,WQI_Cr6,WQI_Cu,WQI_Zn,WQI_Hg].filter(good);

  const explanationHTML = buildExplanation({
    ph: val('ph'), wqi_pH,
    doMgL: val('do'), tempC: val('temp'), doRes, WQI_DO,
    BOD:val('bod'), COD:val('cod'), TOC:val('toc'), NH4:val('nh4'), NO3:val('no3'), NO2:val('no2'), PO4:val('po4'),
    TURB:val('turb'), TSS:val('tss'),
    WQI_NO2,
    aldrin:val('aldrin'), bhc:val('bhc'), dieldrin:val('dieldrin'), ddts:val('ddts'), hept:val('hept'),
    as:val('as'), cd:val('cd'), pb:val('pb'), cr6:val('cr6'), cu:val('cu'), zn:val('zn'), hg:val('hg'),
    coli:val('coli'), ecoli:val('ecoli'),
    presentII, presentIII, presentIV, presentV, weighted,
    aggWQI: score
  });
  $('explain').innerHTML = explanationHTML;
  if (window.MathJax && window.MathJax.typesetPromise) MathJax.typesetPromise();

  toast(score==null ? "Thiếu dữ liệu Nhóm IV" : "Đã tính xong VN_WQI");
}

/* ========= Wire events ========= */
$('calc').addEventListener('click', calc);
$('clear').addEventListener('click', ()=>{
  document.querySelectorAll('input[type="number"]').forEach(i=>i.value="");
  $('weighted').checked=false; $('warnings').classList.remove('show'); $('warnings').innerHTML="";
  $('score').textContent="–"; $('label').textContent="Mức chất lượng: –";
  $('score').style.color='#e8eef7'; $('label').style.color='#e8eef7';
  $('detail').innerHTML="";
  $('explain').innerHTML='Nhập số liệu và bấm “Tính VN_WQI”…';
  const sticky=$('stickySummary'); sticky.textContent="VN_WQI: – · Mức: –"; sticky.style.color='#b9c8de';
  toast("Đã xóa số liệu");
});
document.addEventListener('keydown', (e)=>{ if (e.key==='Enter' && (e.metaKey||e.ctrlKey)) calc(); });

/* ========= Save / Load ========= */
const KEY='vnwqi:datasets';
function loadAll(){ try{ return JSON.parse(localStorage.getItem(KEY)||"{}"); }catch{return{}} }
function saveAll(obj){ localStorage.setItem(KEY, JSON.stringify(obj)); }
function refreshSavedList(){
  const all=loadAll(); const sel=$('savedList'); sel.innerHTML="";
  const opt=(v,t)=>{const o=document.createElement('option'); o.value=v; o.textContent=t; return o;};
  sel.appendChild(opt("","— Bộ đã lưu —"));
  Object.keys(all).sort().forEach(name=> sel.appendChild(opt(name,name)));
}
function saveCurrent(){
  const name=$('datasetName').value.trim();
  if(!name){ toast("Hãy nhập tên bộ số liệu trước khi lưu"); return; }
  const all=loadAll(); all[name]={ data:readForm(), savedAt:new Date().toISOString() }; saveAll(all);
  refreshSavedList(); $('savedList').value=name; toast("Đã lưu bộ số liệu: "+name);
}
function restoreSelected(){
  const name=$('savedList').value; if(!name){ toast("Chưa chọn bộ để khôi phục"); return; }
  const all=loadAll(); if(!all[name]){ toast("Không tìm thấy bộ đã lưu"); return; }
  writeForm(all[name].data); toast("Đã khôi phục: "+name);
}
function deleteSelected(){
  const name=$('savedList').value; if(!name){ toast("Chưa chọn bộ để xóa"); return; }
  const all=loadAll(); delete all[name]; saveAll(all); refreshSavedList(); $('savedList').value="";
  toast("Đã xóa: "+name);
}
$('saveBtn').addEventListener('click', saveCurrent);
$('loadBtn').addEventListener('click', restoreSelected);
$('deleteBtn').addEventListener('click', deleteSelected);
window.addEventListener('load', refreshSavedList);

/* ========= Export CSV / PDF ========= */
function exportCSV(){
  const data=readForm();
  const rows=[["parameter","value"]];
  Object.entries(data).forEach(([k,v])=> rows.push([k, v==null?"":v]));
  const csv=rows.map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  const name=$('datasetName').value.trim() || "vnwqi_dataset"; a.download=`${name}.csv`; a.click(); URL.revokeObjectURL(a.href);
}
$('exportCsvBtn').addEventListener('click', exportCSV);
$('exportPdfBtn').addEventListener('click', ()=>window.print());

/* ========= Mobile bottom-sheet toggle ========= */
const panel=$('resultPanel'), toggle=$('toggleSheet');
function applySheetMode(){
  const isMobile = window.matchMedia('(max-width: 860px)').matches;
  panel.classList.toggle('min', isMobile);
  toggle.textContent = isMobile ? 'Mở rộng' : 'Thu gọn';
}
applySheetMode(); window.addEventListener('resize', applySheetMode);
toggle.addEventListener('click', ()=>{ const isMin=panel.classList.toggle('min'); toggle.textContent=isMin?'Mở rộng':'Thu gọn'; });

/* ========= PWA ========= */
if ('serviceWorker' in navigator){
  window.addEventListener('load', ()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}
