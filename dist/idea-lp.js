'use strict';
// Landing-page behavior stays outside the unmodified IDE document.
const widget=document.querySelector('#idea-widget'),shell=document.querySelector('#idea-widget-shell'),expand=document.querySelector('#idea-widget-fullscreen');
const mobile=matchMedia('(max-width:760px)'),mobileVideo=document.querySelector('#idea-mobile-video');
function sizeWidget(){
  const {width,height}=shell.getBoundingClientRect();if(!width||!height)return;
  const virtualWidth=Math.max(1280,width),scale=width/virtualWidth;
  widget.style.width=virtualWidth+'px';widget.style.height=height/scale+'px';widget.style.transform=`scale(${scale})`;
}
new ResizeObserver(sizeWidget).observe(shell);sizeWidget();
const loadWidget=()=>{if(!mobile.matches&&!widget.hasAttribute('src'))widget.src=widget.dataset.src};
const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))loadWidget()},{threshold:.08});observer.observe(shell);
mobile.addEventListener('change',()=>{if(mobile.matches){widget.removeAttribute('src');delete shell.dataset.ready}else{mobileVideo.pause();sizeWidget();const r=shell.getBoundingClientRect();if(r.bottom>0&&r.top<innerHeight)loadWidget()}});
widget.addEventListener('load',()=>{if(!widget.hasAttribute('src'))return;shell.dataset.ready='true';sizeWidget()});
expand.addEventListener('click',async()=>{loadWidget();if(document.fullscreenElement)await document.exitFullscreen();else if(shell.requestFullscreen)await shell.requestFullscreen();else window.open(widget.dataset.src,'_blank','noopener')});
document.addEventListener('fullscreenchange',()=>{const full=document.fullscreenElement===shell;expand.setAttribute('aria-label',full?'Exit IDE fullscreen':'Expand IDE widget');expand.title=full?'Exit IDE fullscreen':'Expand IDE widget';requestAnimationFrame(sizeWidget)});

// On phones retain the original overview video and its JetBrains controls.
const player=document.querySelector('.idea-mobile-video'),play=player.querySelector('.vpwc-play-pause'),mute=player.querySelector('.vpwc-mute-toggle'),progress=player.querySelector('.vpwc-progress-area');
const playIcon=play.innerHTML,pauseIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h5v16H5zm9 0h5v16h-5z"/></svg>';
async function toggleVideo(){
  if(!mobileVideo.paused){mobileVideo.pause();return}
  if(!mobileVideo.querySelector('source[src]')){mobileVideo.querySelectorAll('source[data-src]').forEach(s=>s.src=s.dataset.src);mobileVideo.load()}
  try{await mobileVideo.play()}catch{mobileVideo.controls=true}
}
play.addEventListener('click',toggleVideo);mobileVideo.addEventListener('click',toggleVideo);
const updateVideo=()=>{const playing=!mobileVideo.paused;play.setAttribute('aria-label',playing?'Pause':'Play');play.setAttribute('aria-pressed',String(playing));play.innerHTML=playing?pauseIcon:playIcon};
mobileVideo.addEventListener('play',updateVideo);mobileVideo.addEventListener('pause',updateVideo);mobileVideo.addEventListener('ended',updateVideo);
mute.addEventListener('click',()=>{mobileVideo.muted=!mobileVideo.muted;mute.setAttribute('aria-label',mobileVideo.muted?'Unmute':'Mute');mute.setAttribute('aria-pressed',String(mobileVideo.muted))});
const seek=value=>{if(Number.isFinite(mobileVideo.duration))mobileVideo.currentTime=Math.max(0,Math.min(mobileVideo.duration,value))};
progress.addEventListener('click',e=>{const r=progress.getBoundingClientRect();seek((e.clientX-r.left)/r.width*mobileVideo.duration)});
progress.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();seek(mobileVideo.currentTime+(e.key==='ArrowRight'?5:-5))}});
mobileVideo.addEventListener('timeupdate',()=>{const percent=mobileVideo.duration?mobileVideo.currentTime/mobileVideo.duration*100:0,time=Math.floor(mobileVideo.currentTime),text=String(Math.floor(time/60)).padStart(2,'0')+':'+String(time%60).padStart(2,'0');player.querySelector('.vpwc-time-display span').textContent=text;player.querySelector('.vpwc-time-display').setAttribute('aria-label','Current time: '+text);progress.setAttribute('aria-valuenow',String(Math.round(percent)));player.querySelector('.vpwc-progress-filled').style.width=percent+'%'});
player.querySelector('.vpwc-fullscreen-toggle').addEventListener('click',async()=>{if(document.fullscreenElement)await document.exitFullscreen();else if(player.requestFullscreen)await player.requestFullscreen();else mobileVideo.webkitEnterFullscreen?.()});

