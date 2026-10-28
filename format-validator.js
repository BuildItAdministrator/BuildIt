/* Shared, read-only pre-upload validation for Nitrado XML and JSON.
 * The validator never reformats source, contacts a server, or writes files.
 */
(function(){
  'use strict';
  const MAX_FILE_BYTES=512*1024;
  const ROOTS={
    'events.xml':'events',
    'cfgeventspawns.xml':'eventposdef',
    'cfgspawnabletypes.xml':'spawnabletypes',
    'types.xml':'types',
    'messages.xml':'messages',
    'cfglimitsdefinition.xml':'lists'
  };
  function filename(path){
    return String(path||'').replace(/\\/g,'/').split('/').pop().toLowerCase();
  }
  function lineColumn(text,position){
    if(!Number.isInteger(position)||position<0)return '';
    const upto=text.slice(0,position);
    const lines=upto.split(/\r\n|\r|\n/);
    return ' at line '+lines.length+', column '+(lines[lines.length-1].length+1);
  }
  function jsonErrorDetail(error,text){
    const msg=String(error?.message||'Invalid JSON');
    const at=msg.match(/(?:at position|position)\s+(\d+)/i);
    const line=msg.match(/line\s+(\d+)(?:\s+column\s+(\d+))?/i);
    if(line)return msg;
    if(at)return msg+lineColumn(text,Number(at[1]));
    return msg;
  }
  function validateJson(path,text){
    let data;
    try{data=JSON.parse(text);}
    catch(error){throw new Error('Invalid JSON: '+jsonErrorDetail(error,text));}
    if(data===null||typeof data!=='object')
      throw new Error('JSON must contain an object or array at its root.');
    // DayZ Object Spawner JSON uses a top-level Objects array. Validate it
    // only when present, so other DayZ configs and loadouts stay compatible.
    if(!Array.isArray(data)&&Object.prototype.hasOwnProperty.call(data,'Objects')){
      if(!Array.isArray(data.Objects))
        throw new Error('Invalid DayZ Object Spawner: Objects must be an array.');
      data.Objects.forEach((obj,index)=>{
        if(!obj||typeof obj!=='object'||Array.isArray(obj)||
          typeof obj.name!=='string'||!obj.name.trim())
          throw new Error('Invalid Object Spawner entry '+(index+1)+': missing classname (name).');
        if(!Array.isArray(obj.pos)||obj.pos.length!==3||
          !obj.pos.every(n=>typeof n==='number'&&Number.isFinite(n)))
          throw new Error('Invalid Object Spawner entry '+(index+1)+': pos must contain three numeric coordinates.');
      });
      return {format:'JSON',detail:'Valid DayZ Object Spawner JSON ('+data.Objects.length+' objects)'};
    }
    return {format:'JSON',detail:'Valid JSON syntax'};
  }
  function validateXml(path,text,expectedRoot){
    if(!window.BUILD_IT_XML?.validate)
      throw new Error('XML validation module unavailable. Reload Build It!++.');
    const root=expectedRoot||ROOTS[filename(path)]||null;
    let doc;
    try{doc=window.BUILD_IT_XML.validate(text,root);}
    catch(error){
      const raw=String(error?.message||'Invalid XML');
      throw new Error('Invalid XML: '+raw.replace(/^XML is invalid\.\s*/i,''));
    }
    return {format:'XML',detail:'Valid XML · root <'+doc.documentElement.nodeName+'>'};
  }
  function validate(path,content,options={}){
    if(typeof content!=='string')throw new Error('File content is missing.');
    const bytes=new TextEncoder().encode(content).length;
    if(bytes>MAX_FILE_BYTES)throw new Error('File exceeds the 512 KB editing/upload limit ('+bytes+' bytes).');
    const ext=filename(path).split('.').pop();
    const meta=ext==='xml'?validateXml(path,content,options.expectedRoot):
      ext==='json'?validateJson(path,content):
      ext==='txt'?{format:'TXT',detail:'Plain text'}:
      null;
    if(!meta)throw new Error('Unsupported file type. Only XML, JSON and TXT can be uploaded.');
    return Object.freeze({...meta,bytes});
  }
  window.BUILD_IT_FORMAT=Object.freeze({validate,MAX_FILE_BYTES});
})();
