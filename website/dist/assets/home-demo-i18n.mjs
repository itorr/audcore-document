// Compact labels from the current shared UI catalog. Display only.
export const translations={"空输入":["No in", "入力なし"],"伴奏":["BGM","伴奏"],"混响":["Verb","残響"],"麦克风":["Mic","集音"],"监听":["Mon","返し"],"混音":["Mix","混合"],"通道发送":["Strip send","通路送信"],"网页源":["Web source","Web音源"],"伴奏融合":["Blend","伴奏調和"],"静音降噪":["Denoise","雑音抑制"],"抬升压缩":["Lift","持上圧縮"],"组合混响":["Reverb","合成残響"],"去齿音":["De-ess","歯擦音"],"输出限制":["Limiter","出力制限"],"动态均衡":["JUN EQ","動的均衡"],"新建预设":["New","新規"],"新建智能跳线预设":["New patch","結線作成"],"新建工程":["New project","新規作成"],"新建通道":["Add strip","通路追加"],"设置":["Set","設定"],"录音":["Rec","録音"],"语言":["Lang","言語"],"添加效果器":["Add FX","効果追加"],"输入":["In","入力"],"输出":["Out","出力"],"耳返":["Monitor","モニター"],"单通道监听":["Monitor","モニター"],"唱歌直播":["Singing","歌配信"],"聊天和唱歌":["Chat & singing","雑談と歌"],"返回控制台":["Back to console","コンソールに戻る"],"打开文件":["Open","開く"],"保存预设":["Save","保存"],"输入 {}":["In {}","入力 {}"],"截获播放器":["Player capture","再生音取込"],"聊天":["Chat","会話"],"唱歌":["Sing","歌唱"],"人声湿声":["Wet","加工声"],"总混音":["Mix","総出力"],"环绕音":["Spin","立体音響"],"电话音":["Phone","電話音"],"电音":["AutoTune","音程補正"],"高频激励":["Exciter","高域強調"],"多频段降噪":["Multiband NR","帯域別雑音抑制"],"试音键盘":["Keys","試奏鍵盤"],"延迟检测":["Latency","遅延測定"],"增益":["Gain","利得"],"白噪音":["White Noise","白色雑音"],"采样延迟":["Sample Delay","遅延調整"],"磁带过载":["Tape Drive","テープ歪"],"媒体播放":["Player","媒体再生"],"伴奏变调":["PITCH","伴奏移調"],"防啸叫":["Anti-Howl","発振抑制"],"压缩":["COMP","圧縮"],"噪声门":["Gate","雑音門"],"侧链":["Side","側鎖"]};
export function translate(value, language) {
  const index=language==='en'?0:language==='ja'?1:-1;
  if(index<0)return value;
  if(translations[value])return translations[value][index];
  if(value.endsWith(' · 侧链'))return translate(value.slice(0,-5),language)+' · '+translate('侧链',language);
  const match=/^(输入|输出) (\d+(?:\/\d+)?)$/.exec(value);
  if(match)return (translations[match[1]+' {}']?.[index]||translations[match[1]][index]+' {}').replace('{}',match[2]);
  return value;
}
