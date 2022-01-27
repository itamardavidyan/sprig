import { render, html, svg } from "../uhtml.js";
import { playNote } from "./playNote.js";
import styles from "./sequencer-styles.js";

// could add
// scale selection -> chromatic, minor, pentatonic
// length selection
// line/drag drawing
// line/drag erasing
// percussion

// need to improve audio context handling

const instrumentColorMap = {
  "sine": "red",
  "square": "blue",
  "sawtooth": "orange",
  "triangle": "green",
}

const noteMap = {
  13: "c4",
  12: "d4",
  11: "e4",
  10: "f4",
  9: "g4",
  8: "a4",
  7: "b4",
  6: "c5",
  5: "d5",
  4: "e5",
  3: "f5",
  2: "g5",
  1: "a5",
  0: "b5",
}

export async function playCells({ cells, bpm, numBeats }, n = 0) {
  // if n === 0 then loop else play n times

  const beatTime = (1000*60)/bpm;

  let ended = false;

  for (let i = 0; i < numBeats; i++) {
    if (ended) break;

    playCellsOnBeat(cells, bpm, i);
    // await one beat
    await setTimeout(() => {}, beatTime);
  }

  ended = true;

  return {
    play({ cells, bpm, numBeats }) {

    },
    end() {
      ended = true;
    }
  }
}

export function playCellsOnBeat(cells, bpm, beat) {
  // notes :: note[]
  const notes = [];
  // note :: [ pitch, instrument]

  Object
    .entries(cells)
    .forEach(([ k, v ]) => {
      const [x, y] = k.split("_").map(Number);
      if (x === beat) notes.push([ y, v ]);
    })

  notes.forEach(([note, instrument]) => {
    const n = noteMap[note];
    const d = (1000*60)/bpm;
    playNote(n, d, instrument)
  })
}


function line(from, to) {
  const points = [];
  if (Math.abs(from[0] - to[0]) > Math.abs(from[1] - to[1])) {
    if (from[0] > to[0]) [from, to] = [to, from];
    let slope = (to[1] - from[1]) / (to[0] - from[0]);
    for (let [x, y] = from; x <= to[0]; x++) {
      points.push([x, Math.round(y)]);
      y += slope;
    }
  } else {
    if (from[1] > to[1]) [from, to] = [to, from];
    let slope = (to[0] - from[0]) / (to[1] - from[1]);
    for (let [x, y] = from; y <= to[1]; y++) {
      points.push([Math.round(x), y]);
      x += slope;
    }
  }
  return points;
}

