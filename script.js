const REGISTRATION_ENDPOINT='https://script.google.com/macros/s/AKfycbyf5pTjZbGK-56lapceNs9pNioR4tMFJMj0CqCzMjDtpx4wJK1_jwkQrukUmppnDY5k/exec';

const form=document.getElementById('registrationForm');
const fileInput=document.getElementById('paymentProof');
const dropzone=document.getElementById('dropzone');
const fileName=document.getElementById('fileName');
const message=document.getElementById('formMessage');
const committeeSelect=document.getElementById('committeeSelect');
const personalityField=document.getElementById('personalityField');
const personalityPreference=document.getElementById('personalityPreference');
const toast=document.getElementById('toast');

function showFile(){
  const f=fileInput.files[0];
  fileName.textContent=f?`Selected: ${f.name}`:'';
}

fileInput.addEventListener('change',showFile);

committeeSelect.addEventListener('change',()=>{
  const isPNA=committeeSelect.value==='PNA — Pakistan National Assembly';
  personalityField.style.display=isPNA?'block':'none';
  personalityPreference.required=isPNA;
  if(!isPNA) personalityPreference.value='';
});

['dragenter','dragover'].forEach(e=>dropzone.addEventListener(e,x=>x.preventDefault()));
['dragleave','drop'].forEach(e=>dropzone.addEventListener(e,x=>x.preventDefault()));

dropzone.addEventListener('drop',e=>{
  const f=e.dataTransfer.files;
  if(f.length){
    fileInput.files=f;
    showFile();
  }
});

dropzone.addEventListener('keydown',e=>{
  if(e.key==='Enter'||e.key===' '){
    e.preventDefault();
    fileInput.click();
  }
});

function toDataURL(file){
  return new Promise((res,rej)=>{
    const r=new FileReader();
    r.onload=()=>res(r.result);
    r.onerror=rej;
    r.readAsDataURL(file);
  });
}

form.addEventListener('submit',async e=>{
  e.preventDefault();
  message.className='form-message';
  message.textContent='';
  if(!form.checkValidity()){
    form.reportValidity();
    return;
  }
  const f=fileInput.files[0];
  if(!f||f.size>4*1024*1024){
    message.className='form-message error';
    message.textContent='Please upload a payment screenshot smaller than 4 MB.';
    return;
  }
  const b=form.querySelector('.submit');
  b.disabled=true;
  b.textContent='Submitting…';
  try{
    const r=await fetch(REGISTRATION_ENDPOINT,{
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify({
        fullName:form.fullName.value.trim(),
        email:form.email.value.trim(),
        phone:form.phone.value.trim(),
        location:form.location.value.trim(),
        committee:form.committee.value,
        countryPreference:form.countryPreference.value,
        personalityPreference:form.personalityPreference.value||'',
        paymentFileName:f.name,
        paymentScreenshot:await toDataURL(f)
      })
    });
    const d=await r.json();
    if(!d.ok) throw Error(d.error||'failed');
    message.className='form-message success';
    message.textContent=`Registration successful! Your ID is ${d.registrationId}. Keep your payment receipt.`;
    form.reset();
    fileName.textContent='';
    personalityField.style.display='none';
    personalityPreference.required=false;
  }catch(err){
    message.className='form-message error';
    message.textContent='Registration could not be submitted. Please try again.';
  }finally{
    b.disabled=false;
    b.innerHTML='Submit registration <span>↗</span>';
  }
});

/* Conference countdown: 26 August 2026, 00:00 Pakistan time. */
function updateCountdown(){
  const target=new Date('2026-08-26T00:00:00+05:00').getTime();
  const diff=target-Date.now();
  const ids=['days','hours','minutes','seconds'];
  if(diff<=0){
    document.getElementById('days').textContent='00';
    document.getElementById('hours').textContent='00';
    document.getElementById('minutes').textContent='00';
    document.getElementById('seconds').textContent='00';
    return;
  }
  const days=Math.floor(diff/86400000);
  const hours=Math.floor((diff%86400000)/3600000);
  const minutes=Math.floor((diff%3600000)/60000);
  const seconds=Math.floor((diff%60000)/1000);
  [days,hours,minutes,seconds].forEach((value,i)=>{
    document.getElementById(ids[i]).textContent=String(value).padStart(2,'0');
  });
}
updateCountdown();
setInterval(updateCountdown,1000);

/* Copy Easypaisa number without any backend. */
document.querySelectorAll('[data-copy]').forEach(button=>{
  button.addEventListener('click',async()=>{
    const value=button.dataset.copy;
    try{
      await navigator.clipboard.writeText(value);
      showToast('Easypaisa number copied.');
      button.textContent='Copied ✓';
      setTimeout(()=>button.textContent='Copy number',1600);
    }catch(e){
      showToast(`Number: ${value}`);
    }
  });
});

function showToast(text){
  if(!toast) return;
  toast.textContent=text;
  toast.classList.add('show');
  clearTimeout(window.fqmunToastTimer);
  window.fqmunToastTimer=setTimeout(()=>toast.classList.remove('show'),2200);
}

/* Small scroll reveal for static sections. */
const revealItems=document.querySelectorAll('.committee,.timeline-item,.guide-grid article,.faq-list details');
if('IntersectionObserver' in window){
  const observer=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  },{threshold:.08});
  revealItems.forEach(item=>observer.observe(item));
}
