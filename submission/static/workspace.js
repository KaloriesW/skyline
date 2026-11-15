/* Shared local Qwen panel for the dashboard and satellite map. */
window.WorkspaceQwen={mount:function(adapter){
  const panel=document.createElement('section');panel.id='workspace-qwen';panel.hidden=true;
  panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Qwen workspace assistant');
  panel.innerHTML='<div class="wq-head"><button type="button" data-wq-close>← Back to workspace</button><a href="/skyline/#home">Home ↗</a></div><p class="wq-kicker">LOCAL INTELLIGENCE</p><h2>Ask Skyline</h2><p>One conversation for satellite scans, weather, air quality, model results and monitoring.</p><p data-wq-context></p><div class="wq-suggestions"><button type="button">What should I review in this scan?</button><button type="button">How good is the PM2.5 model?</button><button type="button">What is the weather outlook?</button><button type="button">Is monitoring running?</button></div><div data-wq-log role="log" aria-live="polite"></div><form><label for="wq-question">Your question</label><textarea id="wq-question" rows="3" required maxlength="1500" placeholder="Ask about any information in this workspace…"></textarea><button type="submit">Ask Qwen →</button></form><p data-wq-status role="status"></p><a href="/?assistant=1">Prepare a satellite scan →</a>';
  document.body.appendChild(panel);
  let messages=[],scope='',busy=false,lastFocus=null;
  const find=s=>panel.querySelector(s);
  function close(){panel.hidden=true;lastFocus?.focus();}
  function sync(){const c=adapter.context(),key=JSON.stringify([c.lat,c.lon,c.scan_id]);if(key!==scope){scope=key;messages=[];find('[data-wq-log]').replaceChildren();}find('[data-wq-context]').textContent=(c.location_name||'Selected location')+' · '+(c.scan_id?'saved scan included':'no scan selected')+' · live data refreshed when asking';return c;}
  function bubble(role,text){const el=document.createElement('article'),label=document.createElement('strong'),p=document.createElement('p');el.className='wq-'+role;label.textContent=role==='user'?'You':'Qwen';p.textContent=text;el.append(label,p);find('[data-wq-log]').append(el);el.scrollIntoView({block:'nearest'});}
  function open(question){lastFocus=document.activeElement;panel.hidden=false;sync();if(question)find('textarea').value=question;find('textarea').focus();}
  find('[data-wq-close]').onclick=close;
  panel.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  panel.querySelectorAll('.wq-suggestions button').forEach(b=>b.onclick=()=>{find('textarea').value=b.textContent;find('textarea').focus();});
  find('form').onsubmit=async e=>{
    e.preventDefault();if(busy)return;const question=find('textarea').value.trim();if(!question)return;
    const context=sync(),requestScope=scope;busy=true;find('button[type=submit]').disabled=true;find('textarea').disabled=true;find('[data-wq-status]').textContent='Reading current data and asking local Qwen…';
    try{const response=await fetch('/api/assistant/workspace/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...context,message:question,history:messages.slice(-8)})}),r=await response.json();if(!response.ok)throw Error(typeof r.detail==='string'?r.detail:'Unable to answer this question. Please retry.');
      if(requestScope!==scope)return;
      messages.push({role:'user',content:question},{role:'assistant',content:r.answer});bubble('user',question);bubble('assistant',r.answer);find('textarea').value='';find('[data-wq-status]').textContent='Answered locally · '+r.model+' · '+new Date(r.context_time).toLocaleTimeString()+' · '+r.sources.join(', ');
    }catch(error){find('[data-wq-status]').textContent=error.message+' Your question is kept for retry.';}
    finally{busy=false;find('button[type=submit]').disabled=false;find('textarea').disabled=false;}
  };
  document.addEventListener('click',e=>{const button=e.target.closest('[data-workspace-qwen]');if(button){e.preventDefault();open(button.dataset.question||'');}});
  return {open:open,close:close};
}};
