/* Shared local Qwen panel for the dashboard and satellite map. */
// Resolve only real candidates from the scan that supplied this answer.
function referencedReviewAreas(text,features){
  const ids=[...String(text).matchAll(/\bArea\s+(\d+)\b/gi)].map(m=>Number(m[1]));
  return [...new Set(ids)].map(id=>features.find(f=>Number(f.properties.id)===id)).filter(Boolean);
}
if(typeof module==='object')module.exports={referencedReviewAreas};
if(typeof window!=='undefined')window.WorkspaceQwen={mount:function(adapter){
  const panel=document.createElement('section');panel.id='workspace-qwen';panel.hidden=true;
  panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Qwen workspace assistant');
  panel.innerHTML='<div class="wq-head"><button type="button" data-wq-close>← Back to workspace</button><a href="/skyline/#home">Home ↗</a></div><p class="wq-kicker">LOCAL INTELLIGENCE</p><h2>Ask Skyline</h2><p>One conversation for satellite scans, weather, air quality, model results and monitoring.</p><p data-wq-context></p><div class="wq-suggestions"><button type="button">What should I review in this scan?</button><button type="button">How good is the PM2.5 model?</button><button type="button">What is the weather outlook?</button><button type="button">Is monitoring running?</button></div><div data-wq-log role="log" aria-live="polite"></div><form><label for="wq-question">Your question</label><textarea id="wq-question" rows="3" required maxlength="1500" placeholder="Ask about any information in this workspace…"></textarea><button type="submit">Ask Qwen →</button></form><p data-wq-status role="status"></p><a href="/?assistant=1">Prepare a satellite scan →</a>';
  document.body.appendChild(panel);
  let messages=[],scope='',busy=false,lastFocus=null;
  const find=s=>panel.querySelector(s);
  function close(){panel.hidden=true;lastFocus?.focus();}
  function sync(){const c=adapter.context(),key=JSON.stringify([c.lat,c.lon,c.scan_id]);if(key!==scope){scope=key;messages=[];find('[data-wq-log]').replaceChildren();}find('[data-wq-context]').textContent=(c.location_name||'Selected location')+' · '+(c.scan_id?'saved scan included':'no scan selected')+' · live data refreshed when asking';return c;}
  function bubble(role,text,source){const el=document.createElement('article'),label=document.createElement('strong'),p=document.createElement('p');el.className='wq-'+role;label.textContent=role==='user'?'You':(['Measured scan evidence','Monitoring controls'].includes(source)?source:'Qwen');p.textContent=text;el.append(label,p);if(role==='assistant'&&adapter.reviewAreas&&adapter.viewArea){
      const scanId=adapter.context().scan_id,actions=document.createElement('div');actions.className='wq-area-actions';
      for(const feature of referencedReviewAreas(text,adapter.reviewAreas())){
        const area=feature.properties,button=document.createElement('button');button.type='button';
        button.textContent=`View Area ${area.id} ↗`;
        button.title=`Close-up at ${Number(area.latitude).toFixed(6)}, ${Number(area.longitude).toFixed(6)}`;
        button.onclick=()=>{
          if(adapter.context().scan_id!==scanId){find('[data-wq-status]').textContent='This answer belongs to a different scan. Ask about the displayed scan.';return;}
          close();adapter.viewArea(area.id,scanId);
        };actions.append(button);
      }
      if(actions.childElementCount){const hint=document.createElement('p');hint.className='wq-area-hint';hint.textContent='Open a close-up with coordinates and evidence. Reopen Ask Qwen to return to this conversation.';el.append(actions,hint);}
    }
    find('[data-wq-log]').append(el);el.scrollIntoView({block:'nearest'});}
  function open(question){lastFocus=document.activeElement;panel.hidden=false;sync();if(question)find('textarea').value=question;find('textarea').focus();}
  find('[data-wq-close]').onclick=close;
  panel.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  panel.querySelectorAll('.wq-suggestions button').forEach(b=>b.onclick=()=>{find('textarea').value=b.textContent;find('textarea').focus();});
  find('form').onsubmit=async e=>{
    e.preventDefault();if(busy)return;const question=find('textarea').value.trim();if(!question)return;
    const context=sync(),requestScope=scope;busy=true;find('button[type=submit]').disabled=true;find('textarea').disabled=true;find('[data-wq-status]').textContent='Reading current data…';
    try{const response=await fetch('/api/assistant/workspace/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...context,message:question,history:messages.slice(-8)})}),r=await response.json();if(!response.ok)throw Error(typeof r.detail==='string'?r.detail:'Unable to answer this question. Please retry.');
      const latest=adapter.context();if(requestScope!==scope||JSON.stringify([latest.lat,latest.lon,latest.scan_id])!==requestScope){sync();find('[data-wq-status]').textContent='The selected scan changed. Ask again about the displayed scan.';return;}
      messages.push({role:'user',content:question},{role:'assistant',content:r.answer});bubble('user',question);bubble('assistant',r.answer,r.model);find('textarea').value='';find('[data-wq-status]').textContent='Answered locally · '+r.model+' · '+new Date(r.context_time).toLocaleTimeString()+' · '+r.sources.join(', ');
    }catch(error){find('[data-wq-status]').textContent=error.message+' Your question is kept for retry.';}
    finally{busy=false;find('button[type=submit]').disabled=false;find('textarea').disabled=false;}
  };
  document.addEventListener('click',e=>{const button=e.target.closest('[data-workspace-qwen]');if(button){e.preventDefault();open(button.dataset.question||'');}});
  return {open:open,close:close};
}};
