(function(root){
  function versionOf(value){
    return {
      client_updated_at:Number(value?.client_updated_at||0),
      mutation_id:String(value?.mutation_id||'')
    };
  }
  function compareVersion(a,b){
    const left=versionOf(a),right=versionOf(b);
    if(left.client_updated_at!==right.client_updated_at)return left.client_updated_at-right.client_updated_at;
    return left.mutation_id.localeCompare(right.mutation_id);
  }
  function chooseWinner(local,remote){
    if(!local)return remote;
    if(!remote)return local;
    return compareVersion(local,remote)>=0?local:remote;
  }
  function mergeByKey(localRows,remoteRows,keyOf){
    const merged=new Map();
    for(const row of [...(localRows||[]),...(remoteRows||[])]){
      const key=keyOf(row);
      if(!key)continue;
      merged.set(key,chooseWinner(merged.get(key),row));
    }
    return [...merged.values()];
  }
  function progressKey(row){return [row.profile_id,row.deck_id,String(row.lemma||'').trim().toLowerCase()].join('\u001f')}
  function resumeKey(row){return [row.profile_id,row.deck_id].join('\u001f')}
  function settingKey(row){return [row.profile_id,row.setting_key].join('\u001f')}
  const api={versionOf,compareVersion,chooseWinner,mergeByKey,progressKey,resumeKey,settingKey};
  root.VocabularySyncCore=Object.freeze(api);
})(typeof window!=='undefined'?window:globalThis);
