/**
 * 3D数字人交互系统 - 主逻辑文件
 * 功能：加载3D模型、控制相机、处理用户交互、对接AI服务
 * 作者：Your Team
 * 日期：2026-03-28
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ============================================================
// 配置项 - 可根据实际需求修改
// ============================================================

/**
 * 模型配置
 * 包含两个数字人模型的路径、位置、旋转等参数
 */
const CONFIG = {
  models: [
    { 
      path: '../models/character1.glb',     // 模型文件路径（相对于HTML文件）
      name: '旗袍女士',                      // 显示名称
      scale: 1.0,                           // 缩放比例（1为原始大小）
      position: { y: -2.0 },                // Y轴位置偏移（负数向下移动）
      rotation: { y: Math.PI },             // 旋转角度（女生需要旋转180度面向相机）
      isFemale: true                        // 性别标识（用于特殊处理）
    },
    { 
      path: '../models/character2.glb', 
      name: '商务男士', 
      scale: 2.0, 
      position: { y: -2.3 },
      rotation: { y: 0 },                   // 男生默认朝向正确，无需旋转
      isFemale: false
    }
  ],
  camera: { 
    position: { x: 0, y: 0.5, z: 3.5 },     // 相机初始位置（x:左右, y:上下, z:远近）
    target: { x: 0, y: 0.5, z: 0 }          // 相机注视点（模型中心位置）
  },
  controls: { 
    minDistance: 1.5,                       // 最小缩放距离（不能太近）
    maxDistance: 8,                         // 最大缩放距离（不能太远）
    rotateSpeed: 1.0,                       // 旋转速度
    zoomSpeed: 1.2                          // 缩放速度
  }
};

/**
 * 光照配置 - 白天模式（明亮清晰）
 * 通过多光源组合实现专业级的人物照明效果
 */
const LIGHTING_CONFIG = {
  // 环境光 - 均匀照亮所有表面，避免完全黑暗的区域
  ambient: { 
    color: 0xffffff,      // 纯白色光
    intensity: 0.8        // 强度0.8（适中，不会过曝）
  },
  // 主光源 - 方向光，产生主要阴影和立体感
  mainLight: { 
    color: 0xfff5e6,      // 暖白色（模拟自然光）
    intensity: 1.2,       // 强度较高，保证人物明亮
    position: [5, 8, 4]   // 从右前上方照射（x右, y上, z前）
  },
  // 辅助光源 - 从背面补充暖色光，增强轮廓
  backLight: { 
    color: 0xffaa66,      // 暖橙色
    intensity: 0.6,
    position: [-2, 3, -4] // 从左后方照射
  },
  // 补光 - 从侧面补充冷色光，增加画面层次
  fillLight: { 
    color: 0x88aaff,      // 冷蓝色
    intensity: 0.5,
    position: [-3, 2, 2]  // 从左前方照射
  },
  // 轮廓光 - 增强人物边缘，突出立体感
  rimLight: { 
    color: 0xffaa88,      // 暖橙色
    intensity: 0.5,
    position: [2, 2.5, -3] // 从右后方照射
  },
  // 地面补光 - 从下往上照亮，减少下巴阴影
  groundLight: { 
    color: 0x88aaff,      // 冷蓝色
    intensity: 0.3,
    position: [0, -1, 0]  // 从正下方照射
  },
  // 场景背景色
  backgroundColor: 0xfffff0,  // （淡黄色，模拟室内环境）
  // 雾效颜色（增加景深感）
  fogColor: 0x0a0a2a,
  // 辅助网格线颜色
  gridColor: 0x88aaff,
  // 网格线透明度
  gridOpacity: 0.3
};

// ============================================================
// 全局变量声明
// ============================================================

let scene;              // Three.js场景对象（容器）
let camera;             // 相机对象（视角）
let renderer;           // 渲染器对象（绘制到屏幕）
let controls;           // 轨道控制器（处理鼠标/触摸交互）
let currentModel;       // 当前显示的3D模型
let currentCharacterIndex = 0;  // 当前角色索引（0:女生, 1:男生）
let models = [];        // 存储加载的两个模型
let mixer;              // 动画混合器（用于播放模型动画）
let currentAction;      // 当前播放的动画

