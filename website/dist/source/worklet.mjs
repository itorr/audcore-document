import {PcmReader,LEVEL} from './buffer.mjs';
class LocalAudio extends AudioWorkletProcessor {
  constructor(options){super();this.reader=new PcmReader(options.processorOptions.shared,sampleRate);}
  process(_inputs,outputs){
    const out=outputs[0];
    if(out?.length>=2){
      this.reader.render(out[0],out[1]);
      let energy=0;for(let i=0;i<out[0].length;i++)energy+=out[0][i]*out[0][i]+out[1][i]*out[1][i];
      // Fixed-size publication only: no messages, allocations or wakeups.
      Atomics.store(this.reader.control,LEVEL,Math.round(Math.min(1,Math.sqrt(energy/(out[0].length*2)))*1e6));
    }
    return true;
  }
}
registerProcessor('audcore-local-audio',LocalAudio);
