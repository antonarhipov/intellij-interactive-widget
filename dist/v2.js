'use strict';
// Runzo is an invitation around the frame; all IDE interactions remain intact.
(()=>{
  const stage=document.querySelector('#runzo-stage'),mascot=document.querySelector('#runzo-invite'),bubble=document.querySelector('#runzo-bubble');
  const frame=document.querySelector('#idea-widget-shell'),container=document.querySelector('#idea-demo'),motion=matchMedia('(prefers-reduced-motion: reduce)'),phone=matchMedia('(max-width:760px)');
  const route=document.createElementNS('http://www.w3.org/2000/svg','path');
  let visible=false,raf=0,last=0,elapsed=0,distance=0,pathLength=0,geometry=null;
  function explore(){
    if(explicitExploration)return;
    explicitExploration=true;pendingResume=false;showTourState({exploring:true});loadWidget();
    if(tourReady)tourControl('explore');
    render();
  }
  mascot.addEventListener('click',explore);bubble.addEventListener('click',explore);
  function layout(){
    const r=frame.getBoundingClientRect(),c=container.getBoundingClientRect(),margin=Math.min(r.left,innerWidth-r.right),height=innerWidth<1100?110:Math.max(76,Math.min(126,margin-12));
    geometry={width:r.width,top:r.top-c.top,bottom:r.bottom-c.top,height,spriteWidth:height*448/665};
    mascot.style.setProperty('--runzo-height',height+'px');mascot.style.setProperty('--runzo-width',geometry.spriteWidth+'px');
    const x=4,right=r.width-4,top=geometry.top+12,bottom=geometry.bottom-8,round=26;
    route.setAttribute('d',`M ${x+round} ${top} H ${right-round} Q ${right} ${top} ${right} ${top+round} V ${bottom-round} Q ${right} ${bottom} ${right-round} ${bottom} H ${x+round} Q ${x} ${bottom} ${x} ${bottom-round} V ${top+round} Q ${x} ${top} ${x+round} ${top} Z`);
    pathLength=route.getTotalLength();if(!distance)distance=r.width*.6;
  }
  function position(point,angle,invitation){
    const c=container.getBoundingClientRect(),x=c.left+point.x,y=c.top+point.y;
    mascot.style.transform=`translate3d(${x-geometry.spriteWidth/2}px,${y-geometry.height}px,0) rotate(${angle}deg)`;
    bubble.hidden=!invitation;
    if(invitation){
      const bounds=mascot.getBoundingClientRect(),w=bubble.offsetWidth,h=bubble.offsetHeight;
      bubble.style.left=Math.max(12,Math.min(innerWidth-w-12,bounds.left-w-14))+'px';
      bubble.style.top=Math.max(84,Math.min(innerHeight-h-12,bounds.top+geometry.height*.3))+'px';
      if(bounds.bottom<82||bounds.top>innerHeight-20)bubble.hidden=true;
    }
  }
  function tick(now){
    raf=0;if(!canShow()){stage.hidden=true;return}
    stage.hidden=false;
    const manual=container.dataset.exploring==='true',staticPose=motion.matches||innerWidth<1100,stationary=manual||staticPose;
    const hovered=mascot.matches(':hover,:focus-visible')||bubble.matches(':hover,:focus-visible');
    const delta=last?Math.min(50,now-last):0;last=now;
    if(!stationary&&!hovered)elapsed+=delta;
    const running=!stationary&&!hovered&&elapsed%13000>=4000;
    if(running)distance=(distance+delta*.09)%pathLength;
    // Keep both the route progress and the gait pose while a visitor takes over.
    // Only responsive/reduced-motion layouts use the fixed resting position.
    mascot.classList.toggle('runzo-paused',manual||hovered);
    if(!manual&&!hovered)mascot.classList.toggle('runzo-running',running);
    mascot.disabled=explicitExploration;
    mascot.setAttribute('aria-label',explicitExploration?'Runzo: you’re exploring':'Click Runzo to explore the IDE');
    if(staticPose)position({x:geometry.width-42,y:geometry.top+12},0,!manual);
    else{
      const p=route.getPointAtLength(distance),next=route.getPointAtLength((distance+1)%pathLength),angle=Math.atan2(next.y-p.y,next.x-p.x)*180/Math.PI;
      position(p,angle,!manual&&(!running||hovered));
    }
    if(!stationary)raf=requestAnimationFrame(tick);
  }
  function canShow(){return visible&&!phone.matches&&!document.hidden&&!document.fullscreenElement&&geometry?.width>0}
  function render(){
    cancelAnimationFrame(raf);raf=0;last=0;
    if(!canShow()){stage.hidden=true;return}
    for(const img of stage.querySelectorAll('img[data-runzo-src]'))if(!img.hasAttribute('src'))img.src=img.dataset.runzoSrc;
    tick(performance.now());
  }
  new ResizeObserver(()=>{layout();render()}).observe(frame);
  new IntersectionObserver(([entry])=>{visible=entry.isIntersecting&&entry.intersectionRatio>=.15;render()},{threshold:[0,.15]}).observe(frame);
  new MutationObserver(render).observe(container,{attributes:true,attributeFilter:['data-exploring']});
  for(const event of ['scroll','resize','fullscreenchange'])window.addEventListener(event,()=>{if(event==='resize')layout();if(!raf)render()},{passive:true});
  document.addEventListener('visibilitychange',render);document.addEventListener('fullscreenchange',render);
  motion.addEventListener('change',render);phone.addEventListener('change',()=>{layout();render()});
  layout();render();
})();