// 灯光对象引用（用于后续调整）
let lights = {
  ambient: null,        // 环境光
  mainLight: null,      // 主光源
  backLight: null,      // 背光
  fillLight: null,      // 补光
  rimLight: null,       // 轮廓光
  groundLight: null,    // 地面补光
  gridHelper: null      // 辅助网格线
};

// ============================================================
// 初始化函数 - 应用入口
// ============================================================

/**
 * 初始化整个3D场景
 * 包括：创建场景、相机、渲染器、灯光、控制器
 */
function init() {
  console.log('🚀 初始化3D场景...');
  
  // ---------- 1. 创建场景 ----------
  // 场景是所有3D对象的容器
  scene = new THREE.Scene();
  scene.background = new THREE.Color(LIGHTING_CONFIG.backgroundColor);  // 设置背景色
  scene.fog = new THREE.FogExp2(LIGHTING_CONFIG.fogColor, 0.008);       // 添加雾效，增强景深

  // ---------- 2. 创建相机 ----------
  // 透视相机：视角60度，宽高比自动，近平面0.1，远平面1000
  camera = new THREE.PerspectiveCamera(
    45,                                     // 视野角度（越小越聚焦）
    window.innerWidth / window.innerHeight, // 宽高比（自动适配窗口）
    0.1,                                    // 近裁剪面（相机能看到的最小距离）
    1000                                    // 远裁剪面（相机能看到的最近距离）
  );
  // 设置相机初始位置
  camera.position.set(
    CONFIG.camera.position.x,
    CONFIG.camera.position.y,
    CONFIG.camera.position.z
  );

  // ---------- 3. 创建渲染器 ----------
  // 渲染器负责将3D场景绘制到canvas上
  renderer = new THREE.WebGLRenderer({ 
    antialias: true,      // 开启抗锯齿（让边缘更平滑）
    alpha: false          // 背景不透明
  });
  renderer.setSize(window.innerWidth, window.innerHeight);     // 设置渲染尺寸
  renderer.setPixelRatio(window.devicePixelRatio);             // 适配高清屏幕（Retina等）
  renderer.shadowMap.enabled = true;                           // 开启阴影映射
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;            // 软阴影（更自然）
  renderer.toneMapping = THREE.ACESFilmicToneMapping;          // 色调映射（提升色彩表现）
  renderer.toneMappingExposure = 1.2;                          // 曝光度（让画面更亮）
  document.body.appendChild(renderer.domElement);              // 将canvas添加到页面

  // ---------- 4. 初始化灯光系统 ----------
  initLighting();

  // ---------- 5. 创建轨道控制器 ----------
  // 控制器让用户可以用鼠标/触摸来旋转、缩放、平移视角
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;           // 启用惯性效果（平滑移动）
  controls.dampingFactor = 0.05;           // 惯性系数（越小越滑）
  controls.enableZoom = true;              // 允许缩放
  controls.enablePan = true;               // 允许平移
  controls.zoomSpeed = CONFIG.controls.zoomSpeed;      // 缩放速度
  controls.rotateSpeed = CONFIG.controls.rotateSpeed;  // 旋转速度
  controls.panSpeed = 0.8;                 // 平移速度
  controls.target.set(                     // 控制器焦点（相机看向的位置）
    CONFIG.camera.target.x,
    CONFIG.camera.target.y,
    CONFIG.camera.target.z
  );
  controls.minDistance = CONFIG.controls.minDistance;    // 最小缩放距离
  controls.maxDistance = CONFIG.controls.maxDistance;    // 最大缩放距离
  controls.maxPolarAngle = Math.PI / 2.2;    // 限制俯视角度（避免看到模型头顶）

  // ---------- 6. 加载3D模型 ----------
  loadAllModels();

  // ---------- 7. 绑定UI交互事件 ----------
  bindUIEvents();

  // ---------- 8. 启动动画循环 ----------
  animate();

  // ---------- 9. 监听窗口大小变化 ----------
  window.addEventListener('resize', onWindowResize);

  console.log('✅ 初始化完成');
}

// ============================================================
// 灯光系统初始化
// ============================================================

/**
 * 创建并配置所有光源
 * 通过多光源组合实现专业的人物照明效果
 */
