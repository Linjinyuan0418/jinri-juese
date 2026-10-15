// 今日角色 - 微信小游戏入口
const canvas = wx.createCanvas();
const ctx = canvas.getContext('2d');
const { windowWidth, windowHeight } = wx.getSystemInfoSync();

canvas.width = windowWidth;
canvas.height = windowHeight;

// 颜色主题（低饱和暖色）
const COLORS = {
  bg: '#F7F5F2',
  card: '#FFFFFF',
  primary: '#6B8E9F',
  text: '#2C3E50',
  textSecondary: '#7F8C8D',
  accent: '#E8A87C',
  border: '#E0DCD7'
};

// 简单状态机
let state = 'main'; // main | intro | task | feedback | end | collection
let currentSession = null;
let currentTaskIndex = 0;
let choices = [];

// 数据（实际项目可从 JSON 加载，这里简化内嵌）
const characters = require('./config/characters.json');
const scenes = require('./config/scenes.json');
const tasks = require('./config/tasks.json');

// 存储工具
const Storage = {
  get(key, def = null) {
    try { return wx.getStorageSync(key) || def; } catch { return def; }
  },
  set(key, val) {
    try { wx.setStorageSync(key, val); } catch {}
  }
};

// 圆角矩形
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 绘制卡片
function drawCard(x, y, w, h) {
  ctx.fillStyle = COLORS.card;
  roundRect(x, y, w, h, 16);
  ctx.fill();
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 1;
  ctx.stroke();
}

// 绘制按钮
function drawButton(x, y, w, h, text, primary = true) {
  ctx.fillStyle = primary ? COLORS.primary : COLORS.card;
  roundRect(x, y, w, h, 12);
  ctx.fill();
  if (!primary) {
    ctx.strokeStyle = COLORS.primary;
    ctx.stroke();
  }
  ctx.fillStyle = primary ? '#FFF' : COLORS.primary;
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h / 2);
  return { x, y, w, h };
}

// 主循环绘制
function render() {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, windowWidth, windowHeight);

  const pad = 24;
  const contentW = windowWidth - pad * 2;

  if (state === 'main') {
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('今日角色', windowWidth / 2, 120);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = COLORS.textSecondary;
    ctx.fillText('每天体验一个角色的日常', windowWidth / 2, 160);

    drawButton(pad, windowHeight - 200, contentW, 56, '开始今日体验');
    drawButton(pad, windowHeight - 120, contentW, 48, '图鉴', false);
  }

  else if (state === 'intro' && currentSession) {
    drawCard(pad, 80, contentW, 280);
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(currentSession.character.name, pad + 20, 120);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = COLORS.textSecondary;
    ctx.fillText(currentSession.scene.name, pad + 20, 155);
    ctx.fillStyle = COLORS.text;
    wrapText(currentSession.intro, pad + 20, 200, contentW - 40, 24);
    drawButton(pad, windowHeight - 120, contentW, 56, '继续');
  }

  else if (state === 'task' && currentSession) {
    const task = currentSession.tasks[currentTaskIndex];
    drawCard(pad, 80, contentW, 160);
    ctx.fillStyle = COLORS.text;
    ctx.font = '16px sans-serif';
    wrapText(task.description, pad + 20, 110, contentW - 40, 24);

    let btnY = 280;
    task.options.forEach((opt, i) => {
      drawButton(pad, btnY, contentW, 52, opt.text, false);
      btnY += 68;
    });
  }

  else if (state === 'feedback') {
    drawCard(pad, 120, contentW, 200);
    ctx.fillStyle = COLORS.text;
    ctx.font = '16px sans-serif';
    wrapText(currentSession.lastFeedback || '', pad + 20, 160, contentW - 40, 24);
    drawButton(pad, windowHeight - 120, contentW, 56, '继续');
  }

  else if (state === 'end' && currentSession) {
    drawCard(pad, 80, contentW, 320);
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('今日总结', pad + 20, 120);
    ctx.font = '16px sans-serif';
    wrapText(currentSession.summary, pad + 20, 160, contentW - 40, 24);
    ctx.fillStyle = COLORS.accent;
    ctx.fillText('标签：' + (currentSession.tags || []).join(' / '), pad + 20, 300);
    drawButton(pad, windowHeight - 180, contentW, 52, '查看图鉴', false);
    drawButton(pad, windowHeight - 110, contentW, 52, '返回首页');
  }

  else if (state === 'collection') {
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('图鉴', windowWidth / 2, 80);
    const col = Storage.get('collection', { days: 0, chars: [], scenes: [] });
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`已体验 ${col.days || 0} 天`, pad, 140);
    ctx.fillText(`角色：${(col.chars || []).length} 个`, pad, 170);
    ctx.fillText(`场景：${(col.scenes || []).length} 个`, pad, 200);
    drawButton(pad, windowHeight - 120, contentW, 52, '返回');
  }
}

