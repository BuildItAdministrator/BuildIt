/* Strict XML checks and narrowly-scoped recovery for duplicate XML declarations.
 * No network calls, storage, file writes, or formatting of existing server XML.
 */
(function(){
  'use strict';
  function attrs(declaration){
    const read=name=>{
      const hit=declaration.match(new RegExp('\\b'+name+'\\s*=\\s*(["\\x27])(.*?)\\1','i'));
      return hit?hit[2].trim().toLowerCase():null;
    };
    return {version:read('version'),encoding:read('encoding'),standalone:read('standalone')};
  }
  function compatible(first,second){
    const a=attrs(first),b=attrs(second);
    return (a.version||'1.0')==='1.0' && (b.version||'1.0')==='1.0' &&
      (!b.encoding||!a.encoding||b.encoding===a.encoding) &&
      (!b.standalone||!a.standalone||b.standalone===a.standalone);
  }
  function validate(content,root){
    if(typeof content!=='string')throw new Error('XML content is missing.');
    const doc=new DOMParser().parseFromString(content,'application/xml');
    if(doc.querySelector('parsererror') || doc.documentElement?.localName==='parsererror')
      throw new Error('XML is invalid. A different syntax error remains; restore a known-good backup or edit the source before uploading.');
    if(root && doc.documentElement.nodeName!==root)
      throw new Error('Expected <'+root+'>, found <'+doc.documentElement.nodeName+'>. Upload cancelled.');
    const declaration=content.match(/^\uFEFF?<\?xml\s+[^?]*\?>/i)?.[0];
    const encoding=declaration && attrs(declaration).encoding;
    if(encoding && !/^utf-?8$/.test(encoding))
      throw new Error('Server file declares '+encoding.toUpperCase()+' encoding; UTF-8 upload is blocked to prevent corruption.');
    return doc;
  }
  function repairDuplicateDeclarations(original,root){
    if(typeof original!=='string')throw new Error('XML content is missing.');
    let content=original,removed=0;
    // Only a directly repeated XML declaration at the start can be removed.
    // Anything embedded later in the file is NOT altered automatically.
    const consecutive=/^(\uFEFF?<\?xml\s+[^?]*\?>)([ \t\r\n]+)(<\?xml\s+[^?]*\?>)([ \t\r\n]*)/i;
    for(let count=0;count<10;count++){
      const m=content.match(consecutive);
      if(!m)break;
      if(!compatible(m[1],m[3]))
        throw new Error('Two different XML declarations were found. Repair manually from a backup.');
      // Keep the first declaration and the whitespace that follows the
      // repeated declaration, leaving every actual XML element unchanged.
      content=m[1]+(m[4]||m[2])+content.slice(m[0].length);
      removed++;
    }
    if(consecutive.test(content))
      throw new Error('Too many duplicate XML declarations. Repair manually from a backup.');
    validate(content,root);
    return {content,removed,changed:removed>0};
  }
  window.BUILD_IT_XML=Object.freeze({validate,repairDuplicateDeclarations});
})();