function initLighting() {
  console.log('💡 初始化灯光系统...');

  // 1. 环境光 - 均匀照亮所有表面
  // 作用：避免完全黑暗的区域，提供基础照明
  lights.ambient = new THREE.AmbientLight(
    LIGHTING_CONFIG.ambient.color,
    LIGHTING_CONFIG.ambient.intensity
  );
  scene.add(lights.ambient);

  // 2. 主光源 - 方向光（带阴影）
  // 作用：产生主要照明和阴影，塑造人物立体感
  lights.mainLight = new THREE.DirectionalLight(
    LIGHTING_CONFIG.mainLight.color,
    LIGHTING_CONFIG.mainLight.intensity
  );
  lights.mainLight.position.set(...LIGHTING_CONFIG.mainLight.position);
  lights.mainLight.castShadow = true;           // 产生阴影
  lights.mainLight.receiveShadow = true;        // 接收阴影
  lights.mainLight.shadow.mapSize.width = 1024; // 阴影贴图宽度（质量）
  lights.mainLight.shadow.mapSize.height = 1024;
  lights.mainLight.shadow.camera.near = 0.5;    // 阴影相机近平面
  lights.mainLight.shadow.camera.far = 12;      // 阴影相机远平面
  lights.mainLight.shadow.camera.left = -5;     // 阴影范围左边界
  lights.mainLight.shadow.camera.right = 5;     // 右边界
  lights.mainLight.shadow.camera.top = 5;       // 上边界
  lights.mainLight.shadow.camera.bottom = -5;   // 下边界
  scene.add(lights.mainLight);

  // 3. 背光 - 从后方照射
  // 作用：勾勒人物轮廓，增强立体感
  lights.backLight = new THREE.DirectionalLight(
    LIGHTING_CONFIG.backLight.color,
    LIGHTING_CONFIG.backLight.intensity
  );
  lights.backLight.position.set(...LIGHTING_CONFIG.backLight.position);
  scene.add(lights.backLight);

  // 4. 补光 - 从侧面照射
  // 作用：补充暗部细节，增加画面层次
  lights.fillLight = new THREE.PointLight(
    LIGHTING_CONFIG.fillLight.color,
    LIGHTING_CONFIG.fillLight.intensity
  );
  lights.fillLight.position.set(...LIGHTING_CONFIG.fillLight.position);
  scene.add(lights.fillLight);

  // 5. 轮廓光 - 强化边缘
  // 作用：让人物从背景中脱颖而出
  lights.rimLight = new THREE.PointLight(
    LIGHTING_CONFIG.rimLight.color,
    LIGHTING_CONFIG.rimLight.intensity
  );
  lights.rimLight.position.set(...LIGHTING_CONFIG.rimLight.position);
  scene.add(lights.rimLight);

  // 6. 地面补光 - 从下往上照射
  // 作用：减少下巴和脖子下方的阴影
  lights.groundLight = new THREE.PointLight(
    LIGHTING_CONFIG.groundLight.color,
    LIGHTING_CONFIG.groundLight.intensity
  );
  lights.groundLight.position.set(...LIGHTING_CONFIG.groundLight.position);
  scene.add(lights.groundLight);

  // 7. 辅助网格地面 - 帮助判断空间位置（半透明）
  // 作用：提供空间参考，方便观察模型位置
  lights.gridHelper = new THREE.GridHelper(
    20,                           // 网格大小
    20,                           // 网格分段数
    LIGHTING_CONFIG.gridColor,    // 中心线颜色
    0x335588                      // 网格线颜色
  );
  lights.gridHelper.position.y = -1.5;  // 向下移动，避免遮挡模型
  lights.gridHelper.material.transparent = true;  // 启用透明
  lights.gridHelper.material.opacity = LIGHTING_CONFIG.gridOpacity; // 透明度
  scene.add(lights.gridHelper);

  console.log('✅ 灯光系统初始化完成');
}

// ============================================================
// 模型加载
// ============================================================

/**
 * 加载所有3D模型
 * 使用GLTFLoader加载.glb格式的模型文件
 */
