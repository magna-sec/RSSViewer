/* Shared skin-switcher for all standalone interactive pages.
   Injects the toggle button + panel HTML and wires events.
   The inline skin-init <script> in <head> must stay per-page (prevents FOUC). */
(function(){
  var SKINS=[
    {key:'aero',    label:'Phantom', grad:'#818cf8,#38bdf8'},
    {key:'neon',    label:'Matrix',  grad:'#4ade80,#86efac'},
    {key:'crimson', label:'Hellfire',grad:'#f87171,#fca5a5'},
    {key:'ocean',   label:'Abyss',   grad:'#2dd4bf,#67e8f9'},
    {key:'amber',   label:'Reactor', grad:'#fbbf24,#fde68a'},
    {key:'caveman', label:'Caveman', grad:'#e8732a,#f0b040'},
    {key:'win95',   label:'Win 95',  grad:'#000080,#c0c0c0'},
    {key:'aero',    label:'Aero',    grad:'#4fa3e0,#a8d4f5'}
  ];

  var btn=document.createElement('button');
  btn.id='skin-toggle';
  btn.title='Change skin';
  btn.setAttribute('aria-label','Change colour skin');
  btn.innerHTML='&#9681;';

  var panel=document.createElement('div');
  panel.id='skin-panel';
  panel.setAttribute('role','listbox');
  panel.setAttribute('aria-label','Colour skins');

  var html='<div class="skin-panel-title">Colour Skin</div>';
  SKINS.forEach(function(s){
    html+='<div class="skin-opt" data-skin="'+s.key+'" role="option">'+
      '<span class="skin-swatch" style="background:linear-gradient(135deg,'+s.grad+')"></span>'+
      ' '+s.label+'</div>';
  });
  panel.innerHTML=html;

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  btn.addEventListener('click',function(e){e.stopPropagation();panel.classList.toggle('open');});
  document.addEventListener('click',function(){panel.classList.remove('open');});
  panel.addEventListener('click',function(e){e.stopPropagation();});
  panel.querySelectorAll('.skin-opt').forEach(function(o){
    o.addEventListener('click',function(){
      var sk=o.getAttribute('data-skin');
      document.documentElement.setAttribute('data-skin',sk);
      localStorage.setItem('bs-skin',sk);
      panel.classList.remove('open');
    });
  });
})();
