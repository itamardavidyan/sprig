const lerp = (a, b, t) => (1 - t) * a + t * b;
const invLerp = (a, b, v) => (v - a) / (b - a);

// input: h as an angle in [0,360] and s,l in [0,100] 
// output: r,g,b in [0,1]
function hsl2rgb(h,s,l) {
  s /= 100, l /= 100;
  let a=s*Math.min(l,1-l);
  let f= (n,k=(n+h/30)%12) => l - a*Math.max(Math.min(k-3,9-k,1),-1);
  return [f(0),f(8),f(4)];
}   

function imageData2Image(imagedata) {
  let canvas = document.createElement('canvas');
  let ctx = canvas.getContext('2d');
  canvas.width = imagedata.width;
  canvas.height = imagedata.height;
  ctx.putImageData(imagedata, 0, 0);

  let image = new Image();
  image.src = canvas.toDataURL();
  return image;
}

const hslToStr = ([a, b, c]) => `hsl(${a}, ${b}%, ${c}%)`;

export default async (canvas, buttons) => {
  canvas.id = "frontpage";
  const ctx = canvas.getContext("2d");

  let drawing = true;
  document.body.appendChild(canvas);
  document.getElementById("root").style.zIndex = -1;
  const exit = () => {
    drawing = false;
    document.getElementById("root").style.zIndex = 0;
  }

  (window.onresize = () => {
    if (document.getElementById("frontpage")) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      ctx.imageSmoothingEnabled = false;
    }
  })();

  let mouse = { x: 0, y: 0 };
  let mouseDown = false;
  let mouseDownPos = { x: 0, y: 0 };
  const pagePos = ({ pageX: x, pageY: y }) => ({ x, y });
  canvas.onmousemove = ev => mouse = pagePos(ev);
  canvas.onmousedown = ev => {
    mouseDown = true;
    mouseDownPos = pagePos(ev);
  };
  canvas.onmouseup = () => mouseDown = false;

  const art = Object.fromEntries(await Promise.all(
    ["wing", "ocean", "pillars", "windows"]
      .map(name => new Promise(res => {
        const asset = new Image();
        asset.onload = () => res([name, asset]);
        asset.src = `assets/${name}.png`;
      }))
  ));

  const wingData = (() => {
    const offscreen = document.createElement("canvas");
    const { width, height } = art.wing;
    offscreen.width = width;
    offscreen.height = height;
    const octx = offscreen.getContext("2d");
    ctx.drawImage(art.wing, 0, 0);
    return ctx.getImageData(0, 0, width, height);
  })();
  const wings = {
    purple: { hsl: [300, 100, 25] },
    maroon: { hsl: [0, 100, 25] },
    darkblue: { hsl: [240, 100, 25] }
  };
  for (const [name, { hsl }] of Object.entries(wings)) {
    const tintRGB = hsl2rgb(...hsl).map(x => x * 255);
    const data = new ImageData(wingData.width, wingData.height);
    for (let i = 0; i < wingData.data.length; i += 4) {
      let r, g, b;
      const rgb = [r, g, b] = wingData.data.slice(i, i+3);

      const average = (r + g + b) / 3;
      const blueness = (b - average) / 64;

      [r, g, b] = rgb.map((x, i) => lerp(x, tintRGB[i], blueness))
      data.data[i+0] = r;
      data.data[i+1] = g;
      data.data[i+2] = b;
      data.data[i+3] = wingData.data[i+3];
    }
    wings[name].img = imageData2Image(data);
  }

  requestAnimationFrame(function frame(now) {
    if (drawing) requestAnimationFrame(frame);

    (() => {
      ctx.save();

      const { width, height } = art.ocean;
      ctx.scale(window.innerWidth  /  width,
                window.innerHeight / height);

      const pan = (img, speed) => {
        const w = img.width;
        ctx.drawImage(img, (now / speed) % w, 0);
        ctx.drawImage(img, (now / speed) % w - w*Math.sign(speed), 0);
      };

      pan(art.ocean, 300);
      pan(art.windows, 200);
      pan(art.pillars, 100);

      ctx.restore();
    })();

    const cloud = (() => {
      const circles = [];
      for (let i = 0; i < 31; i++) {
        let t = (0.5 - i/30);

        const q = Math.sin(t * 400 + now / 1000)/2;
        const r = q * (0.5 - Math.abs(t));
        const x =     140 - t * 350,
              y = r * 140          ;

        const v = 0.3;
        circles.push({
          x,
          y,
          radius: 65 * (1 - Math.abs(t)),
          brightness: ((1-v) + v * (1-r)) * 245,
        });
      }

      const offscreen = document.createElement("canvas");
      const scale = 0.14;
      const w = 450 * 0.8, h = 250 * 0.8;
      offscreen.width = w * scale;
      offscreen.height = h * scale;
      const octx = offscreen.getContext("2d");

      octx.scale(scale * 0.8, scale * 0.8);
      octx.translate(80, 120);

      const circle = (x, y, radius) => {
        octx.beginPath();
        octx.arc(x, y, radius, 0, Math.PI*2);
        octx.fill();
      }

      const setFill = b => octx.fillStyle = `rgb(${b}, ${b-20}, ${b})`;
      for (let i = 0; i < 5; i++)
        for (const { x, y, radius, brightness: b } of circles)
          setFill(b * 0.65), circle(x, y, radius*1.1);

        for (const { x, y, radius, brightness: b } of circles)
          setFill(b), circle(x, y, radius);

      return () => ctx.drawImage(offscreen, 5-w/2, -h/2, w, h);
    })();


    (() => {
      const drawWing = (wingImg, x, y, ay, dir, flip) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(3 * dir, 3);

        const TAU = Math.PI * 2;
        let t = ((ay + now / 300 + ((flip < 0) ? Math.PI : 0)) % TAU) / TAU;
        const tM = 0.5, vM = 0.75;
        if (t < tM) t = lerp(0, vM, invLerp(0, tM, t));
        else        t = lerp(vM, 1, invLerp(tM, 1, t));
        ctx.rotate(Math.sin(t * TAU) * (2/8)*Math.PI)
        const { width, height } = art.wing;
        ctx.drawImage(wingImg, -width*0.8, -height*0.8);
        ctx.restore();
      };

      let ay = 0;
      const button = ({ text, ax, wing, flip=1, onClick }) => {
        ay += 230;

        ctx.save();
        const w = 350;
        const t = flip * Math.sin(ay + now / 300);
        const x = ax + 150 + w/2 + 10 * t, y = ay + 15 * t;

        const posHovers = pos => Math.abs(mouse.x - x) < w/2 &&
                                 Math.abs(mouse.y - y) < 40;
        const hover = posHovers(mouse);
        if (mouseDown && posHovers(mouseDownPos))
          mouseDown = false, onClick(exit);

        ctx.translate(x, y);
        ctx.rotate(t * (2/70) * Math.PI);
        ctx.font = '50px "SFPixelateShadedRegular"';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        cloud(x, y);

        ctx.fillStyle = hover ? "crimson" : hslToStr(wing.hsl);
        ctx.fillText(text, 0, 0, w * 0.85);

        drawWing(wing.img, w/-2, 0, ay,  1, flip);
        drawWing(wing.img, w/ 2, 0, ay, -1, flip);
        ctx.restore();
      };

      let x = 0;
      for (const i in buttons)
        button({
          text: buttons[i].name,
          onClick: buttons[i].onClick,
          wing: wings[['maroon', 'purple', 'darkblue'][i % 3]],
          ax: x += 40,
          flip: (i % 2) ? -1 : 1,
        });

    })();
  });
}