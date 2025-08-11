// script.js
// 11 images: images/image1.png ... images/image11.png
const {
  Engine, Render, Runner, Bodies, Body, Composite, Constraint,
  Mouse, Events, World, Query
} = Matter;

const IMAGES = 11;
const WIDTH = () => window.innerWidth;
const HEIGHT = () => window.innerHeight;

// ---------- 엔진 및 렌더러 초기화 ----------
const engine = Engine.create();
engine.world.gravity.y = 1.2;           // 중력 세기 (원본과 유사하게 설정)
const world = engine.world;

const render = Render.create({
  element: document.body,
  engine: engine,
  options: {
    width: WIDTH(),
    height: HEIGHT(),
    wireframes: false,
    background: '#0b0b0b',
    pixelRatio: window.devicePixelRatio
  }
});
Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);

// ---------- 경계(벽) ----------
let walls = [];
function makeWalls() {
  if (walls.length) World.remove(world, walls);
  const t = 180; // 두껍게 해서 절대 나가지 못하게
  walls = [
    Bodies.rectangle(WIDTH()/2, HEIGHT() + t/2, WIDTH() + t*2, t, { isStatic:true, label:'wall', restitution:1 }),
    Bodies.rectangle(WIDTH()/2, -t/2, WIDTH() + t*2, t, { isStatic:true, label:'wall', restitution:1 }),
    Bodies.rectangle(-t/2, HEIGHT()/2, t, HEIGHT() + t*2, { isStatic:true, label:'wall', restitution:1 }),
    Bodies.rectangle(WIDTH() + t/2, HEIGHT()/2, t, HEIGHT() + t*2, { isStatic:true, label:'wall', restitution:1 })
  ];
  World.add(world, walls);
}
makeWalls();

// ---------- 이미지 바디 생성 ----------
const imageBodies = [];
function addImageBody(x, y, src) {
  const img = new Image();
  img.src = src;
  img.onload = () => {
    const targetMaxW = Math.min(360, Math.max(160, Math.floor(window.innerWidth * 0.16)));
    const scale = (targetMaxW / img.width) * 0.5;
    const w = img.width * scale;
    const h = img.height * scale;

    const b = Bodies.rectangle(x, y, w, h, {
      restitution: 0.82,
      friction: 0.12,
      frictionAir: 0.02,
      density: 0.0016,
      angle: (Math.random() - 0.5) * 0.4,
      render: { sprite: { texture: src, xScale: scale, yScale: scale } }
    });
    b._origDensity = b.density;
    imageBodies.push(b);
    World.add(world, b);
  };
}

// 이미지 개당 2개씩 생성
for (let i = 1; i <= IMAGES; i++) {
  for (let j = 0; j < 2; j++) {
    const x = 120 + Math.random() * (WIDTH() - 240);
    const y = 60 + Math.random() * (HEIGHT() / 2);
    addImageBody(x, y, `images/image${i}.png`);
  }
}

// ---------- 새로고침 버튼을 물리 바디로 추가(이미지로) ----------
let refreshBody = null;
let btnW = 0, btnH = 0;
function addRefreshButton(x, y, src) {
  const img = new Image();
  img.src = src;

  img.onload = () => {
    const scale = 0.3;
    btnW = img.width * scale;
    btnH = img.height * scale;

    refreshBody = Bodies.rectangle(x, y, btnW, btnH, {
      restitution: 0.6,
      friction: 0.4,
      frictionAir: 0.02,
      density: 0.002,
      render: {
        sprite: {
          texture: src,
          xScale: scale,
          yScale: scale
        }
      }
    });

    World.add(world, refreshBody);
  };
}
addRefreshButton(150, 80, 'images/refresh.png');

// ---------- 커스텀 드래그 (모서리 포함 정확히 잡음) ----------
// Query.point을 사용 -> 회전된 모서리/경계에서도 정확히 잡힘
const canvas = render.canvas;
const mouse = Mouse.create(canvas);

let dragConstraint = null;
let dragged = null;
let lastMousePos = null;
let mouseDownTime = 0;

