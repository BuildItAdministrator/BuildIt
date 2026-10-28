/* Chernarus+ base map switch: satellite ↔ topographic.
 * Both layers use the same XAM 1.27 256-unit bounds and identical tile options.
 * Switches only base tiles; markers, bases, logs and zoom remain untouched.
 */
(function () {
  'use strict';
  if (typeof L === 'undefined' || typeof map === 'undefined' || typeof MAP_STYLES === 'undefined') return;

  let button=null;
  let topoErrors=0;
  let topoTileLoaded=false;

  function updateButton() {
    if (!button) return;
    const isTopo=currentMapStyle==='topographic';
    button.textContent=isTopo?'Topographic':'Satellite';
    button.setAttribute('aria-label',isTopo
      ? 'Map style: Topographic. Switch to Satellite'
      : 'Map style: Satellite. Switch to Topographic');
    button.title=isTopo?'Switch to Satellite map':'Switch to Topographic map';
    button.setAttribute('aria-pressed',String(isTopo));
    button.dataset.mapStyle=currentMapStyle;
  }

  function setMapStyle(style,{save=true}={}) {
    if (!Object.hasOwn(MAP_STYLES,style)) return false;
    if (style === currentMapStyle) return true;
    const original=MAP_STYLES[currentMapStyle];
    const replacement=MAP_STYLES[style];
    // Map center, zoom and game-coordinate mapping do not change.
    if(map.hasLayer(original)) map.removeLayer(original);
    replacement.addTo(map);
    currentMapStyle=style;
    if(style==='topographic'){
      topoErrors=0;
      topoTileLoaded=false;
    }
    if(save){
      try{localStorage.setItem(MAP_STYLE_STORE,style)}
      catch(_){}
    }
    updateButton();
    map.fire('buildit:map-style-change',{style});
    return true;
  }

  // Existing satellite map remains a reliable fallback if alternate tiles
  // fail, e.g. a removed third-party map version or a temporary outage.
  MAP_STYLES.topographic.on('tileload',()=>{topoTileLoaded=true;topoErrors=0;});
  MAP_STYLES.topographic.on('tileerror',()=>{
    if(currentMapStyle!=='topographic'||topoTileLoaded)return;
    if(++topoErrors<3)return;
    setMapStyle('satellite');
    const status=document.getElementById('status');
    if(status){
      status.textContent='Topographic tiles unavailable. Satellite map restored.';
      status.style.display='block';
      status.style.background='rgba(115,34,34,.95)';
      setTimeout(()=>{status.style.display='none'},5000);
    }
  });

  const control=L.Control.extend({
    options:{position:'topleft'},
    onAdd() {
      const wrapper=L.DomUtil.create('div','leaflet-bar buildit-map-style-control');
      button=L.DomUtil.create('button','buildit-map-style-button',wrapper);
      button.id='builditMapStyleToggle';
      button.type='button';
      // Prevent clicks on the control from placing events on the map.
      L.DomEvent.disableClickPropagation(wrapper);
      L.DomEvent.disableScrollPropagation(wrapper);
      L.DomEvent.on(button,'click',()=>{
        setMapStyle(currentMapStyle==='satellite'?'topographic':'satellite');
      });
      updateButton();
      return wrapper;
    }
  });
  new control().addTo(map);
})();
