/* Own the displayed result while a proposed scan is being reviewed or run.
   Late history/monitor responses must not replace a different study area. */
(function(root){
  function create(){
    let owner=null,expected=null,revision=0;
    return {
      reserve(key,scanId=null){if(owner!==key||expected!==scanId){owner=key;expected=scanId;revision++;}},
      release(){if(owner!==null){owner=null;expected=null;revision++;}},
      allows(id){return owner===null||(expected!==null&&id===expected);},
      ticket(id){return {id,revision};},
      accepts(ticket){return ticket.revision===revision&&this.allows(ticket.id);}
    };
  }
  if(typeof module!=='undefined')module.exports={create};else root.ScanDisplay={create};
})(typeof window!=='undefined'?window:globalThis);
