(()=>{
  'use strict';

  const revImages={};
  function preloadRevAssets(){
    const cfg=window.EVENT_CONFIG||{};
    const list=[cfg.capture?.truckAsset,...Object.values(cfg.capture?.truckAssets||{}),...(cfg.capture?.fuel||[]).map(x=>x.src),...(cfg.capture?.nonFuel||[]).map(x=>x.src)];
    [...new Set(list.filter(Boolean))].forEach(src=>{const im=new Image();im.src=src;revImages[src]=im;});
  }

  function hardenLogin(){
    const form=document.getElementById('loginForm');
    if(!form||form.dataset.rev5Login==='1') return;
    form.dataset.rev5Login='1';
    const submit=(event)=>{
      event?.preventDefault();event?.stopPropagation();event?.stopImmediatePropagation?.();
      const cfg=window.EVENT_CONFIG||{};
      const user=(document.getElementById('loginUser')?.value||'').trim().toLowerCase();
      const pin=(document.getElementById('loginPin')?.value||'').trim();
      if(user===String(cfg.auth?.user||'').trim().toLowerCase()&&pin===String(cfg.auth?.pin||'').trim()){
        sessionStorage.setItem('pertaminaBoothAuth','1');
        const err=document.getElementById('loginError');if(err)err.textContent='';
        if(typeof showApp==='function')showApp();
        return false;
      }
      const err=document.getElementById('loginError');if(err)err.textContent='User atau PIN tidak sesuai.';
      const pinEl=document.getElementById('loginPin');if(pinEl){pinEl.value='';pinEl.focus();}
      return false;
    };
    form.setAttribute('action','javascript:void(0)');form.onsubmit=submit;form.addEventListener('submit',submit,true);
  }

  function installWordSearchRules(){
    if(typeof buildWordSearch!=='function'||typeof pathBetween!=='function')return;

    buildWordSearch=function(){
      const size=CFG.wordSearch?.size||12;
      const board=Array.from({length:size},()=>Array(size).fill(''));
      const dirs=[[0,1],[1,0]]; // ONLY left→right and top→bottom
      const pool=shuffle(getWordBank()).sort((a,b)=>b.length-a.length);
      const max=CFG.wordSearch?.maxWords||6;
      const placements=[];
      for(const text of pool){
        if(placements.length>=max)break;
        let placed=null;
        for(let attempt=0;attempt<420&&!placed;attempt++){
          const [dr,dc]=dirs[Math.floor(Math.random()*dirs.length)];
          const maxR=dr===1?size-text.length:size-1;
          const maxC=dc===1?size-text.length:size-1;
          if(maxR<0||maxC<0)continue;
          const r=Math.floor(Math.random()*(maxR+1));
          const c=Math.floor(Math.random()*(maxC+1));
          let ok=true;
          for(let i=0;i<text.length;i++){
            const ch=board[r+dr*i][c+dc*i];
            if(ch&&ch!==text[i]){ok=false;break;}
          }
          if(!ok)continue;
          const cells=[];
          for(let i=0;i<text.length;i++){
            const rr=r+dr*i,cc=c+dc*i;
            board[rr][cc]=text[i];cells.push(rr*size+cc);
          }
          placed={word:text,cells,direction:dr===0?'H':'V'};
        }
        if(placed)placements.push(placed);
      }
      const letters='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      for(let r=0;r<size;r++)for(let c=0;c<size;c++)if(!board[r][c])board[r][c]=letters[Math.floor(Math.random()*letters.length)];
      return{size,grid:board.flat(),placements};
    };

    // Selection is also one-way: only left→right or top→bottom.
    pathBetween=function(a,b){
      if(a==null||b==null)return[];
      const ar=Math.floor(a/word.size),ac=a%word.size,br=Math.floor(b/word.size),bc=b%word.size;
      const rd=br-ar,cd=bc-ac;
      const isHorizontal=rd===0&&cd>=0;
      const isVertical=cd===0&&rd>=0;
      if(!isHorizontal&&!isVertical)return[];
      const steps=Math.max(rd,cd),out=[];
      for(let i=0;i<=steps;i++)out.push(isHorizontal?ar*word.size+(ac+i):(ar+i)*word.size+ac);
      return out;
    };

    checkWordSelection=function(path){
      if(!word.running||!path.length)return;
      const text=path.map(i=>word.grid[i]).join('');
      const hit=word.placements.find(p=>!word.found.has(p.word)&&sameCells(path,p.cells)&&text===p.word);
      if(!hit){$('wordFeedback').textContent=`\"${text}\" belum cocok. Cari dari kiri ke kanan atau dari atas ke bawah.`;return;}
      word.found.add(hit.word);
      hit.cells.forEach(i=>document.querySelector(`.word-cell[data-index=\"${i}\"]`)?.classList.add('found'));
      document.querySelector(`[data-word=\"${hit.word}\"]`)?.classList.add('found');
      word.score+=100+Math.max(0,Math.round(word.time/6));
      $('wordScore').textContent=word.score;$('wordFound').textContent=word.found.size;$('wordFeedback').textContent=`${hit.word} ditemukan!`;
      if(word.found.size===word.targets.length)finishWordSearch(true);
    };
  }

  function installCaptureRenderer(){
    if(typeof drawGameObject!=='function'||typeof drawTruck!=='function'||typeof collectCapture!=='function')return;

    spawnWave=function(){
      const fuel=CFG.capture.fuel||[],bad=CFG.capture.nonFuel||[];if(!fuel.length&&!bad.length)return;
      const p=captureProgress(),lane=Math.floor(Math.random()*3),isBad=bad.length>0&&(!fuel.length||Math.random()<(CFG.capture.nonFuelChance??.34));
      const pool=isBad?bad:fuel,item=pool[Math.floor(Math.random()*pool.length)];if(!item)return;
      capture.objects.push({lane,y:-.10,item,bad:isBad,rot:0});
    };

    drawGameObject=function(ctx,o,road){
      const progress=captureProgress(),eased=progress*progress*(3-2*progress);
      o.y+=(CFG.capture.speedStart+(CFG.capture.speedEnd-CFG.capture.speedStart)*eased)*(capture.frameScale||1);
      const t=Math.max(0,Math.min(1,o.y)),x=laneX(road,o.lane,t),y=o.y*capture.h,im=revImages[o.item.src];
      const laneW=laneWidthAt(road,t),maxW=laneW*.58,maxH=42+42*t;
      let w=Math.min(maxW,72+30*t),h=Math.min(maxH,68+24*t);
      if(im?.naturalWidth){const ratio=im.naturalWidth/im.naturalHeight;w=Math.min(maxW,maxH*ratio);h=w/ratio;}
      ctx.save();ctx.translate(x,y);ctx.rotate(o.rot);
      ctx.shadowColor=o.bad?'rgba(214,25,31,.48)':'rgba(0,112,186,.34)';ctx.shadowBlur=12+10*t;
      if(im?.complete&&im.naturalWidth)ctx.drawImage(im,-w/2,-h/2,w,h);
      else{ctx.fillStyle=o.bad?'#D6191F':'#0070BA';ctx.beginPath();ctx.arc(0,0,Math.min(w,h)*.34,0,Math.PI*2);ctx.fill();}
      ctx.restore();return{x,y,w,h};
    };

    drawTruck=function(ctx,road){
      const dt=capture.frameScale||1;capture.truckLane+=(capture.targetLane-capture.truckLane)*(1-Math.pow(.905,dt));
      const assets=CFG.capture.truckAssets,src=capture.truckLane<.66?assets.left:capture.truckLane>1.34?assets.right:assets.center;
      const im=revImages[src]||imageCache[src],x=laneX(road,capture.truckLane,.93),laneW=laneWidthAt(road,.93);
      const ratio=im?.naturalWidth?im.naturalHeight/im.naturalWidth:2.2;
      // Use a shared vehicle height; sprite widths differ because of camera perspective.
      const ratios=Object.values(assets).map(key=>{const img=revImages[key]||imageCache[key];return img?.naturalWidth?img.naturalHeight/img.naturalWidth:2.2});
      const truckH=Math.min(capture.h*.26,laneW*.85*Math.min(...ratios),280),truckW=truckH/ratio;
      const now=performance.now(),motion=matchMedia('(prefers-reduced-motion: reduce)').matches?0:1;
      const vx=(Math.sin(now*.038)*.85+Math.sin(now*.071)*.35)*motion,vy=(Math.sin(now*.052)*1.5+Math.sin(now*.093)*.5)*motion;
      const y=capture.h-truckH/2-16;
      ctx.save();ctx.translate(x+vx,y+vy);ctx.rotate(Math.sin(now*.044)*.003*motion);ctx.shadowColor='rgba(0,0,0,.7)';ctx.shadowBlur=20;
      if(im?.complete&&im.naturalWidth)ctx.drawImage(im,-truckW/2,-truckH/2,truckW,truckH);
      ctx.restore();return{x,y,w:truckW,h:truckH,lane:capture.truckLane};
    };

    window.showCaptureFx=function(o,delta){
      const stage=$('captureStage'),fx=document.createElement('div');
      fx.className=`capture-score-fx ${o.bad?'bad':'good'}`;
      const value=document.createElement('b'),label=document.createElement('span');
      value.textContent=(delta<0?'−':'+')+Math.abs(delta);
      label.textContent=o.bad?'ENERGI BERKURANG • HINDARI NON-FUEL':'ENERGY BOOST • '+o.item.label;
      fx.append(value,label);stage.appendChild(fx);
      const burst=document.createElement('div');burst.className=`energy-burst ${o.bad?'bad':'good'}`;
      for(let i=0;i<12;i++){const particle=document.createElement('i');particle.style.setProperty('--angle',i*30+'deg');burst.appendChild(particle)}
      stage.appendChild(burst);setTimeout(()=>{fx.remove();burst.remove()},1200);
    };

    collectCapture=function(o){
      const before=capture.score,points=Number(o.item.points)||0;
      if(o.bad){capture.score=Math.max(0,capture.score+points);capture.combo=1;navigator.vibrate?.([45,30,45])}
      else{capture.score+=Math.round(points*Math.max(1,capture.combo));capture.combo=Math.min(7,capture.combo+.45);navigator.vibrate?.(22)}
      recordCapturePoints(capture.score-before);updateCaptureHud();showCaptureFx(o,capture.score-before);
      const flash=$('hitFlash');flash.className=`hit-flash ${o.bad?'bad':'good'}`;
      const hud=$('captureScoreFocus');hud.classList.remove('score-pop');void hud.offsetWidth;hud.classList.add('score-pop');
      clearTimeout(capture.flashTimer);capture.flashTimer=setTimeout(()=>flash.className='hit-flash',450);
    };
  }

  function refreshCopy(){
    const instruction=document.querySelector('.word-instruction');
    if(instruction)instruction.textContent='TEKA-TEKI SILANG HURUF — cari kata hanya dari kiri ke kanan atau dari atas ke bawah. Touch / click lalu drag.';

    const captureText=document.querySelector('#cameraPrompt p');if(captureText)captureText.textContent='Gerakkan kepala untuk mengarahkan truk. Tangkap logo fuel untuk menambah skor dan hindari non-fuel. Saat mulai, track otomatis fullscreen.';
    const captureTitle=document.querySelector('#cameraPrompt h3');if(captureTitle)captureTitle.innerHTML='DRIVE THE TRUCK.<br><em>CAPTURE THE ENERGY.</em>';
  }

  function install(){hardenLogin();preloadRevAssets();installWordSearchRules();installCaptureRenderer();refreshCopy();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  setTimeout(install,250);setTimeout(install,1000);
})();