export function createSequencer(target) {
  const state = {
    numberX: 32,
    numberY: 14,
    svg: null,
    instrument: "sine",
    cells: {},
    beat: 0,
    bpm: 120,
    interval: null,
    lastPt: [0, 0],
    tempNotes: [],
    drawing: false,
    erasing: false,
  };

  const ptsToD = pts => {
    const reducer = (acc, cur, i) => `${acc} ${i === 0 ? "M" : "L"} ${cur.join(",")}`;
    return pts.reduce(reducer, "");
  }

  const drawGrid = (numberX, numberY, target) => {
    const { left, right, bottom, top, width, height} = target.getBoundingClientRect();

    const lines = [];
    let lengthX = width/numberX;
    let lengthY = height/numberY;

    let i = 0;
    while ((i+1)*lengthX < width) {
      lines.push([
        [(i+1)*lengthX, 0],
        [(i+1)*lengthX, height],
      ])
      i++;
    }


    let j = 0;
    while ((j+1)*lengthY < height) {
      lines.push([
        [0, (j+1)*lengthY],
        [width, (j+1)*lengthY],
      ])
      j++;
    }

    return lines.map(line => svg`
      <path 
        stroke="black" 
        vector-effect="non-scaling-stroke" 
        stroke-width="1" d="${ptsToD(line)}"/>
    `)
  }


  const drawBeat = (state) => {
    const { left, right, bottom, top, width, height} = state.svg.getBoundingClientRect();
    const cellWidth = width/state.numberX;
    const cellHeight = height/state.numberY;


    return svg`
      <rect 
        fill=#72cacb33
        x=${state.beat*cellWidth} 
        y=${0} 
        width=${cellWidth} 
        height=${height}/>
    `
  }

  const drawCells = ({ cells, svg: container, numberX, numberY }) => {
    const { left, right, bottom, top, width, height} = container.getBoundingClientRect();
    const cellWidth = width/numberX;
    const cellHeight = height/numberY;

    const drawCell = ([x, y, color]) => {

      return svg`
        <rect 
          fill=${color}
          x=${x*cellWidth} 
          y=${y*cellHeight} 
          width=${cellWidth} 
          height=${cellHeight}/>
      `
    }

    const cellsToDraw = [];

    for (const key in cells) {
      const [x, y] = key.split("_").map(Number);
      const color = instrumentColorMap[cells[key]];
      cellsToDraw.push([ x, y, color ])
    }

    state.tempNotes.forEach(tn => {
      const [key, instrument] = tn;
      const [x, y] = key.split("_").map(Number);
      const color = instrumentColorMap[instrument] ?? "white";

      cellsToDraw.push([ x, y, color ])
    })

    return cellsToDraw.map(drawCell);
  }

  const drawInstrumentSelection = (instrument, color) => {

    return html`
      <div 
        class="instrument" 
        style=${`
          background: ${color};
          border: ${state.instrument === instrument ? "2px solid black" : "none"};
          box-sizing: border-box;
          `} 
        @click=${() => { 
          state.instrument = instrument;
          r();
        }}>
        ${instrument}
        </div>
    `
  }

  const view = (state) => html`
    <style>
      html, body {
        margin: 0px;
      }

      .svg-container {
        width: 100%;
        height: 100%;
        flex: 1;
      }

      .container {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
      }

      .toolbox {
        display: flex;
        min-height: 80px;
        max-height: 80px;
        background: lightgrey;
        justify-content: space-around;
        align-items: center;
      }

      .bpm {
        display: flex;
      }

      .instruments {
        display: flex;
      }

      .instrument {
        color: white;
        height: 30px;
        display: flex;
        width: 70px;
        justify-content: center;
        align-items: center;
      }

      .bpm-control {
        cursor: pointer;
      }

      .bpm-control:hover {
        color: orange;
      }
    </style>
    <div class="container">
      <svg 
        class="svg-container" 
        @mousedown=${onDownSVG} 
        @mousemove=${onMoveSVG}
        @mouseup=${onUpSVG}>
        ${state.svg ? drawCells(state) : ""}
        ${state.svg ? drawBeat(state) : ""}
        ${state.svg ? drawGrid(state.numberX, state.numberY, state.svg) : ""}
      </svg>
      <div class="toolbox">
        <div class="play-pause">
          <button @click=${() => {
            if (state.interval) {
              clearInterval(state.interval)
              state.interval = null;
            } else {
              state.interval = play();
            }
          }}>play/pause</button>
          <button>export midi</button>
        </div>
        <div class="bpm">
          <div style="padding-right: 10px;">BPM:</div>
          <div 
            class="bpm-control" 
            style="padding-right: 5px;" 
            @click=${() => {
              state.bpm = Math.max(state.bpm - 1, 1);
              clearInterval(state.interval);
              state.interval = play();
              r();
            }}>-</div>
          <input @input=${(e) => {
            state.bpm = Number(e.target.value);
            clearInterval(state.interval);
            state.interval = play();
            r();
          }} type="range" min="1" max="2000" .value=${state.bpm}>
          </input>
          <span style="width: 30px;">${state.bpm}</span>
          <div 
            class="bpm-control" 
            style="padding-left: 5px;" 
            @click=${() => {
              state.bpm = Math.min(state.bpm + 1, 2000);
              clearInterval(state.interval);
              state.interval = play();
              r();
            }}>+</div>
        </div>
        <div class="instruments">
          ${Object
            .entries(instrumentColorMap)
            .map(x => drawInstrumentSelection(x[0], x[1]))}
        </div>
      </div>
    </div>
  `;

  const getSVGPos = (e) => {
    const { left, right, bottom, top, width, height} = state.svg.getBoundingClientRect();
    const cellWidth = width/state.numberX;
    const cellHeight = height/state.numberY;

    const x = Math.floor(e.offsetX/cellWidth);
    const y = Math.floor(e.offsetY/cellHeight);

    return [x, y];
  }

  const onDownSVG = (e) => {
    const [x, y] = getSVGPos(e);
    const key = `${x}_${y}`;    

    if (key in state.cells && state.cells[key] === state.instrument) {
      delete state.cells[key];
      state.erasing = true;
    } else {
      state.cells[key] = state.instrument;
      const n = noteMap[y];
      const d = (1000*60)/state.bpm;
      playNote(n, d, state.instrument)
      state.drawing = true;
    }

    state.lastPt = [x, y];
    state.tempNotes = [];

    r();
  }

  const onMoveSVG = e => {
    const currentPt = getSVGPos(e);
    const tempNotes = [];

    if (state.drawing || state.erasing) {
      const pts = line(state.lastPt, currentPt);
      pts.forEach(([x, y]) => {
        const key = `${x}_${y}`
        tempNotes.push([key, state.drawing ? state.instrument : "empty"])
      })
    }

    state.lastPt = currentPt;
    state.tempNotes = [...state.tempNotes, ...tempNotes];
    r();
  }

  const onUpSVG = e => {
    if (state.drawing) {
      state.tempNotes.forEach(x => {
        state.cells[x[0]] = x[1];
      })
    } else if (state.erasing) {
      state.tempNotes.forEach(x => {
        delete state.cells[x[0]];
      })
    }

    state.tempNotes = [];
    state.erasing = false;
    state.drawing = false;

    r();
  }

  const r = () => {
    render(target, view(state));
  };


  const play = () => setInterval(() => {
    state.beat = (state.beat+1) % (state.numberX);
    // play song
    playCellsOnBeat(state.cells, state.bpm, state.beat);


    r();
  }, (1000*60)/state.bpm)

  const init = (state) => {
    r(); 
    state.svg = target.querySelector("svg");

    r();
    // add events
    window.addEventListener("resize", r);

    state.interval = play();
  }

  init(state);

  return {
    test: true
  };
}


createSequencer(document.body);