function loadAllModels() {
  console.log('📦 开始加载3D模型...');
  const loader = new GLTFLoader();

  // 遍历配置中的每个模型
  CONFIG.models.forEach((modelConfig, index) => {
    loader.load(
      modelConfig.path,  // 模型文件路径
      
      // 加载成功回调
      (gltf) => {
        const model = gltf.scene;  // 获取模型的场景对象
        
        // 存储模型元数据
        model.userData = { 
          name: modelConfig.name, 
          index: index,
          rotation: modelConfig.rotation
        };
        
        // 设置模型属性
        model.scale.setScalar(modelConfig.scale);           // 缩放
        model.position.y = modelConfig.position.y;          // Y轴位置
        
        // 设置初始旋转（修复女生背对相机的问题）
        if (modelConfig.rotation) {
          model.rotation.set(
            modelConfig.rotation.x || 0,
            modelConfig.rotation.y || 0,
            modelConfig.rotation.z || 0
          );
        }
        
        // 遍历模型的所有部分，启用阴影并优化材质
        model.traverse((node) => {
          if (node.isMesh) {  // 如果是网格对象（可渲染的物体）
            // 启用阴影
            node.castShadow = true;    // 产生阴影
            node.receiveShadow = true; // 接收阴影
            
            // 优化材质属性，让模型更亮更清晰
            if (node.material) {
              // 处理单个材质或材质数组
              const materials = Array.isArray(node.material) ? node.material : [node.material];
              materials.forEach(mat => {
                // 降低粗糙度（让表面更光滑，反光更强）
                mat.roughness = Math.max(0.3, (mat.roughness || 0.5) * 0.8);
                // 提高金属度（增加质感）
                mat.metalness = Math.min(0.8, (mat.metalness || 0) * 1.2);
              });
            }
          }
        });
        
        // 存储到模型数组
        models[index] = model;
        
        // 如果是第一个模型（索引0），立即显示
        if (index === currentCharacterIndex) {
          switchToCharacter(index);
        }
        
        console.log(`✅ 模型加载成功: ${modelConfig.name}`);
        
        // 如果是女生模型，输出提示信息
        if (modelConfig.isFemale) {
          console.log(`👩 女生模型已加载，已自动旋转180度面向相机`);
        }
      },
      
      // 加载进度回调
      (xhr) => {
        const percent = (xhr.loaded / xhr.total * 100).toFixed(1);
        console.log(`加载中 ${modelConfig.name}: ${percent}%`);
      },
      
      // 加载失败回调
      (error) => {
        console.error(`❌ 模型加载失败: ${modelConfig.name}`, error);
        showNotification(`加载${modelConfig.name}失败，请检查文件路径`, 'error');
      }
    );
  });
}

// ============================================================
// 角色切换逻辑
// ============================================================

/**
 * 切换到指定索引的角色
 * @param {number} index - 角色索引（0:女生, 1:男生）
 */
function switchToCharacter(index) {
  // 移除当前模型
  if (currentModel) {
    scene.remove(currentModel);
    
    // 停止并清理动画
    if (mixer) {
      mixer.stopAllAction();
      mixer = null;
    }
  }
  
  // 检查模型是否已加载
  if (models[index]) {
    currentModel = models[index];
    scene.add(currentModel);                    // 添加到场景
    currentCharacterIndex = index;              // 更新当前索引
    
    // 更新UI高亮状态
    document.querySelectorAll('.character-card').forEach((card, i) => {
      if (i === index) {
        card.classList.add('active');           // 添加高亮样式
      } else {
        card.classList.remove('active');        // 移除高亮样式
      }
    });
    
    // 重置相机视角（可选）
    resetCamera();
    
    // 设置模型动画（如果模型包含动画）
    setupAnimations();
    
    console.log(`🎭 切换到角色: ${CONFIG.models[index].name}`);
    
    // 显示切换提示
    showNotification(`已切换到${CONFIG.models[index].name}`, 'info');
  } else {
    console.warn(`角色 ${index} 尚未加载完成`);
    showNotification('角色加载中，请稍后...', 'info');
  }
}

/**
 * 设置模型动画
 * 如果模型包含动画，自动播放第一个动画
 */
function setupAnimations() {
  if (currentModel && currentModel.animations && currentModel.animations.length > 0) {
    // 创建动画混合器
    mixer = new THREE.AnimationMixer(currentModel);
    // 播放第一个动画（通常是待机动画）
    currentAction = mixer.clipAction(currentModel.animations[0]);
    currentAction.play();
    console.log(`🎬 已加载 ${currentModel.animations.length} 个动画`);
  } else {
    console.log('ℹ️ 模型不包含动画');
  }
}

