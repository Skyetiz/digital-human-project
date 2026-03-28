/**
 * 唇形同步模块 - 完整独立实现
 * 功能：根据音频或模拟数据驱动3D模型的嘴部运动
 * 无需依赖TTS和LLM，可独立开发和测试
 */

// ============================================================
// 配置参数
// ============================================================

const LIP_SYNC_CONFIG = {
  // 基础配置
  enabled: true,                      // 是否启用唇形同步
  debugMode: true,                    // 调试模式（控制台输出日志）
  
  // 嘴部运动参数
  maxIntensity: 0.8,                  // 最大张嘴强度（0-1）
  minIntensity: 0.05,                // 最小张嘴强度
  smoothing: 0.3,                    // 平滑系数（数值越大响应越快）
  responseSpeed: 0.15,               // 响应速度
  
  // 自动眨眼参数
  autoBlink: true,                   // 是否自动眨眼
  blinkInterval: 3000,               // 眨眼间隔（毫秒）
  blinkDuration: 150,                // 眨眼持续时间（毫秒）
  blinkIntensity: 0.9,               // 眨眼强度
  
  // 表情参数
  enableExpressions: true,            // 是否启用表情变化
  smileIntensity: 0.3,               // 微笑强度
  eyebrowIntensity: 0.2              // 眉毛运动强度
};

// ============================================================
// 唇形同步控制器类
// ============================================================

export class LipSyncController {
  constructor(config = {}) {
    // 合并配置
    this.config = { ...LIP_SYNC_CONFIG, ...config };
    
    // 模型相关
    this.model = null;
    this.morphTargets = [];           // 存储所有Morph Target信息
    this.morphTargetMap = new Map();  // 快速查找Morph Target索引
    
    // 状态变量
    this.currentIntensity = 0;
    this.targetIntensity = 0;
    this.isSpeaking = false;
    this.lastUpdateTime = 0;
    
    // 眨眼相关
    this.blinkTimer = null;
    this.isBlinking = false;
    this.blinkStartTime = 0;
    
    // 音频相关
    this.audioContext = null;
    this.analyser = null;
    this.audioSource = null;
    this.volumeCallback = null;
    this.isAnalyzing = false;
    
    // 调试相关
    this.stats = {
      updates: 0,
      lastIntensity: 0,
      activeMorphTargets: []
    };
    
    if (this.config.debugMode) {
      console.log('🎤 唇形同步控制器已初始化', this.config);
    }
  }
  
  // ============================================================
  // 初始化方法
  // ============================================================
  
  /**
   * 初始化唇形同步（绑定到3D模型）
   * @param {THREE.Object3D} model - Three.js模型对象
   */
  init(model) {
    this.model = model;
    this.findMorphTargets(model);
    
    if (this.morphTargets.length === 0) {
      console.warn('⚠️ 警告：模型未找到Morph Targets，唇形同步将不可用');
      console.warn('   解决方法：在Blender中为模型添加形态键（Shape Keys）');
      return false;
    }
    
    console.log(`✅ 找到 ${this.morphTargets.length} 个Morph Targets`);
    if (this.config.debugMode) {
      this.printMorphTargets();
    }
    
    // 启动自动眨眼
    if (this.config.autoBlink) {
      this.startAutoBlink();
    }
    
    return true;
  }
  
  /**
   * 递归查找模型中的所有Morph Targets
   */
  findMorphTargets(obj) {
    if (!obj) return;
    
    // 检查当前对象是否是网格且包含Morph Targets
    if (obj.isMesh && obj.morphTargetDictionary) {
      const targets = {
        mesh: obj,
        dictionary: obj.morphTargetDictionary,
        influences: obj.morphTargetInfluences,
        name: obj.name || 'unnamed'
      };
      
      this.morphTargets.push(targets);
      
      // 建立快速查找映射
      Object.keys(obj.morphTargetDictionary).forEach(key => {
        if (!this.morphTargetMap.has(key)) {
          this.morphTargetMap.set(key, []);
        }
        this.morphTargetMap.get(key).push({
          mesh: obj,
          index: obj.morphTargetDictionary[key]
        });
      });
    }
    
    // 递归检查子对象
    if (obj.children) {
      obj.children.forEach(child => {
        this.findMorphTargets(child);
      });
    }
  }
  
