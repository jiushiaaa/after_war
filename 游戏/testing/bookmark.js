/* MPL-2.0 — Development-only bookmark, never a player save or a cloud record. */
async function loadLocalSdk() {
  const host=globalThis.location?.hostname;
  if(!['127.0.0.1','localhost','[::1]'].includes(host)||!globalThis.window||window.top!==window||window.org_box) {
    throw Error('测试位置仅在本地体验目录保存');
  }
  // This dependency is served by the local dev server, not copied into the game build.
  const {default:sdk,configure,getMode}=await import('../node_modules/@66rpg/lumimaker-sdk/dist/index.js');
  configure({mode:'local',namespace:'suiren-test-bookmark-v1'});
  if(getMode()!=='local')throw Error('测试位置不能使用线上存档');
  return sdk;
}

export function createTestBookmark(loadSdk=loadLocalSdk) {
  let sdkPromise,queue=Promise.resolve();
  const valid=value=>value&&/^[a-z0-9-]+$/.test(value.scenario||'')&&/^[a-z0-9-]{16,64}$/.test(value.run||'')&&typeof value.page==='string';
  const enqueue=action=>{
    const result=queue.then(async()=>action(await(sdkPromise??=loadSdk())));
    queue=result.catch(()=>{});
    return result;
  };
  return {
    read:()=>enqueue(async sdk=>{
      const bytes=await sdk.readSave();
      if(bytes===null)return null;
      const value=JSON.parse(new TextDecoder().decode(bytes));
      return valid(value)?value:null;
    }),
    write:value=>{
      if(!valid(value))return Promise.reject(Error('测试位置无效'));
      // Snapshot before awaiting an earlier request; later navigation must not change this write.
      const text=JSON.stringify({scenario:value.scenario,run:value.run,page:value.page,title:value.title});
      return enqueue(sdk=>sdk.writeSave(text));
    }
  };
}
const bookmark=createTestBookmark();
export const readBookmark=()=>bookmark.read();
export const writeBookmark=value=>bookmark.write(value);