// 简单文字换行
function wrapText(text, x, y, maxWidth, lineHeight) {
  const words = text.split('');
  let line = '';
  let cy = y;
  for (let i = 0; i < words.length; i++) {
    const test = line + words[i];
    if (ctx.measureText(test).width > maxWidth && i > 0) {
      ctx.fillText(line, x, cy);
      line = words[i];
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, cy);
}

// 生成每日会话
function startDaily() {
  const char = characters[Math.floor(Math.random() * characters.length)];
  const scene = scenes[Math.floor(Math.random() * scenes.length)];
  const available = tasks.filter(t => !t.sceneId || t.sceneId === scene.id);
  const selected = available.slice(0, 2);

  currentSession = {
    character: char,
    scene: scene,
    intro: char.introTemplate.replace('{scene}', scene.name),
    tasks: selected,
    choices: [],
    tags: [],
    summary: ''
  };
  currentTaskIndex = 0;
  state = 'intro';
  render();
}

// 结算
function finishSession() {
  const attitudes = currentSession.choices.map(c => c.attitude);
  const count = {};
  attitudes.forEach(a => count[a] = (count[a] || 0) + 1);
  const main = Object.keys(count).sort((a, b) => count[b] - count[a])[0] || '普通';
  currentSession.tags = [main];
  currentSession.summary = `今天的你比较${main}。${currentSession.scene.name}里，日常就是这样。`;

  const col = Storage.get('collection', { days: 0, chars: [], scenes: [], tags: [] });
  col.days = (col.days || 0) + 1;
  if (!col.chars.includes(currentSession.character.id)) col.chars.push(currentSession.character.id);
  if (!col.scenes.includes(currentSession.scene.id)) col.scenes.push(currentSession.scene.id);
  Storage.set('collection', col);

  state = 'end';
  render();
}

// 触摸处理
wx.onTouchEnd((e) => {
  const touch = e.changedTouches[0];
  const x = touch.clientX;
  const y = touch.clientY;
  const pad = 24;
  const contentW = windowWidth - pad * 2;

  if (state === 'main') {
    if (y > windowHeight - 200 && y < windowHeight - 144) startDaily();
    else if (y > windowHeight - 120 && y < windowHeight - 72) { state = 'collection'; render(); }
  }
  else if (state === 'intro') {
    if (y > windowHeight - 120) { state = 'task'; render(); }
  }
  else if (state === 'task') {
    const task = currentSession.tasks[currentTaskIndex];
    let btnY = 280;
    task.options.forEach((opt, i) => {
      if (y > btnY && y < btnY + 52) {
        currentSession.choices.push({ attitude: opt.attitude });
        currentSession.lastFeedback = opt.feedback;
        state = 'feedback';
        render();
      }
      btnY += 68;
    });
  }
  else if (state === 'feedback') {
    if (y > windowHeight - 120) {
      currentTaskIndex++;
      if (currentTaskIndex >= currentSession.tasks.length) finishSession();
      else { state = 'task'; render(); }
    }
  }
  else if (state === 'end') {
    if (y > windowHeight - 180 && y < windowHeight - 128) { state = 'collection'; render(); }
    else if (y > windowHeight - 110) { state = 'main'; render(); }
  }
  else if (state === 'collection') {
    if (y > windowHeight - 120) { state = 'main'; render(); }
  }
});

// 启动
render();
console.log('今日角色 启动');