// The original navigation content is retained; no original site scripts run.
const backdrop=document.createElement('div');backdrop.className='idea-lp-nav-backdrop';backdrop.hidden=true;document.body.append(backdrop);
function closeMenus(){document.querySelectorAll('[data-lp-nav-open]').forEach(item=>{item.removeAttribute('data-lp-nav-open');item.querySelector('button')?.setAttribute('aria-expanded','false')});backdrop.hidden=true}
document.querySelectorAll('[data-test="main-menu-item-action"]').forEach(button=>{
  button.addEventListener('click',()=>{const parent=button.parentElement,open=parent.dataset.lpNavOpen==='true';closeMenus();if(!open){parent.dataset.lpNavOpen='true';button.setAttribute('aria-expanded','true');backdrop.hidden=false}});
});
backdrop.addEventListener('click',closeMenus);window.addEventListener('blur',closeMenus);
document.addEventListener('click',e=>{if(!e.target.closest('#wt-site-header'))closeMenus()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenus();document.querySelector('#wt-site-header')?.classList.remove('_mobileOpen_f8nocd_33');document.querySelector('.menu-second-mobile-popup')?.removeAttribute('data-lp-open')}});
const siteHeader=document.querySelector('#wt-site-header');
document.querySelector('[data-test="site-header-open-mobile-menu"]')?.addEventListener('click',()=>siteHeader.classList.add('_mobileOpen_f8nocd_33'));
document.querySelector('[data-test="site-header-close-mobile-menu"]')?.addEventListener('click',()=>siteHeader.classList.remove('_mobileOpen_f8nocd_33'));
document.querySelectorAll('[data-test="mobile-main-menu-item-action"]').forEach(button=>button.addEventListener('click',()=>{const open=button.getAttribute('aria-expanded')==='true';button.setAttribute('aria-expanded',String(!open));button.parentElement.querySelector('[data-test="mobile-main-submenu"]')?.classList.toggle('wt-display-none',open)}));
document.querySelector('.menu-second-mobile__trigger')?.addEventListener('click',()=>{const popup=document.querySelector('.menu-second-mobile-popup');if(popup)popup.dataset.lpOpen=String(popup.dataset.lpOpen!=='true')});
document.querySelectorAll('[data-test="site-header-search-action"]').forEach(b=>b.addEventListener('click',()=>window.open('https://www.jetbrains.com/search/','_blank','noopener')));
document.querySelectorAll('[data-test="language-picker"],[data-test="footer-country-button"]').forEach(b=>b.addEventListener('click',()=>window.open('https://www.jetbrains.com/idea/','_blank','noopener')));

function positionSwitchers(){
  document.querySelectorAll('[data-rs-internal="switcher"],[data-rs-internal="vertical-switcher"]').forEach(group=>{
    const selected=group.querySelector('input:checked')?.closest('label'),mark=group.querySelector('span[class*="_mark_"]');if(!selected||!mark)return;
    const a=selected.getBoundingClientRect(),b=group.getBoundingClientRect();mark.style.left=a.left-b.left+'px';mark.style.top=a.top-b.top+'px';mark.style.width=a.width+'px';mark.style.height=a.height+'px';
  });
}
document.fonts.ready.then(positionSwitchers);window.addEventListener('resize',positionSwitchers);
document.querySelectorAll('.idea-branding-hero-section input[type="radio"]').forEach(input=>input.addEventListener('change',()=>{if(input.value!=='idea')window.location.href='https://www.jetbrains.com/idea/extension/?extension='+encodeURIComponent(input.value)}));
document.querySelectorAll('input[type="radio"][value="light"],input[type="radio"][value="dark"]').forEach(input=>input.addEventListener('change',()=>{
  const dark=input.value==='dark',page=document.querySelector('.idea-page');page.classList.remove('jb-theme_system','jb-theme_light','jb-theme_dark');page.classList.add(dark?'jb-theme_dark':'jb-theme_light');
  document.querySelectorAll('.idea-feature-poster').forEach(image=>image.src=dark?image.dataset.lpDarkSrc:image.dataset.lpLightSrc);
  document.querySelectorAll('input[type="radio"][value="light"],input[type="radio"][value="dark"]').forEach(r=>{r.checked=r.value===input.value;const label=r.closest('label');label?.classList.toggle('_selected_1y298pn_119',r.checked)});positionSwitchers();
}));

function selectFeature(index){
  document.querySelectorAll('[data-lp-feature]').forEach(tab=>{const active=Number(tab.dataset.lpFeature)===index;tab.classList.toggle('slideshow__tab_active',active);tab.setAttribute('aria-pressed',String(active));const description=tab.querySelector(':scope>div:last-child');if(description&&description!==tab.querySelector(':scope>div:first-child')){description.classList.toggle('wt-display-block',active);description.classList.toggle('wt-display-none',!active)}});
  document.querySelectorAll('[data-lp-slide]').forEach(slide=>{const active=Number(slide.dataset.lpSlide)===index;slide.classList.toggle('slideshow__slide_visible',active);slide.classList.toggle('slideshow__slide_hidden',!active)});
}
document.querySelectorAll('[data-lp-feature]').forEach(tab=>{tab.addEventListener('click',()=>selectFeature(Number(tab.dataset.lpFeature)));tab.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();tab.click()}})});
document.querySelectorAll('.jb-snap-carousel-block').forEach(block=>{
  const list=block.querySelector('.jb-snap-carousel__wrapper'),buttons=block.querySelectorAll('[data-lp-carousel]');if(!list||!buttons.length)return;
  const update=()=>buttons.forEach(button=>{const disabled=Number(button.dataset.lpCarousel)<0?list.scrollLeft<2:list.scrollLeft+list.clientWidth>=list.scrollWidth-2;button.disabled=disabled;button.classList.toggle('_disabled_l33nyt_141',disabled)});
  buttons.forEach(button=>button.addEventListener('click',()=>{const card=list.querySelector('.jb-snap-carousel__slide');list.scrollBy({left:Number(button.dataset.lpCarousel)*(card.getBoundingClientRect().width+24),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}));
  list.addEventListener('scroll',update,{passive:true});new ResizeObserver(update).observe(list);document.fonts.ready.then(update);
});