// ============================================================
// UI交互事件绑定
// ============================================================

/**
 * 绑定所有UI元素的交互事件
 */
function bindUIEvents() {
  // ---------- 1. 角色切换卡片 ----------
  document.querySelectorAll('.character-card').forEach((card, index) => {
    card.addEventListener('click', () => {
      switchToCharacter(index);  // 点击时切换角色
    });
    
    // 添加键盘支持（无障碍访问）
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    });
  });
  
  // ---------- 2. 发送消息按钮 ----------
  const sendBtn = document.getElementById('sendBtn');
  const userInput = document.getElementById('userInput');
  
  if (sendBtn) {
    sendBtn.addEventListener('click', sendMessage);
  }
  
  if (userInput) {
    // 按Enter发送消息（Shift+Enter换行）
    userInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }
  
  // ---------- 3. 重置视角按钮 ----------
  const resetBtn = document.getElementById('resetViewBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetCamera);
  }
  
  // ---------- 4. 全屏按钮 ----------
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', toggleFullscreen);
  }
  
  // ---------- 5. 清空聊天按钮 ----------
  const clearChatBtn = document.querySelector('.clear-chat');
  if (clearChatBtn) {
    clearChatBtn.addEventListener('click', clearChat);
  }
  
  // ---------- 6. 音频开关按钮（预留）----------
  const audioToggle = document.getElementById('audioToggle');
  if (audioToggle) {
    audioToggle.addEventListener('click', () => {
      console.log('音频功能待接入');
      showNotification('语音功能开发中...', 'info');
    });
  }
  
  console.log('✅ UI事件绑定完成');
}

// ============================================================
// 消息发送与AI对话
// ============================================================

/**
 * 发送用户消息到AI
 * 目前为模拟版本，后续需对接真实AI接口
 */
async function sendMessage() {
  const input = document.getElementById('userInput');
  const text = input.value.trim();
  
  // 空消息不处理
  if (!text) return;
  
  // 1. 显示用户消息
  addMessage(text, 'user');
  input.value = '';  // 清空输入框
  
  // 2. 显示"正在输入"状态
  showTypingIndicator();
  
  try {
    // TODO: 这里替换为真实的AI接口调用
    // 模拟AI回复（演示用）
    const reply = `收到消息: "${text}"。我是${CONFIG.models[currentCharacterIndex]?.name || '数字人'}，很高兴为你服务！`;
    
    // 模拟网络延迟
    setTimeout(() => {
      removeTypingIndicator();                    // 移除输入状态
      addMessage(reply, 'bot');                   // 显示AI回复
      
      // 模拟唇形同步效果（演示用）
      simulateLipSync(reply);
    }, 500);
    
  } catch (error) {
    console.error('AI回复失败', error);
    removeTypingIndicator();
    addMessage('抱歉，我遇到了一些问题，请稍后再试。', 'bot');
  }
}

/**
 * 模拟唇形同步（演示效果）
 * 实际项目中应接入真实的音频分析模块
 * @param {string} text - 要模拟的文本
 */
function simulateLipSync(text) {
  if (!currentModel) return;
  
  let intensity = 0;
  const duration = Math.min(text.length * 0.05, 2);  // 根据文本长度计算持续时间
  const interval = setInterval(() => {
    // 随机生成0-0.5的强度，模拟说话时的嘴部运动
    intensity = Math.random() * 0.5;
    
    // 遍历模型找到Morph Target并更新
    currentModel.traverse((node) => {
      if (node.isMesh && node.morphTargetDictionary) {
        const jawIndex = node.morphTargetDictionary['jawOpen'];
        if (jawIndex !== undefined) {
          node.morphTargetInfluences[jawIndex] = intensity;
        }
      }
    });
  }, 100);  // 每100ms更新一次
  
  // 在指定时间后停止并重置嘴型
  setTimeout(() => {
    clearInterval(interval);
    // 重置所有Morph Target
    currentModel.traverse((node) => {
      if (node.isMesh && node.morphTargetDictionary) {
        const jawIndex = node.morphTargetDictionary['jawOpen'];
        if (jawIndex !== undefined) {
          node.morphTargetInfluences[jawIndex] = 0;
        }
      }
    });
  }, duration * 1000);
}

// ============================================================
// UI辅助函数
// ============================================================