  /**
   * 打印所有找到的Morph Targets（调试用）
   */
  printMorphTargets() {
    console.log('📋 可用的Morph Targets:');
    this.morphTargets.forEach(target => {
      const keys = Object.keys(target.dictionary);
      console.log(`  - ${target.name}: ${keys.join(', ')}`);
    });
  }
  
  // ============================================================
  // 核心更新方法
  // ============================================================
  
  /**
   * 更新唇形同步（基于音量强度）
   * @param {number} intensity - 音量强度 (0-1)
   * @param {Object} options - 可选参数
   */
  update(intensity, options = {}) {
    if (!this.config.enabled) return;
    if (!this.model || this.morphTargets.length === 0) return;
    
    // 限制强度范围
    intensity = Math.min(this.config.maxIntensity, 
                        Math.max(this.config.minIntensity, intensity));
    
    // 更新目标强度
    this.targetIntensity = intensity;
    
    // 应用平滑过渡
    this.currentIntensity = this.currentIntensity * (1 - this.config.smoothing) +
                           this.targetIntensity * this.config.smoothing;
    
    // 更新说话状态
    const wasSpeaking = this.isSpeaking;
    this.isSpeaking = this.currentIntensity > 0.1;
    
    // 更新嘴部运动
    this.updateMouth(this.currentIntensity);
    
    // 更新表情（可选）
    if (this.config.enableExpressions && options.emotion) {
      this.updateExpressions(options.emotion);
    }
    
    // 更新统计信息
    if (this.config.debugMode && Date.now() - this.lastUpdateTime > 1000) {
      this.stats.updates++;
      this.stats.lastIntensity = this.currentIntensity;
      this.lastUpdateTime = Date.now();
    }
  }
  
 /**
 * 更新嘴部运动 - 适配数字索引的Morph Targets
 */
updateMouth(intensity) {
  if (!this.morphTargets.length) {
    // 如果没有Morph Targets，使用缩放方案
    this.simulateMouthWithScale(intensity);
    return;
  }
  
  // 遍历所有包含Morph Targets的网格
  this.morphTargets.forEach(target => {
    const influences = target.influences;
    if (!influences) return;
    
    // 获取Morph Targets的名称（如果有）
    const dict = target.dictionary;
    const hasNamedTargets = dict && Object.keys(dict).length > 0;
    
    if (hasNamedTargets) {
      // 如果有命名，尝试找标准的嘴部相关名称
      const keys = Object.keys(dict);
      let mouthIndices = [];
      
      // 查找可能的嘴部相关Morph Targets
      keys.forEach((key, idx) => {
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes('jaw') || 
            lowerKey.includes('mouth') || 
            lowerKey.includes('open') ||
            lowerKey.includes('viseme') ||
            lowerKey.includes('a') && lowerKey.length < 3) {
          mouthIndices.push(idx);
        }
      });
      
      if (mouthIndices.length > 0) {
        // 使用找到的嘴部相关Morph Targets
        mouthIndices.forEach((idx, i) => {
          const weight = intensity * (1 - i * 0.2);
          influences[idx] = Math.min(0.8, weight);
        });
      } else {
        // 如果没有找到特定名称，使用前几个作为临时方案
        const count = Math.min(3, influences.length);
        for (let i = 0; i < count; i++) {
          influences[i] = intensity * (1 - i * 0.3);
        }
      }
    } else {
      // 如果是数字索引（你的模型），使用前3个Morph Targets
      const count = Math.min(3, influences.length);
      for (let i = 0; i < count; i++) {
        // 不同的索引使用不同的权重，创造自然效果
        const weight = intensity * (1 - i * 0.25);
        influences[i] = Math.min(0.8, Math.max(0, weight));
      }
    }
  });
  
