from pathlib import Path

path = Path('admin.html')
s = path.read_text(encoding='utf-8')

# Idempotent: if the feature is already present, do nothing.
if 'function allocationConflictMessage(' in s and "· Reallocation mode" in s:
    print('Reallocation/conflict protection already present.')
    raise SystemExit(0)

old_open = "function openAllocation(id){allocationId=id;$('allocationFor').textContent='Registration: '+id;$('allocationMsg').textContent='';$('adminNotes').value='';$('modal').classList.remove('hidden')}"
new_open = """function openAllocation(id){allocationId=id;const r=registrations.find(x=>String(x['Registration ID']||'').trim()===String(id).trim());$('allocationFor').textContent='Registration: '+id+(r&&String(r['Allocation Status']||'').trim()==='Assigned'?' · Reallocation mode':' · New allocation');$('allocationMsg').textContent='';$('allocationMsg').className='msg';$('adminNotes').value=r?(r['Admin Notes']||''):'';$('allocCommittee').value=r&&r['Allocated Committee']?r['Allocated Committee']:$('allocCommittee').value;syncAllocationFields();if(r&&r['Allocated Country'])$('allocCountry').value=r['Allocated Country'];if(r&&r['Allocated Personality'])$('allocPersonality').value=r['Allocated Personality'];$('modal').classList.remove('hidden')}"""
if old_open not in s:
    raise SystemExit('openAllocation pattern not found; admin.html was not changed.')
s = s.replace(old_open, new_open, 1)

old_save = "$('saveAllocation').onclick=async()=>{const b=$('saveAllocation');b.disabled=true;try{await api('adminAllocate',{registrationId:allocationId,committee:$('allocCommittee').value,country:$('allocCountry').value,personality:$('allocPersonality').value,adminNotes:$('adminNotes').value});$('modal').classList.add('hidden');toast('Allocation saved and email sent');await loadData()}catch(err){$('allocationMsg').className='msg error';$('allocationMsg').textContent=err.message}finally{b.disabled=false}};"
new_save = """function syncAllocationFields(){const c=$('allocCommittee').value;const isPna=c==='PNA — Pakistan National Assembly';$('allocCountry').disabled=isPna;$('allocPersonality').disabled=!isPna;if(isPna)$('allocCountry').value='';else $('allocPersonality').value='';}
function allocationConflictMessage(committee,country,personality){const currentId=String(allocationId||'').trim();const sameCommittee=registrations.filter(r=>String(r['Allocation Status']||'').trim()==='Assigned'&&String(r['Registration ID']||'').trim()!==currentId&&String(r['Allocated Committee']||'').trim()===committee);if(committee==='PNA — Pakistan National Assembly'){if(!personality)return 'Select a PNA personality.';const hit=sameCommittee.find(r=>String(r['Allocated Personality']||'').trim().toLowerCase()===personality.trim().toLowerCase());return hit?'Conflict: '+personality+' is already assigned to '+(hit['Registration ID']||'another delegate')+'.':'';}if(!country)return 'Select a country.';const hit=sameCommittee.find(r=>String(r['Allocated Country']||'').trim().toLowerCase()===country.trim().toLowerCase());return hit?'Conflict: '+country+' is already assigned in this committee to '+(hit['Registration ID']||'another delegate')+'.':'';}
$('allocCommittee').addEventListener('change',syncAllocationFields);syncAllocationFields();
$('saveAllocation').onclick=async()=>{const b=$('saveAllocation');const committee=$('allocCommittee').value;const country=$('allocCountry').value;const personality=$('allocPersonality').value;const conflict=allocationConflictMessage(committee,country,personality);if(conflict){$('allocationMsg').className='msg error';$('allocationMsg').textContent=conflict;b.disabled=false;return}b.disabled=true;try{await api('adminAllocate',{registrationId:allocationId,committee,country,personality,adminNotes:$('adminNotes').value});$('modal').classList.add('hidden');toast('Allocation saved and matrix synchronized');await loadData()}catch(err){$('allocationMsg').className='msg error';$('allocationMsg').textContent=err.message}finally{b.disabled=false}};"""
if old_save not in s:
    raise SystemExit('saveAllocation pattern not found; admin.html was not changed.')
s = s.replace(old_save, new_save, 1)

path.write_text(s, encoding='utf-8')
print('Patched admin.html successfully.')