/**
 * 添加消息到聊天框
 * @param {string} content - 消息内容
 * @param {string} type - 消息类型（'user' 或 'bot'）
 */
function addMessage(content, type) {
  const messagesContainer = document.getElementById('chatMessages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${type}`;
  messageDiv.innerHTML = `
    <div class="avatar">${type === 'user' ? '👤' : '🤖'}</div>
    <div class="content">${escapeHtml(content)}</div>
  `;
  messagesContainer.appendChild(messageDiv);
  // 自动滚动到底部
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * 显示"正在输入"指示器
 */
function showTypingIndicator() {
  const messagesContainer = document.getElementById('chatMessages');
  const indicator = document.createElement('div');
  indicator.className = 'message bot typing-indicator';
  indicator.id = 'typingIndicator';
  indicator.innerHTML = `
    <div class="avatar">🤖</div>
    <div class="content">正在输入<span class="dot">...</span></div>
  `;
  messagesContainer.appendChild(indicator);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * 移除"正在输入"指示器
 */
function removeTypingIndicator() {
  const indicator = document.getElementById('typingIndicator');
  if (indicator) indicator.remove();
}

/**
 * 清空聊天记录
 */
function clearChat() {
  const messagesContainer = document.getElementById('chatMessages');
  messagesContainer.innerHTML = `
    <div class="message bot">
      <div class="avatar">🤖</div>
      <div class="content">对话已清空，有什么我可以帮你的吗？</div>
    </div>
  `;
  showNotification('对话已清空', 'info');
}

/**
 * 重置相机视角到初始位置
 */
function resetCamera() {
  camera.position.set(
    CONFIG.camera.position.x,
    CONFIG.camera.position.y,
    CONFIG.camera.position.z
  );
  controls.target.set(
    CONFIG.camera.target.x,
    CONFIG.camera.target.y,
    CONFIG.camera.target.z
  );
  controls.update();  // 更新控制器状态
  showNotification('视角已重置', 'info');
}

/**
 * 切换全屏模式
 */
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    // 进入全屏
    document.documentElement.requestFullscreen();
    showNotification('已进入全屏模式', 'info');
  } else {
    // 退出全屏
    document.exitFullscreen();
    showNotification('已退出全屏模式', 'info');
  }
}

/**
 * 显示通知提示
 * @param {string} message - 提示消息
 * @param {string} type - 提示类型（'info' 或 'error'）
 */
function showNotification(message, type = 'info') {
  const toast = document.createElement('div');
  toast.textContent = message;
  
  // 根据类型设置不同的背景色
  const bgColor = type === 'error' ? 'rgba(255, 68, 68, 0.9)' : 'rgba(0, 0, 0, 0.8)';
  
  toast.style.cssText = `
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: ${bgColor};
    color: white;
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 12px;
    z-index: 1000;
    pointer-events: none;
    animation: fadeIn 0.3s ease;
  `;
  
  document.body.appendChild(toast);
  
  // 2秒后自动移除
  setTimeout(() => toast.remove(), 2000);
}

/**
 * HTML转义，防止XSS攻击
 * @param {string} str - 需要转义的字符串
 * @returns {string} 转义后的字符串
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================
// 窗口自适应
// ============================================================

/**
 * 窗口大小变化时的回调函数
 * 重新计算相机宽高比并调整渲染器大小
 */
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;  // 更新宽高比
  camera.updateProjectionMatrix();                          // 更新投影矩阵
  renderer.setSize(window.innerWidth, window.innerHeight);  // 调整渲染器尺寸
}

// ============================================================
// 动画循环
// ============================================================

/**
 * 动画循环函数
 * 每一帧都会执行，更新动画并重新渲染场景
 */
function animate() {
  requestAnimationFrame(animate);  // 请求下一帧
  
  // 更新动画混合器（如果存在）
  if (mixer) {
    const deltaTime = 1 / 60;  // 假设60fps
    mixer.update(deltaTime);    // 更新动画
  }
  
  // 更新控制器（必须调用才能响应交互）
  controls.update();
  
  // 渲染场景
  renderer.render(scene, camera);
}

// ============================================================
// 添加动画样式（动态注入）
// ============================================================

const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }
  
  @keyframes fadeOut {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// ============================================================
// 启动应用
// ============================================================

// 等待DOM加载完成后启动
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}