  // 调试输出
  if (this.config.debugMode && Math.random() < 0.02) {
    console.log(`🎤 嘴部强度: ${intensity.toFixed(3)}, 激活Morph Targets: ${Math.min(3, this.morphTargets[0]?.influences?.length || 0)}个`);
  }
}

  /**
   * 更新表情（微笑、眉毛等）
   * @param {string} emotion - 表情类型
   */
  updateExpressions(emotion) {
    switch(emotion) {
      case 'smile':
        const smileTargets = this.morphTargetMap.get('mouthSmile');
        if (smileTargets) {
          smileTargets.forEach(target => {
            target.mesh.morphTargetInfluences[target.index] = this.config.smileIntensity;
          });
        }
        break;
        
      case 'surprise':
        const browTargets = this.morphTargetMap.get('browUp');
        if (browTargets) {
          browTargets.forEach(target => {
            target.mesh.morphTargetInfluences[target.index] = this.config.eyebrowIntensity;
          });
        }
        break;
        
      default:
        // 重置所有表情
        ['mouthSmile', 'browUp', 'browDown'].forEach(exp => {
          const targets = this.morphTargetMap.get(exp);
          if (targets) {
            targets.forEach(target => {
              target.mesh.morphTargetInfluences[target.index] = 0;
            });
          }
        });
    }
  }
  
  /**
   * 执行一次眨眼动画
   */
  blink() {
    if (this.isBlinking) return;
    
    this.isBlinking = true;
    this.blinkStartTime = Date.now();
    
    // 执行闭眼
    const blinkTargets = this.morphTargetMap.get('eyeBlink');
    if (blinkTargets) {
      blinkTargets.forEach(target => {
        target.mesh.morphTargetInfluences[target.index] = this.config.blinkIntensity;
      });
    }
    
    // 设置定时器恢复睁眼
    setTimeout(() => {
      if (blinkTargets) {
        blinkTargets.forEach(target => {
          target.mesh.morphTargetInfluences[target.index] = 0;
        });
      }
      this.isBlinking = false;
    }, this.config.blinkDuration);
  }
  
  /**
   * 启动自动眨眼循环
   */
  startAutoBlink() {
    if (this.blinkTimer) {
      clearInterval(this.blinkTimer);
    }
    
    this.blinkTimer = setInterval(() => {
      // 说话时不眨眼（可选）
      if (!this.isSpeaking) {
        this.blink();
      }
    }, this.config.blinkInterval);
  }
  
  /**
   * 停止自动眨眼
   */
  stopAutoBlink() {
    if (this.blinkTimer) {
      clearInterval(this.blinkTimer);
      this.blinkTimer = null;
    }
  }
  
  // ============================================================
  // 音频处理方法（真实音频分析）
  // ============================================================
  
  /**
   * 从音频文件分析并同步唇形
   * @param {string} audioUrl - 音频文件URL
   * @param {Function} onProgress - 进度回调
   */
  async analyzeAudioFile(audioUrl, onProgress) {
    try {
      // 获取音频数据
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      
      // 创建音频上下文
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      // 解码音频
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      // 分析音量数据
      const volumeData = this.extractVolumeData(audioBuffer);
      
      // 播放并同步
      this.playWithSync(audioBuffer, volumeData, onProgress);
      
      return volumeData;
      
    } catch (error) {
      console.error('音频分析失败:', error);
      return null;
    }
  }
  
  /**
   * 从音频缓冲区提取音量数据
   * @param {AudioBuffer} audioBuffer - 音频缓冲区
   * @returns {Array} 音量强度数组
   */
  extractVolumeData(audioBuffer) {
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const duration = audioBuffer.duration;
    
    // 每帧约33ms（30fps）
    const frameInterval = 0.033;
    const framesCount = Math.floor(duration / frameInterval);
    const samplesPerFrame = Math.floor(sampleRate * frameInterval);
    
    const volumeData = [];
    
    for (let i = 0; i < framesCount; i++) {
      const start = i * samplesPerFrame;
      const end = Math.min(start + samplesPerFrame, channelData.length);
      
      let maxAmplitude = 0;
      for (let j = start; j < end; j++) {
        maxAmplitude = Math.max(maxAmplitude, Math.abs(channelData[j]));
      }
      
      // 归一化到0-1
      const intensity = Math.min(1, maxAmplitude * 1.5);
      volumeData.push(intensity);
    }
    
    return volumeData;
  }
  
  /**
   * 播放音频并同步唇形
   * @param {AudioBuffer} audioBuffer - 音频缓冲区
   * @param {Array} volumeData - 音量数据
   * @param {Function} onProgress - 进度回调
   */
  async playWithSync(audioBuffer, volumeData, onProgress) {
    // 创建音频源
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    
    // 创建分析器
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    
    source.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);
    
    // 启动音频
    source.start();
    this.audioSource = source;
    this.isAnalyzing = true;
    
    // 实时更新唇形
    const startTime = this.audioContext.currentTime;
    const duration = audioBuffer.duration;
    let lastFrame = 0;
    
    const updateLipSync = () => {
      if (!this.isAnalyzing) return;
      
      const elapsed = this.audioContext.currentTime - startTime;
      const progress = elapsed / duration;
      
      // 获取当前帧的音量强度
      const frameIndex = Math.floor(progress * volumeData.length);
      if (frameIndex < volumeData.length && frameIndex !== lastFrame) {
        const intensity = volumeData[frameIndex];
        this.update(intensity);
        lastFrame = frameIndex;
        
        // 进度回调
        if (onProgress) {
          onProgress(progress, intensity);
        }
      }
      
      if (elapsed < duration) {
        requestAnimationFrame(updateLipSync);
      } else {
        this.stop();
      }
    };
    
    updateLipSync();
    
    // 播放结束清理
    source.onended = () => {
      this.stop();
      this.update(0);
    };
  }
  
  /**
   * 从麦克风实时分析并同步唇形
   * @param {Function} onVolumeUpdate - 音量更新回调
   */
  async startMicrophoneAnalysis(onVolumeUpdate) {
    try {
      // 请求麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // 创建音频上下文
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      // 创建音频源
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      
      source.connect(this.analyser);
      
      // 启动音量监测
      this.isAnalyzing = true;
      this.monitorMicrophoneVolume(onVolumeUpdate);
      
      console.log('🎤 麦克风已启动，开始实时唇形同步');
      return true;
      
    } catch (error) {
      console.error('麦克风访问失败:', error);
      return false;
    }
  }
  
  /**
   * 监测麦克风音量
   * @param {Function} onVolumeUpdate - 音量更新回调
   */
  monitorMicrophoneVolume(onVolumeUpdate) {
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    
    const updateVolume = () => {
      if (!this.isAnalyzing) return;
      
      this.analyser.getByteTimeDomainData(dataArray);
      
      // 计算音量强度
      let maxSample = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const v = (dataArray[i] - 128) / 128;
        maxSample = Math.max(maxSample, Math.abs(v));
      }
      
      const volume = Math.min(1, maxSample * 1.5);
      
      // 更新唇形
      this.update(volume);
      
      // 回调
      if (onVolumeUpdate) {
        onVolumeUpdate(volume);
      }
      
      requestAnimationFrame(updateVolume);
    };
    
    updateVolume();
  }
  
  /**
   * 停止音频分析
   */
  stop() {
    if (this.audioSource) {
      try {
        this.audioSource.stop();
      } catch (e) {}
      this.audioSource = null;
    }
    
    this.isAnalyzing = false;
    this.update(0);
  }
  
  // ============================================================
  // 模拟方法（用于测试，无需音频文件）
  // ============================================================
  
  /**
   * 模拟说话（根据文本生成随机音量）
   * @param {string} text - 要模拟的文本
   * @param {Function} onComplete - 完成回调
   */
  simulateSpeech(text, onComplete) {
    if (!text) return;
    
    // 根据文本长度计算持续时间
    const duration = Math.min(text.length * 0.05, 3);
    const interval = 50; // 每50ms更新一次
    const frames = Math.floor(duration * 1000 / interval);
    
    let frame = 0;
    const timer = setInterval(() => {
      // 生成随机强度（模拟语音）
      let intensity = 0;
      
      if (frame < frames) {
        // 说话中：随机强度0.2-0.8
        intensity = 0.2 + Math.random() * 0.6;
      } else {
        // 结束：强度归零
        intensity = 0;
        clearInterval(timer);
        if (onComplete) onComplete();
      }
      
      this.update(intensity);
      frame++;
      
    }, interval);
    
    return timer;
  }
  
  /**
   * 模拟特定音素序列（更真实的模拟）
   * @param {Array} phonemes - 音素数组
   * @param {Function} onComplete - 完成回调
   */
  simulatePhonemes(phonemes, onComplete) {
    if (!phonemes || phonemes.length === 0) return;
    
    let index = 0;
    const phonemeDuration = 150; // 每个音素150ms
    
    const timer = setInterval(() => {
      if (index >= phonemes.length) {
        clearInterval(timer);
        this.update(0);
        if (onComplete) onComplete();
        return;
      }
      
      const phoneme = phonemes[index];
      let intensity = 0;
      
      // 根据音素设置不同的强度
      switch(phoneme) {
        case 'a': case 'o': case 'u':
          intensity = 0.8;  // 元音，大开口
          break;
        case 'e': case 'i':
          intensity = 0.5;  // 元音，小开口
          break;
        case 'b': case 'p': case 'm':
          intensity = 0.3;  // 爆破音，短暂闭合
          break;
        default:
          intensity = 0.2;
      }
      
      this.update(intensity);
      index++;
      
    }, phonemeDuration);
    
    return timer;
  }
  
  // ============================================================
  // 调试和工具方法
  // ============================================================
  
  /**
   * 获取统计信息
   */
  getStats() {
    return {
      ...this.stats,
      isSpeaking: this.isSpeaking,
      currentIntensity: this.currentIntensity,
      targetIntensity: this.targetIntensity,
      morphTargetsCount: this.morphTargets.length,
      isAnalyzing: this.isAnalyzing
    };
  }
  
  /**
   * 重置所有Morph Targets
   */
  reset() {
    this.currentIntensity = 0;
    this.targetIntensity = 0;
    this.isSpeaking = false;
    
    // 重置所有Morph Targets
    this.morphTargets.forEach(target => {
      for (let i = 0; i < target.influences.length; i++) {
        target.influences[i] = 0;
      }
    });
  }
  
  /**
   * 销毁控制器
   */
  destroy() {
    this.stopAutoBlink();
    this.stop();
    this.model = null;
    this.morphTargets = [];
    this.morphTargetMap.clear();
  }
}

// ============================================================
// 导出辅助工具函数
// ============================================================

/**
 * 创建测试音素序列（用于演示）
 * @param {string} text - 文本
 * @returns {Array} 音素数组
 */
export function textToPhonemes(text) {
  const phonemes = [];
  const chars = text.split('');
  
  for (const char of chars) {
    if (/[aeiouáéíóú]/i.test(char)) {
      phonemes.push('a');
    } else if (/[bcdfghjklmnpqrstvwxyz]/i.test(char)) {
      phonemes.push('b');
    } else {
      phonemes.push('sil');
    }
  }
  
  return phonemes;
}

/**
 * 预定义的测试句子
 */
export const TEST_SENTENCES = [
  "你好，我是数字人助手。",
  "今天天气真不错。",
  "很高兴见到你。",
  "让我们一起探索AI的世界。",
  "唇形同步功能正在运行。"
];

// ============================================================
// 导出默认配置
// ============================================================

export default LipSyncController;