function getMousePoint(evt){
  const rect = canvas.getBoundingClientRect();
  const clientX = (evt.touches && evt.touches[0]) ? evt.touches[0].clientX : evt.clientX;
  const clientY = (evt.touches && evt.touches[0]) ? evt.touches[0].clientY : evt.clientY;
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function startDrag(point){
  const found = Query.point(Composite.allBodies(world), point);
  // top-most first (Query returns topmost first in Matter.js internals)
  for (let b of found) {
    if (b.isStatic || b.label === 'wall') continue;
    // attach constraint at grabbed offset
    const offset = { x: point.x - b.position.x, y: point.y - b.position.y };
    dragged = b;
    // make the dragged body heavier and slightly damped to avoid flinging others
    Body.setDensity(b, Math.max(0.0001, (b._origDensity || b.density) * 8));
    b.frictionAir = 0.12;
    dragConstraint = Constraint.create({
      pointA: { x: point.x, y: point.y },
      bodyB: b,
      pointB: offset,
      stiffness: 0.14,   // 낮으면 더 자연스럽게 다른 객체에도 힘 전달
      damping: 0.15,
      length: 0
    });
    World.add(world, dragConstraint);
    break;
  }
}

function moveDrag(point){
  if (dragConstraint) dragConstraint.pointA = { x: point.x, y: point.y };
}

function endDrag(point){
  if (dragConstraint) {
    World.remove(world, dragConstraint);
    if (dragged && dragged._origDensity) {
      Body.setDensity(dragged, dragged._origDensity);
      dragged.frictionAir = 0.02;
    }
  }
  dragConstraint = null;
  dragged = null;
}

// mouse / touch handlers
canvas.addEventListener('mousedown', (e)=>{
  const p = getMousePoint(e);
  mouseDownTime = Date.now();
  lastMousePos = p;
  startDrag(p);
});
window.addEventListener('mousemove', (e)=>{
  if (!dragConstraint) return;
  moveDrag( getMousePoint(e) );
});
window.addEventListener('mouseup', (e)=>{
  const p = getMousePoint(e);
  const dt = Date.now() - mouseDownTime;
  endDrag(p); // 반드시 먼저 드래그 해제
  // 새로고침 버튼 클릭 영역 체크
  if (refreshBody && btnW && btnH) {
    const withinRefresh = Math.abs(p.x - refreshBody.position.x) <= btnW/2 + 6 &&
                          Math.abs(p.y - refreshBody.position.y) <= btnH/2 + 6;
    if (dt < 220 && withinRefresh) location.reload();
  }
});

// touch support
canvas.addEventListener('touchstart', (e)=>{
  e.preventDefault();
  const p = getMousePoint(e);
  mouseDownTime = Date.now();
  lastMousePos = p;
  startDrag(p);
}, { passive:false });
window.addEventListener('touchmove', (e)=>{
  if (!dragConstraint) return;
  moveDrag( getMousePoint(e) );
}, { passive:false });
window.addEventListener('touchend', (e)=>{
  const p = lastMousePos || { x:0, y:0 };
  const dt = Date.now() - mouseDownTime;
  endDrag(p); // 반드시 먼저 드래그 해제
  if (refreshBody && btnW && btnH) {
    const withinRefresh = Math.abs(p.x - refreshBody.position.x) <= btnW/2 + 6 &&
                          Math.abs(p.y - refreshBody.position.y) <= btnH/2 + 6;
    if (dt < 220 && withinRefresh) location.reload();
  }
});

// ---------- 절대 밖으로 나가지 못하게 강제 클램프(Chrome 100% 기준) ----------
// beforeUpdate로 각 프레임에 바운드 검사, 바깥으로 가려하면 위치 보정 및 속도 반전(튕김)
Events.on(engine, 'beforeUpdate', ()=>{
  const W = WIDTH(), H = HEIGHT();
  const all = Composite.allBodies(world);
  for (let b of all) {
    if (b.isStatic || b.label === 'wall') continue;
    const halfW = (b.bounds.max.x - b.bounds.min.x) / 2;
    const halfH = (b.bounds.max.y - b.bounds.min.y) / 2;
    let x = b.position.x, y = b.position.y;
    let changed = false;

    if (x - halfW < 0) { x = halfW; Body.setVelocity(b, { x: -b.velocity.x * 0.7, y: b.velocity.y * 0.98 }); changed = true; }
    if (x + halfW > W) { x = W - halfW; Body.setVelocity(b, { x: -b.velocity.x * 0.7, y: b.velocity.y * 0.98 }); changed = true; }
    if (y - halfH < 0) { y = halfH; Body.setVelocity(b, { x: b.velocity.x * 0.98, y: -b.velocity.y * 0.7 }); changed = true; }
    if (y + halfH > H) { y = H - halfH; Body.setVelocity(b, { x: b.velocity.x * 0.98, y: -b.velocity.y * 0.7 }); changed = true; }

    if (changed) Body.setPosition(b, { x, y });
  }
});

// ---------- 리사이즈 처리 ----------
window.addEventListener('resize', () => {
  Render.lookAt(render, { min: { x: 0, y: 0 }, max: { x: WIDTH(), y: HEIGHT() } });
  render.canvas.width = WIDTH();
  render.canvas.height = HEIGHT();
  makeWalls();
});

// ---------- 마무리 세팅: 마우스(렌더에 연결만) ----------
render.mouse = mouse;
