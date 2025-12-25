/**
 * AudioWorklet source code as a single-line string with comments stripped
 * to keep bundled output comment-free (except the esbuild banner).
 */
export const AUDIO_WORKLET_SOURCE =
`class AudioProcessorWorklet extends AudioWorkletProcessor{constructor(){super();this.bufferSize=4096;this.audioBuffer=[];this.isRecording=!1;this.port.onmessage=e=>{this.handleMessage(e.data)}}handleMessage(e){switch(e.type){case"start":this.isRecording=!0,this.audioBuffer=[];break;case"stop":this.isRecording=!1,this.audioBuffer.length>0&&this.sendAudioData();break;case"configure":e.bufferSize&&(this.bufferSize=e.bufferSize);break}}process(e){const t=e[0];if(!this.isRecording||!t||t.length===0)return!0;const s=t[0];if(!s||s.length===0)return!0;this.audioBuffer.push(new Float32Array(s));const r=this.audioBuffer.reduce((n,o)=>n+o.length,0);return r>=this.bufferSize&&this.sendAudioData(),!0}sendAudioData(){if(this.audioBuffer.length===0)return;const e=this.audioBuffer.reduce((t,s)=>t+s.length,0),t=new Float32Array(e);let s=0;for(const r of this.audioBuffer)t.set(r,s),s+=r.length;this.port.postMessage({type:"audio",data:t,timestamp:currentTime}),this.audioBuffer=[]}}registerProcessor("audio-processor-worklet",AudioProcessorWorklet);`;

/**
 * Create a blob URL for the AudioWorklet
 */
export function createAudioWorkletBlobURL(): string {
    const blob = new Blob([AUDIO_WORKLET_SOURCE], { type: 'application/javascript' });
    return URL.createObjectURL(blob);
}

/**
 * Clean up blob URL when no longer needed
 */
export function revokeAudioWorkletBlobURL(url: string): void {
    URL.revokeObjectURL(url);
}
