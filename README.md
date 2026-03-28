# 3D数字人交互系统

一个基于Three.js的3D数字人Web应用，支持多角色切换、实时对话、语音合成和唇形同步。本项目提供了完整的前端框架和API接口规范，可快速集成TTS、LLM和唇形同步模块。

## ✨ 功能特性

- 🎭 **双数字人角色** - 支持旗袍女士、商务男士两个3D角色，可自由切换
- 🔄 **角色切换** - 点击侧边栏即可切换不同数字人，每个角色可独立配置
- 💬 **AI对话** - 集成大语言模型(LLM)，实现智能对话交互
- 🎤 **语音合成** - TTS文字转语音，支持实时音量反馈
- 👄 **唇形同步** - 根据音频驱动3D模型嘴部运动，提升真实感
- 🖱️ **交互控制** - 鼠标拖拽旋转、右键平移、滚轮缩放
- 📱 **响应式设计** - 适配桌面端和移动端
- 🎨 **专业光照** - 多光源组合照明，人物立体感强

## 🛠️ 技术栈

### 前端技术

| 技术       | 版本 | 用途                   |
| ---------- | ---- | ---------------------- |
| Three.js   | r128 | 3D渲染引擎             |
| ES6+       | -    | 现代JavaScript语法     |
| CSS3       | -    | 样式设计（毛玻璃效果） |
| ES Modules | -    | 模块化代码组织         |

### 模型格式

| 格式 | 说明                                     |
| ---- | ---------------------------------------- |
| GLB  | GLTF二进制格式，体积小，加载快           |
| glTF | 标准3D模型格式，支持动画、材质、变形目标 |

### 第三方库

- **GLTFLoader** - 加载GLB/glTF模型
- **OrbitControls** - 相机轨道控制
- **Web Audio API** - 音频分析和处理

## 📁 项目结构

```txt
digital-human-project/
├── index.html # 主入口页面
├── README.md # 项目文档（本文件）
├── css/
│ └── style.css # 样式文件（Kinecho风格）
├── js/
│ ├── main.js # 主逻辑文件（3D渲染、交互）
│ ├── api/ # API接口模块（需集成）
│ │ ├── llmApi.js # 大语言模型接口
│ │ ├── ttsApi.js # 语音合成接口
│ │ └── lipSync.js # 唇形同步模块
│ └── utils/
│ └── helpers.js # 工具函数（可选）
├── models/ # 3D模型文件目录
│ ├── character1.glb # 旗袍女士模型
│ └── character2.glb # 商务男士模型
├── assets/ # 静态资源
│ ├── avatar1.jpg # 角色1头像
│ ├── avatar2.jpg # 角色2头像
│ └── logo.svg # 应用Logo
└── server.js # 本地开发服务器（可选）
```

## 🚀 快速启动

### 环境要求

