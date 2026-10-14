(() => {
  "use strict";

  const GRID_SIZE = 32;
  const SPECTRUM_ENSEMBLE_SIZE = 64;
  const HISTOGRAM_CONFIGURATIONS = 128;
  const HISTOGRAM_BINS = 112;
  const TWO_PI = 2 * Math.PI;
  const COLOR_A = "#65cfff";
  const COLOR_B = "#ffad61";
  const COLOR_THEORY = "#e9edf3";
  const COLOR_GRID = "rgba(185, 205, 225, 0.16)";
  const COLOR_TEXT = "#dce7f1";

  function mulberry32(seed) {
    let value = seed >>> 0;
    return () => {
      value += 0x6d2b79f5;
      let result = value;
      result = Math.imul(result ^ (result >>> 15), result | 1);
      result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
      return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
  }

  function gaussianSource(random) {
    let spare = null;
    return () => {
      if (spare !== null) {
        const value = spare;
        spare = null;
        return value;
      }

      let u = 0;
      let v = 0;
      while (u === 0) u = random();
      while (v === 0) v = random();
      const radius = Math.sqrt(-2 * Math.log(u));
      const angle = TWO_PI * v;
      spare = radius * Math.sin(angle);
      return radius * Math.cos(angle);
    };
  }

  function latticeMomentumSquared(kx, ky, size) {
    const sx = Math.sin(Math.PI * kx / size);
    const sy = Math.sin(Math.PI * ky / size);
    return 4 * (sx * sx + sy * sy);
  }

  function normalizedTheoryPower(kind, mass, size) {
    const total = size * size;
    const power = new Float64Array(total);
    let sum = 0;

    for (let ky = 0; ky < size; ky += 1) {
      for (let kx = 0; kx < size; kx += 1) {
        const index = ky * size + kx;
        const raw = kind === "white"
          ? 1
          : 1 / (2 * Math.sqrt(mass * mass + latticeMomentumSquared(kx, ky, size)));
        power[index] = raw;
        sum += raw;
      }
    }

    const mean = sum / total;
    for (let i = 0; i < total; i += 1) power[i] /= mean;
    return power;
  }

  function gaussianSpectrum(theoryPower, seed, size) {
    const total = size * size;
    const real = new Float64Array(total);
    const imag = new Float64Array(total);
    const visited = new Uint8Array(total);
    const normal = gaussianSource(mulberry32(seed));

    for (let ky = 0; ky < size; ky += 1) {
      for (let kx = 0; kx < size; kx += 1) {
        const index = ky * size + kx;
        if (visited[index]) continue;

        const partnerX = (size - kx) % size;
        const partnerY = (size - ky) % size;
        const partner = partnerY * size + partnerX;
        const modePower = theoryPower[index];

        if (partner === index) {
          real[index] = normal() * Math.sqrt(modePower);
          imag[index] = 0;
          visited[index] = 1;
        } else {
          const scale = Math.sqrt(modePower / 2);
          const re = normal() * scale;
          const im = normal() * scale;
          real[index] = re;
          imag[index] = im;
          real[partner] = re;
          imag[partner] = -im;
          visited[index] = 1;
          visited[partner] = 1;
        }
      }
    }

    return {real, imag};
  }

  function spectrumPower(spectrum) {
    const power = new Float64Array(spectrum.real.length);
    for (let i = 0; i < power.length; i += 1) {
      power[i] = spectrum.real[i] ** 2 + spectrum.imag[i] ** 2;
    }
    return power;
  }

  function averageSpectrumPower(theoryPower, seed, size, count) {
    const average = new Float64Array(size * size);
    for (let sample = 0; sample < count; sample += 1) {
      const spectrum = gaussianSpectrum(
        theoryPower,
        seed + Math.imul(sample + 1, 0x9e3779b1),
        size
      );
      const power = spectrumPower(spectrum);
      for (let i = 0; i < average.length; i += 1) average[i] += power[i];
    }
    for (let i = 0; i < average.length; i += 1) average[i] /= count;
    return average;
  }

  function inverseFFT1D(real, imag) {
    const size = real.length;

    for (let i = 1, j = 0; i < size; i += 1) {
      let bit = size >> 1;
      while (j & bit) {
        j ^= bit;
        bit >>= 1;
      }
      j ^= bit;
      if (i < j) {
        [real[i], real[j]] = [real[j], real[i]];
        [imag[i], imag[j]] = [imag[j], imag[i]];
      }
    }

    for (let length = 2; length <= size; length <<= 1) {
      const angle = TWO_PI / length;
      const stepReal = Math.cos(angle);
      const stepImag = Math.sin(angle);

      for (let offset = 0; offset < size; offset += length) {
        let twiddleReal = 1;
        let twiddleImag = 0;
        for (let index = 0; index < length / 2; index += 1) {
          const even = offset + index;
          const odd = even + length / 2;
          const oddReal = real[odd] * twiddleReal - imag[odd] * twiddleImag;
          const oddImag = real[odd] * twiddleImag + imag[odd] * twiddleReal;
          const evenReal = real[even];
          const evenImag = imag[even];

          real[even] = evenReal + oddReal;
          imag[even] = evenImag + oddImag;
          real[odd] = evenReal - oddReal;
          imag[odd] = evenImag - oddImag;

          const nextReal = twiddleReal * stepReal - twiddleImag * stepImag;
          twiddleImag = twiddleReal * stepImag + twiddleImag * stepReal;
          twiddleReal = nextReal;
        }
      }
    }

    for (let i = 0; i < size; i += 1) {
      real[i] /= size;
      imag[i] /= size;
    }
  }

  function inverseTransform(spectrum, size) {
    const real = spectrum.real.slice();
    const imag = spectrum.imag.slice();
    const lineReal = new Float64Array(size);
    const lineImag = new Float64Array(size);

    for (let ky = 0; ky < size; ky += 1) {
      const offset = ky * size;
      for (let kx = 0; kx < size; kx += 1) {
        lineReal[kx] = real[offset + kx];
        lineImag[kx] = imag[offset + kx];
      }
      inverseFFT1D(lineReal, lineImag);
      for (let x = 0; x < size; x += 1) {
        real[offset + x] = lineReal[x];
        imag[offset + x] = lineImag[x];
      }
    }

    for (let x = 0; x < size; x += 1) {
      for (let ky = 0; ky < size; ky += 1) {
        lineReal[ky] = real[ky * size + x];
        lineImag[ky] = imag[ky * size + x];
      }
      inverseFFT1D(lineReal, lineImag);
      for (let y = 0; y < size; y += 1) {
        real[y * size + x] = lineReal[y];
        imag[y * size + x] = lineImag[y];
      }
    }

    const field = new Float64Array(size * size);
    for (let i = 0; i < field.length; i += 1) field[i] = size * real[i];
    return field;
  }

  function ensembleFieldValues(theoryPower, seed, size, count) {
    const values = new Float64Array(count * size * size);
    for (let sample = 0; sample < count; sample += 1) {
      const spectrum = gaussianSpectrum(
        theoryPower,
        seed + Math.imul(sample + 1, 0x85ebca6b),
        size
      );
      values.set(inverseTransform(spectrum, size), sample * size * size);
    }
    return values;
  }

  function divergingColor(value) {
    const clipped = Math.max(-3.2, Math.min(3.2, value)) / 3.2;
    const center = [12, 18, 28];
    const target = clipped < 0 ? [55, 147, 230] : [255, 163, 73];
    const amount = Math.pow(Math.abs(clipped), 0.76);
    return center.map((channel, index) => Math.round(channel + amount * (target[index] - channel)));
  }

  function drawField(canvas, field, size) {
    const offscreen = document.createElement("canvas");
    offscreen.width = size;
    offscreen.height = size;
    const offscreenContext = offscreen.getContext("2d");
    const image = offscreenContext.createImageData(size, size);

    for (let i = 0; i < field.length; i += 1) {
      const [red, green, blue] = divergingColor(field[i]);
      const pixel = 4 * i;
      image.data[pixel] = red;
      image.data[pixel + 1] = green;
      image.data[pixel + 2] = blue;
      image.data[pixel + 3] = 255;
    }
    offscreenContext.putImageData(image, 0, 0);

    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = false;
    context.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
  }

  function histogram(values, minimum, maximum, bins) {
    const width = (maximum - minimum) / bins;
    const counts = new Float64Array(bins);
    for (const value of values) {
      if (value < minimum || value >= maximum) continue;
      const bin = Math.floor((value - minimum) / width);
      counts[bin] += 1;
    }
    return Array.from(counts, (count, index) => ({
      x: minimum + (index + 0.5) * width,
      y: count / (values.length * width)
    }));
  }

  function correlationFromPower(power, size) {
    const result = [];
    const total = size * size;
    for (let separation = 0; separation <= size / 2; separation += 1) {
      let covariance = 0;
      for (let ky = 0; ky < size; ky += 1) {
        for (let kx = 0; kx < size; kx += 1) {
          covariance += power[ky * size + kx]
            * Math.cos(TWO_PI * kx * separation / size);
        }
      }
      result.push({x: separation, y: covariance / total});
    }
    const variance = result[0].y;
    return result.map(point => ({x: point.x, y: point.y / variance}));
  }

  function radialSpectrum(power, size, binCount = 13) {
    const maximum = Math.sqrt(8);
    const sum = new Float64Array(binCount);
    const count = new Uint32Array(binCount);

    for (let ky = 0; ky < size; ky += 1) {
      for (let kx = 0; kx < size; kx += 1) {
        const momentum = Math.sqrt(latticeMomentumSquared(kx, ky, size));
        const bin = Math.min(binCount - 1, Math.floor(momentum / maximum * binCount));
        sum[bin] += power[ky * size + kx];
        count[bin] += 1;
      }
    }

    return Array.from(sum, (value, bin) => ({
      x: maximum * (bin + 0.5) / binCount,
      y: count[bin] ? value / count[bin] : 0
    }));
  }

  function normalDensity(x) {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  }

  function clearCanvas(canvas) {
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#0d1520";
    context.fillRect(0, 0, canvas.width, canvas.height);
    return context;
  }

  function chartFrame(canvas, options) {
    const context = clearCanvas(canvas);
    const margin = {left: 78, right: 28, top: 28, bottom: 60};
    const width = canvas.width - margin.left - margin.right;
    const height = canvas.height - margin.top - margin.bottom;
    const xScale = value => margin.left + (value - options.xMin) / (options.xMax - options.xMin) * width;
    const yScale = value => margin.top + height - (value - options.yMin) / (options.yMax - options.yMin) * height;

    context.strokeStyle = COLOR_GRID;
    context.lineWidth = 1;
    context.font = "16px system-ui, sans-serif";
    context.fillStyle = COLOR_TEXT;
    context.textAlign = "center";
    context.textBaseline = "top";

    const xTicks = options.xTicks || 6;
    for (let i = 0; i <= xTicks; i += 1) {
      const value = options.xMin + i * (options.xMax - options.xMin) / xTicks;
      const x = xScale(value);
      context.beginPath();
      context.moveTo(x, margin.top);
      context.lineTo(x, margin.top + height);
      context.stroke();
      context.fillText(options.xFormat ? options.xFormat(value) : value.toFixed(1), x, margin.top + height + 10);
    }

    context.textAlign = "right";
    context.textBaseline = "middle";
    const yTicks = options.yTicks || 5;
    for (let i = 0; i <= yTicks; i += 1) {
      const value = options.yMin + i * (options.yMax - options.yMin) / yTicks;
      const y = yScale(value);
      context.beginPath();
      context.moveTo(margin.left, y);
      context.lineTo(margin.left + width, y);
      context.stroke();
      context.fillText(options.yFormat ? options.yFormat(value) : value.toFixed(1), margin.left - 10, y);
    }

    context.strokeStyle = "rgba(220, 233, 245, 0.65)";
    context.lineWidth = 1.4;
    context.strokeRect(margin.left, margin.top, width, height);

    context.font = "18px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "bottom";
    context.fillText(options.xLabel, margin.left + width / 2, canvas.height - 5);

    context.save();
    context.translate(19, margin.top + height / 2);
    context.rotate(-Math.PI / 2);
    context.fillText(options.yLabel, 0, 0);
    context.restore();

    return {context, xScale, yScale, margin, width, height};
  }

  function drawSeries(frame, points, color, width = 4, dash = []) {
    if (!points.length) return;
    const {context, xScale, yScale} = frame;
    context.save();
    context.strokeStyle = color;
    context.lineWidth = width;
    context.setLineDash(dash);
    context.beginPath();
    points.forEach((point, index) => {
      const x = xScale(point.x);
      const y = yScale(point.y);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
    context.restore();
  }

  function drawLegend(canvas, entries) {
    const context = canvas.getContext("2d");
    let x = 96;
    const y = 18;
    context.font = "16px system-ui, sans-serif";
    context.textAlign = "left";
    context.textBaseline = "middle";
    for (const entry of entries) {
      context.strokeStyle = entry.color;
      context.lineWidth = entry.width || 4;
      context.setLineDash(entry.dash || []);
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + 34, y);
      context.stroke();
      context.setLineDash([]);
      context.fillStyle = COLOR_TEXT;
      context.fillText(entry.label, x + 43, y);
      x += 54 + context.measureText(entry.label).width;
    }
  }

  function modelName(kind) {
    return kind === "white" ? "белый шум" : "вакуум";
  }

  function labelledPanel(letter, kind, revealed) {
    return revealed ? `Поле ${letter} · ${modelName(kind)}` : `Поле ${letter}`;
  }

  function initLab(root) {
    const elements = {
      mass: root.querySelector("[data-mass]"),
      massValue: root.querySelector("[data-mass-value]"),
      regenerate: root.querySelector("[data-regenerate]"),
      reveal: root.querySelector("[data-reveal]"),
      labelA: root.querySelector("[data-label-a]"),
      labelB: root.querySelector("[data-label-b]"),
      fieldA: root.querySelector("[data-field-a]"),
      fieldB: root.querySelector("[data-field-b]"),
      histogram: root.querySelector("[data-histogram]"),
      correlation: root.querySelector("[data-correlation]"),
      spectrum: root.querySelector("[data-spectrum]"),
      result: root.querySelector("[data-result]"),
      viewButtons: Array.from(root.querySelectorAll("[data-view-button]")),
      views: Array.from(root.querySelectorAll("[data-view]"))
    };

    const state = {
      seed: 20260829,
      mass: Number(elements.mass.value),
      revealed: false,
      activeView: "fields",
      kindA: "white",
      kindB: "vacuum",
      data: null
    };

    function setView(view) {
      state.activeView = view;
      for (const button of elements.viewButtons) {
        button.setAttribute("aria-selected", button.dataset.viewButton === view ? "true" : "false");
      }
      for (const panel of elements.views) panel.hidden = panel.dataset.view !== view;
    }

    function prepareData() {
      const swap = state.seed % 2 === 0;
      state.kindA = swap ? "vacuum" : "white";
      state.kindB = swap ? "white" : "vacuum";

      const whiteTheory = normalizedTheoryPower("white", state.mass, GRID_SIZE);
      const vacuumTheory = normalizedTheoryPower("vacuum", state.mass, GRID_SIZE);
      const theories = {white: whiteTheory, vacuum: vacuumTheory};

      const displayA = gaussianSpectrum(theories[state.kindA], state.seed + 101, GRID_SIZE);
      const displayB = gaussianSpectrum(theories[state.kindB], state.seed + 907, GRID_SIZE);
      const fieldA = inverseTransform(displayA, GRID_SIZE);
      const fieldB = inverseTransform(displayB, GRID_SIZE);

      const histogramWhite = ensembleFieldValues(
        whiteTheory,
        state.seed + 70001,
        GRID_SIZE,
        HISTOGRAM_CONFIGURATIONS
      );
      const histogramVacuum = ensembleFieldValues(
        vacuumTheory,
        state.seed + 90001,
        GRID_SIZE,
        HISTOGRAM_CONFIGURATIONS
      );
      const histogramValues = {white: histogramWhite, vacuum: histogramVacuum};

      const measuredWhite = averageSpectrumPower(
        whiteTheory,
        state.seed + 12011,
        GRID_SIZE,
        SPECTRUM_ENSEMBLE_SIZE
      );
      const measuredVacuum = averageSpectrumPower(
        vacuumTheory,
        state.seed + 47017,
        GRID_SIZE,
        SPECTRUM_ENSEMBLE_SIZE
      );
      const measured = {white: measuredWhite, vacuum: measuredVacuum};

      state.data = {
        theories,
        measured,
        fieldA,
        fieldB,
        histogramA: histogramValues[state.kindA],
        histogramB: histogramValues[state.kindB],
        corrA: correlationFromPower(measured[state.kindA], GRID_SIZE),
        corrB: correlationFromPower(measured[state.kindB], GRID_SIZE),
        corrTheoryA: correlationFromPower(theories[state.kindA], GRID_SIZE),
        corrTheoryB: correlationFromPower(theories[state.kindB], GRID_SIZE),
        spectrumA: radialSpectrum(measured[state.kindA], GRID_SIZE),
        spectrumB: radialSpectrum(measured[state.kindB], GRID_SIZE),
        spectrumTheoryA: radialSpectrum(theories[state.kindA], GRID_SIZE),
        spectrumTheoryB: radialSpectrum(theories[state.kindB], GRID_SIZE)
      };
    }

    function drawHistogram() {
      const minimum = -3.6;
      const maximum = 3.6;
      const histA = histogram(state.data.histogramA, minimum, maximum, HISTOGRAM_BINS);
      const histB = histogram(state.data.histogramB, minimum, maximum, HISTOGRAM_BINS);
      const normal = Array.from({length: 241}, (_, index) => {
        const x = minimum + index * (maximum - minimum) / 240;
        return {x, y: normalDensity(x)};
      });
      const frame = chartFrame(elements.histogram, {
        xMin: minimum,
        xMax: maximum,
        yMin: 0,
        yMax: 0.52,
        xLabel: "значение поля",
        yLabel: "плотность",
        xTicks: 6,
        yTicks: 5,
        xFormat: value => value.toFixed(1),
        yFormat: value => value.toFixed(1)
      });
      drawSeries(frame, normal, COLOR_THEORY, 2.5, [9, 7]);
      drawSeries(frame, histA, COLOR_A, 4);
      drawSeries(frame, histB, COLOR_B, 4);
      drawLegend(elements.histogram, [
        {label: labelledPanel("A", state.kindA, state.revealed), color: COLOR_A},
        {label: labelledPanel("B", state.kindB, state.revealed), color: COLOR_B},
        {label: "N(0,1)", color: COLOR_THEORY, width: 2.5, dash: [9, 7]}
      ]);
    }

    function drawCorrelation() {
      const frame = chartFrame(elements.correlation, {
        xMin: 0,
        xMax: GRID_SIZE / 2,
        yMin: -0.16,
        yMax: 1.06,
        xLabel: "разделение r в шагах решётки",
        yLabel: "C(r) / C(0)",
        xTicks: 8,
        yTicks: 6,
        xFormat: value => value.toFixed(0),
        yFormat: value => value.toFixed(1)
      });
      drawSeries(frame, state.data.corrA, COLOR_A, 4);
      drawSeries(frame, state.data.corrB, COLOR_B, 4);
      if (state.revealed) {
        drawSeries(frame, state.data.corrTheoryA, COLOR_A, 2, [8, 6]);
        drawSeries(frame, state.data.corrTheoryB, COLOR_B, 2, [8, 6]);
      }
      const entries = [
        {label: labelledPanel("A", state.kindA, state.revealed), color: COLOR_A},
        {label: labelledPanel("B", state.kindB, state.revealed), color: COLOR_B}
      ];
      if (state.revealed) {
        entries.push({label: "теория A", color: COLOR_A, width: 2, dash: [8, 6]});
        entries.push({label: "теория B", color: COLOR_B, width: 2, dash: [8, 6]});
      }
      drawLegend(elements.correlation, entries);
    }

    function drawSpectrum() {
      const allPoints = [
        ...state.data.spectrumA,
        ...state.data.spectrumB,
        ...state.data.spectrumTheoryA,
        ...state.data.spectrumTheoryB
      ];
      const maximum = Math.max(...allPoints.map(point => point.y)) * 1.12;
      const frame = chartFrame(elements.spectrum, {
        xMin: 0,
        xMax: Math.sqrt(8),
        yMin: 0,
        yMax: maximum,
        xLabel: "решёточный импульс |k̂|",
        yLabel: "мощность одной моды",
        xTicks: 7,
        yTicks: 5,
        xFormat: value => value.toFixed(1),
        yFormat: value => value.toFixed(1)
      });
      drawSeries(frame, state.data.spectrumA, COLOR_A, 4);
      drawSeries(frame, state.data.spectrumB, COLOR_B, 4);
      if (state.revealed) {
        drawSeries(frame, state.data.spectrumTheoryA, COLOR_A, 2, [8, 6]);
        drawSeries(frame, state.data.spectrumTheoryB, COLOR_B, 2, [8, 6]);
      }
      const entries = [
        {label: labelledPanel("A", state.kindA, state.revealed), color: COLOR_A},
        {label: labelledPanel("B", state.kindB, state.revealed), color: COLOR_B}
      ];
      if (state.revealed) {
        entries.push({label: "теория A", color: COLOR_A, width: 2, dash: [8, 6]});
        entries.push({label: "теория B", color: COLOR_B, width: 2, dash: [8, 6]});
      }
      drawLegend(elements.spectrum, entries);
    }

    function render() {
      elements.massValue.value = state.mass.toFixed(2);
      elements.labelA.textContent = labelledPanel("A", state.kindA, state.revealed);
      elements.labelB.textContent = labelledPanel("B", state.kindB, state.revealed);
      elements.reveal.textContent = state.revealed ? "Скрыть ответ" : "Показать ответ";

      drawField(elements.fieldA, state.data.fieldA, GRID_SIZE);
      drawField(elements.fieldB, state.data.fieldB, GRID_SIZE);
      drawHistogram();
      drawCorrelation();
      drawSpectrum();

      if (state.revealed) {
        elements.result.classList.add("is-revealed");
        elements.result.innerHTML = `<strong>A — ${modelName(state.kindA)}; B — ${modelName(state.kindB)}.</strong> `
          + "Гистограммы почти совпадают, но только белый шум имеет плоский спектр и коррелятор, исчезающий при r > 0.";
      } else {
        elements.result.classList.remove("is-revealed");
        elements.result.textContent = "Сначала сравните поля и гистограммы, затем перейдите к коррелятору и спектру.";
      }
    }

    function rebuild() {
      prepareData();
      render();
    }

    for (const button of elements.viewButtons) {
      button.addEventListener("click", () => setView(button.dataset.viewButton));
    }

    elements.regenerate.addEventListener("click", () => {
      state.seed += 1;
      state.revealed = false;
      rebuild();
    });

    elements.reveal.addEventListener("click", () => {
      state.revealed = !state.revealed;
      render();
    });

    elements.mass.addEventListener("input", () => {
      elements.massValue.value = Number(elements.mass.value).toFixed(2);
    });

    elements.mass.addEventListener("change", () => {
      state.mass = Number(elements.mass.value);
      rebuild();
    });

    setView(state.activeView);
    rebuild();
  }

  function start() {
    document.querySelectorAll("[data-vacuum-noise-lab]").forEach(initLab);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
