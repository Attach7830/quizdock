import {ensure} from './library-domain.js';

// Removal hides classroom content; learning records remain available to the
// owning teacher. Optimistic versions prevent a stale tab undoing a restore.
export function changeContentVisibility(record,payload,{versionField='revision',hiddenField='removedAt',now=Date.now()}={}){
 ensure(typeof payload.visible==='boolean','Choose whether students can see this item.');
 ensure(/^[a-zA-Z0-9_-]{8,80}$/.test(String(payload.mutationId||'')),'Invalid visibility request identifier.');
 if(record.lastVisibilityMutation?.id===payload.mutationId){ensure(record.lastVisibilityMutation.visible===payload.visible,'That request identifier was already used.',409);return false;}
 const version=record[versionField]||1;
 ensure(Number.isSafeInteger(payload.revision)&&payload.revision===version,'This item changed in another tab. Refresh before changing student access.',409);
 if(Boolean(record[hiddenField])===!payload.visible)return false;
 if(payload.visible)delete record[hiddenField];else record[hiddenField]=now;
 record[versionField]=version+1;record.updatedAt=now;record.lastVisibilityMutation={id:payload.mutationId,visible:payload.visible};return true;
}