- Node.js 14+ (可选，用于本地服务器)
- 现代浏览器 (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- 支持WebGL的显卡

### 启动命令

```bash
npx serve
```

## 🔌 API接口集成指南

### 概述

本项目提供了完整的API接口规范，支持集成以下服务：

1. **大语言模型(LLM)** - 智能对话生成
2. **语音合成(TTS)** - 文字转语音
3. **唇形同步** - 音频驱动嘴型

### 1. 大语言模型接口集成

#### 接口文件位置

```
js/api/llmApi.js
```

#### 接口规范

**端点**: `POST /api/chat`

**请求格式**:

json

```
{
  "message": "你好，今天天气怎么样？",
  "characterId": 0,
  "sessionId": "session_xxx",
  "context": [
    { "role": "user", "content": "之前的消息", "timestamp": 1234567890 },
    { "role": "assistant", "content": "之前的回复", "timestamp": 1234567890 }
  ],
  "temperature": 0.7,
  "maxTokens": 500,
  "stream": false
}
```

**响应格式**:

json

```
{
  "success": true,
  "reply": "今天天气晴朗，温度25度，适合出行。",
  "timestamp": 1699000000000,
  "sessionId": "session_xxx",
  "usage": {
    "promptTokens": 120,
    "completionTokens": 15,
    "totalTokens": 135
  }
}
```

#### 后端实现示例（Node.js/Express）

javascript

```
// server.js - LLM接口示例
const express = require('express');
const app = express();
app.use(express.json());

// LLM接口
app.post('/api/chat', async (req, res) => {
  const { message, characterId, sessionId, context } = req.body;
  
  try {
    // 调用OpenAI API或其他大模型服务
    const response = await callLLMService(message, characterId, context);
  
    res.json({
      success: true,
      reply: response.text,
      timestamp: Date.now(),
      sessionId: sessionId
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 调用大模型服务
async function callLLMService(message, characterId, context) {
  // 根据角色ID选择不同的系统提示词
  const systemPrompts = {
    0: "你是一位优雅知性的旗袍女士，说话温柔得体，喜欢用古典诗词。",
    1: "你是一位专业干练的商务男士，说话简洁明了，注重效率。"
  };
  
  // 示例：调用OpenAI API
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompts[characterId] },
        ...context,
        { role: 'user', content: message }
      ],
      temperature: 0.7,
      max_tokens: 500
    })
  });
  
  const data = await response.json();
  return { text: data.choices[0].message.content };
}

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

#### 前端集成示例

javascript

```
// 在 main.js 中替换 sendMessage 函数
import { getAIResponse } from './api/llmApi.js';

async function sendMessage() {
  const userMessage = getUserInput();
  
  try {
    // 调用LLM接口
    const aiReply = await getAIResponse(
      userMessage, 
      currentCharacterIndex,
      { temperature: 0.7 }
    );
  
    // 显示回复
    addMessage(aiReply, 'bot');
  
    // 调用TTS播放语音
    await textToSpeech(aiReply, currentCharacterIndex, (volume) => {
      updateLipSync({ intensity: volume }, currentModel);
    });
  
  } catch (error) {
    console.error('对话失败:', error);
  }
}
```

### 2. 语音合成接口集成

#### 接口文件位置

```
js/api/ttsApi.js
```

#### 接口规范

**端点**: `POST /api/tts`

**请求格式**:

json

```
{
  "text": "你好，我是AI数字人助手。",
  "characterId": 0,
  "voice": "zh-CN-XiaoxiaoNeural",
  "rate": 1.0,
  "pitch": 1.0,
  "format": "mp3",
  "sampleRate": 24000
}
```

**响应格式**:

json

```
{
  "success": true,
  "audioUrl": "/audio/response_12345.mp3",
  "duration": 2.5,
  "volumeData": [0.2, 0.5, 0.8, 0.6, 0.3],
  "format": "mp3"
}
```

#### 后端实现示例（Python/FastAPI）

python

```
# server.py - TTS接口示例
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
import edge_tts
import tempfile
import numpy as np

app = FastAPI()

class TTSRequest(BaseModel):
    text: str
    characterId: int
    voice: str = "zh-CN-XiaoxiaoNeural"
    rate: float = 1.0
    pitch: float = 1.0

@app.post("/api/tts")
async def text_to_speech(request: TTSRequest):
    try:
        # 使用Edge TTS或Azure TTS服务
        voice_map = {
            0: "zh-CN-XiaoxiaoNeural",  # 女声
            1: "zh-CN-YunxiNeural"       # 男声
        }
      
        voice = voice_map.get(request.characterId, request.voice)
      
        # 生成语音
        communicate = edge_tts.Communicate(
            request.text, 
            voice,
            rate=f"{int(request.rate * 100)}+%",
            pitch=f"{int(request.pitch * 100)}+Hz"
        )
      
        # 保存临时文件
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
            await communicate.save(tmp.name)
            audio_file = tmp.name
      
        # 分析音量数据
        volume_data = analyze_volume(audio_file)
      
        return {
            "success": True,
            "audioUrl": f"/audio/{audio_file}",
            "duration": get_audio_duration(audio_file),
            "volumeData": volume_data,
            "format": "mp3"
        }
      
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def analyze_volume(audio_file):
    """分析音频音量强度"""
    import librosa
    y, sr = librosa.load(audio_file)
  
    # 每100ms采样一次
    hop_length = int(sr * 0.1)
    rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
  
    # 归一化到0-1
    rms_normalized = rms / np.max(rms)
  
    return rms_normalized.tolist()

@app.get("/audio/{filename}")
async def get_audio(filename: str):
    return FileResponse(filename, media_type="audio/mpeg")
```

### 3. 唇形同步模块集成

#### 模块文件位置

```
js/api/lipSync.js
```

#### 工作原理

唇形同步通过以下步骤实现：

1. 分析音频音量强度
2. 将强度值映射到模型的Morph Targets
3. 实时更新模型嘴部形态

#### 模型要求

GLB模型需包含以下Morph Targets：

- `jawOpen` - 下巴打开
- `mouthOpen` - 嘴巴张开
- `viseme_AA` - 大开口音素
- `viseme_OO` - 圆唇音素
- `viseme_EE` - 展唇音素

#### 前端集成示例

javascript

```
// 在 main.js 中集成唇形同步
import { LipSyncController } from './api/lipSync.js';

// 创建唇形同步控制器
const lipSyncController = new LipSyncController();

// 模型加载完成后初始化
function switchToCharacter(index) {
  if (models[index]) {
    currentModel = models[index];
    scene.add(currentModel);
  
    // 初始化唇形同步
    lipSyncController.init(currentModel);
  }
}

// 在TTS播放时实时更新
async function playTTS(text) {
  await textToSpeech(text, currentCharacterIndex, (volume) => {
    // 实时更新唇形
    lipSyncController.update(volume);
  });
}
```

### 4. 完整数据流

text

```
用户输入文本
    ↓
[LLM模块] → AI回复文本
    ↓
[TTS模块] → 生成音频 + 音量数据
    ↓
[音频播放] → 实时音量强度
    ↓
[唇形同步模块] → 驱动模型嘴型
```

## 📝 配置文件说明

### 模型配置 (CONFIG.models)

| 参数       | 类型    | 说明         | 示例                           |
| :--------- | :------ | :----------- | :----------------------------- |
| path       | string  | 模型文件路径 | `'../models/character1.glb'` |
| name       | string  | 显示名称     | `'旗袍女士'`                 |
| scale      | number  | 缩放比例     | `1.0`                        |
| position.y | number  | Y轴位置偏移  | `-1.0`                       |
| rotation.y | number  | Y轴旋转弧度  | `Math.PI`                    |
| isFemale   | boolean | 性别标识     | `true`                       |

### 光照配置 (LIGHTING_CONFIG)

| 参数                | 说明       | 推荐值  |
| :------------------ | :--------- | :------ |
| ambient.intensity   | 环境光强度 | 0.6-0.8 |
| mainLight.intensity | 主光源强度 | 1.0-1.5 |
| fillLight.intensity | 补光强度   | 0.3-0.6 |
| rimLight.intensity  | 轮廓光强度 | 0.4-0.7 |

### 相机配置 (CONFIG.camera)

| 参数       | 说明      | 推荐值  |
| :--------- | :-------- | :------ |
| position.x | X轴位置   | 0       |
| position.y | Y轴位置   | 0.5     |
| position.z | Z轴位置   | 3.0-4.0 |
| target.y   | 注视点Y轴 | 0.5     |

## 🎯 模型准备指南

### 使用Blender准备GLB模型

1. **导出前检查**:

   - 模型面向：Z轴正向（面向相机）
   - 单位：米制
   - 坐标原点：脚下中心点
2. **添加Morph Targets（用于唇形同步）**:

   text

   ```
   1. 选择头部网格
   2. 进入"物体数据属性"
   3. 在"形态键"中添加新键
   4. 创建"jawOpen"、"mouthOpen"等形态键
   5. 调整顶点位置
   ```
3. **导出设置**:

   - 格式：glTF 2.0 (.glb)
   - 包含：材质、动画、变形
   - 纹理：JPEG/PNG

### 模型优化建议

javascript

```
// 模型面数优化
- 高模：50,000 - 100,000 面
- 中模：20,000 - 50,000 面（推荐）
- 低模：< 20,000 面

// 纹理优化
- 尺寸：512x512 或 1024x1024
- 格式：JPEG (漫反射) + PNG (透明度)
- 压缩：使用纹理压缩工具
```

## 🐛 常见问题

### Q1: 模型加载失败？

**A**: 检查以下几点：

- 模型文件路径是否正确（相对于HTML文件）
- GLB文件是否损坏（可用glTF Viewer验证）
- 浏览器控制台是否有CORS错误（使用本地服务器）

### Q2: 模型太暗？

**A**: 调整光照强度：

javascript

```
// 在 LIGHTING_CONFIG 中增加强度
ambient: { intensity: 1.0 },      // 提高环境光
mainLight: { intensity: 1.5 }     // 提高主光源
```

### Q3: 女生模型背对相机？

**A**: 已在配置中添加旋转：

javascript

```
rotation: { y: Math.PI }  // 旋转180度
```

### Q4: 唇形同步不工作？

**A**: 确认模型包含Morph Targets：

javascript

```
// 在控制台查看
console.log(currentModel);
// 检查网格对象的 morphTargetDictionary 属性
```

### Q5: TTS播放没声音？

**A**: 检查：

- 浏览器是否允许自动播放（需要用户交互）
- 音频格式是否支持（推荐MP3）
- 后端服务是否正常运行

### Q6: 如何支持更多角色？

**A**: 在配置中添加新模型：

javascript

```
models: [
  // 现有角色...
  { 
    path: '../models/character3.glb',
    name: '新角色',
    scale: 1.0,
    position: { y: -1.0 },
    rotation: { y: 0 }
  }
]
```
