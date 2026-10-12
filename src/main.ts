import './styles.css';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('Missing #app');

root.innerHTML = `
  <header class="header">
    <div class="brand"><span class="logo">X</span> 差点调查沙盘 <span class="sub">EVIDENCE BOARD STUDIO</span></div>
    <span class="status">开发初始化 · 阅读 AGENTS.md</span>
  </header>
  <div class="workspace">
    <aside class="panel">
      <h2>模块背包</h2><p>相纸 · 文件 · 图钉 · 红线</p>
      <div class="placeholder">按 docs/PRODUCT.md 开发<br>可拖放模块库</div>
    </aside>
    <main class="stage">
      <div class="stage-label">无限沙盘 · 待实现交互</div>
      <div class="stage-center"><span>XPIN</span><h1>Evidence Board</h1><p>像搭积木一样摆放证据，像导演一样安排镜头。</p></div>
    </main>
    <aside class="panel">
      <h2>差点控件</h2><p>内容 / 材质 / 变换 / 动画</p>
      <div class="placeholder">选择物体后<br>编辑参数</div>
    </aside>
  </div>
  <footer class="timeline"><b>故事编排</b><div class="timeline-hint">镜头步骤 · 出场动画 · 关系连线 · 自动运镜</div><span>00:00 / 00:20</span></footer>
`;
