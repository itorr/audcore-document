const canvas = document.querySelector('canvas');
const context = canvas.getContext('2d');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
let animation;

function rect(color, x, y, width, height) {
  context.fillStyle = color;
  context.fillRect(Math.floor(x), Math.floor(y), width, height);
}

function scene(time) {
  const t = time / 1000;
  rect('#201d3b', 0, 0, 192, 128);
  rect('#f9a565', 27, 17, 29, 25);
  rect('#f9a565', 31, 13, 21, 33);
  for (let i = 0; i < 11; i++) {
    const x = (i * 23 + t * 8) % 207 - 15;
    const h = 9 + (i * 13 % 21);
    rect('#383454', x, 69 - h, 15, h);
    rect('#51466e', x + 3, 72 - h, 2, 3);
  }
  rect('#6a4257', 0, 71, 192, 9);
  for (let i = 0; i < 17; i++) rect('#ffb766', (i * 13 + t * 32) % 208 - 14, 71, 9, 2);
  const runnerX = 67 + Math.round(Math.sin(t * 2) * 8);
  const runnerY = 52 + Math.round(Math.sin(t * 8));
  const step = Math.floor(t * 10) % 2 ? 3 : 0;
  rect('#9df6bd', runnerX, runnerY - 3, 7, 7);
  rect('#1b3539', runnerX + 1, runnerY - 1, 2, 2);
  rect('#52c993', runnerX + 2, runnerY + 4, 6, 8);
  rect('#9df6bd', runnerX - step, runnerY + 12, 5, 5);
  rect('#9df6bd', runnerX + 6 + step, runnerY + 12, 5, 5);
  rect('#5b3957', 108, 62, 68, 9);
  rect('#ffb65d', 123, 48, 48, 15);
  rect('#ffc772', 148, 39, 17, 13);
  rect('#393d55', 150, 42, 10, 8);
  rect('#f19456', 112, 46, 6, 22);
  rect('#f19456', 107, 66, 18, 4);
  for (let i = 0; i < 6; i++) rect('#c39283', 113 + i * 10 + Math.floor(t * 24) % 5, 65, 4, 3);
  for (let i = 0; i < 30; i++) {
    const height = 4 + Math.floor((1 + Math.sin(t * 9 + i * 1.27)) * (3 + i % 7));
    const x = 8 + i * 6;
    rect(i < 15 ? '#ffad71' : '#9df6bd', x, i < 15 ? 116 - height : 104 - height / 2, 3, height);
  }
}

function tick(time) {
  scene(time);
  animation = requestAnimationFrame(tick);
}

function update() {
  cancelAnimationFrame(animation);
  if (motion.matches || document.hidden) scene(0);
  else animation = requestAnimationFrame(tick);
}

if (context) {
  motion.addEventListener('change', update);
  document.addEventListener('visibilitychange', update);
  update();
}
