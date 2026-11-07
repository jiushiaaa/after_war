/* MPL-2.0 — Lossless transport encoding; economic and historical records stay intact. */
var CivilSaveCodec={
  maxBytes:64000000,
  async encode(text){
    const bytes=new TextEncoder().encode(text);
    if(bytes.length>this.maxBytes)throw Error('存档超过可读取上限，未写入');
    if(bytes.length<500000||typeof CompressionStream==='undefined')return text;
    const compressed=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
    let binary='';for(let i=0;i<compressed.length;i+=32768)binary+=String.fromCharCode(...compressed.subarray(i,i+32768));
    return JSON.stringify({format:'postwar-civilization',version:2,encoding:'gzip-base64',bytes:bytes.length,data:btoa(binary)});
  },
  async unpack(text){
    if(text.length>this.maxBytes)throw Error('存档太大');
    const envelope=JSON.parse(text);
    if(envelope.version!==2)return text;
    if(envelope.format!=='postwar-civilization'||envelope.encoding!=='gzip-base64'||!Number.isSafeInteger(envelope.bytes)||envelope.bytes<1||envelope.bytes>this.maxBytes||typeof envelope.data!=='string'||!envelope.data.length)throw Error('压缩存档格式无效');
    if(typeof DecompressionStream==='undefined')throw Error('当前浏览器不支持此存档，请使用更新的浏览器');
    const binary=atob(envelope.data);if(btoa(binary)!==envelope.data)throw Error('压缩存档数据无效');
    const reader=new Blob([Uint8Array.from(binary,c=>c.charCodeAt(0))]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
    const decoder=new TextDecoder('utf-8',{fatal:true});let total=0,result='';
    try {
      while(true){const {value,done}=await reader.read();if(done)break;total+=value.length;
        if(total>envelope.bytes||total>this.maxBytes)throw Error('压缩存档展开长度无效');
        result+=decoder.decode(value,{stream:true});
      }
      result+=decoder.decode();if(total!==envelope.bytes)throw Error('压缩存档长度不符');
      return result;
    }catch(error){await reader.cancel().catch(()=>{});throw error;}
    finally{reader.releaseLock();}
  }
};
