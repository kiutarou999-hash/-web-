/* =========================================================
   軽量な折れ線グラフ（外部ライブラリ不使用・SVG）
   Inari.lineChart(container, {
     series: [{ label, color, points: [{ t: Date|ISO, v: number }] }],
     emptyText: "..."
   })
   ========================================================= */
(function () {
  "use strict";
  var U = window.Inari;
  var NS = "http://www.w3.org/2000/svg";

  function el(name, attrs) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function niceTicks(min, max, count) {
    if (min === max) {
      var pad = Math.abs(min) * 0.1 || 1;
      min -= pad; max += pad;
    }
    var span = max - min;
    var step = Math.pow(10, Math.floor(Math.log10(span / count)));
    var err = (count * step) / span;
    if (err <= 0.15) step *= 10;
    else if (err <= 0.35) step *= 5;
    else if (err <= 0.75) step *= 2;
    var lo = Math.floor(min / step) * step;
    var hi = Math.ceil(max / step) * step;
    var ticks = [];
    for (var v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(10));
    return { min: lo, max: hi, ticks: ticks };
  }

  function fmtTime(d, spanMs) {
    var p = function (n) { return String(n).padStart(2, "0"); };
    if (spanMs <= 2 * 864e5) return p(d.getHours()) + ":" + p(d.getMinutes());
    return (d.getMonth() + 1) + "/" + d.getDate();
  }

  function lineChart(container, opts) {
    container.innerHTML = "";
    container.style.position = "relative";
    var series = (opts.series || []).map(function (s) {
      return {
        label: s.label,
        color: s.color,
        points: (s.points || [])
          .map(function (p) { return { t: new Date(p.t), v: p.v }; })
          .filter(function (p) { return !isNaN(p.t) && U.isNum(p.v); })
          .sort(function (a, b) { return a.t - b.t; })
      };
    }).filter(function (s) { return s.points.length > 0; });

    var total = series.reduce(function (n, s) { return n + s.points.length; }, 0);
    if (total < 2) {
      container.innerHTML = '<div class="chart-empty">' + U.esc(opts.emptyText || "表示できる履歴データがまだありません。") + "</div>";
      return;
    }

    var W = 680, H = 260, m = { t: 12, r: 16, b: 28, l: 58 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;

    var tMin = Infinity, tMax = -Infinity, vMin = Infinity, vMax = -Infinity;
    series.forEach(function (s) {
      s.points.forEach(function (p) {
        tMin = Math.min(tMin, +p.t); tMax = Math.max(tMax, +p.t);
        vMin = Math.min(vMin, p.v); vMax = Math.max(vMax, p.v);
      });
    });
    if (opts.from) tMin = Math.min(tMin, +opts.from);
    if (opts.to) tMax = Math.max(tMax, +opts.to);
    if (tMin === tMax) { tMin -= 36e5; tMax += 36e5; }
    var y = niceTicks(vMin, vMax, 4);

    var sx = function (t) { return m.l + ((t - tMin) / (tMax - tMin)) * iw; };
    var sy = function (v) { return m.t + ih - ((v - y.min) / (y.max - y.min)) * ih; };

    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, class: "chart-svg", role: "img", "aria-label": opts.ariaLabel || "価格推移グラフ" });

    y.ticks.forEach(function (v) {
      svg.appendChild(el("line", { x1: m.l, x2: W - m.r, y1: sy(v), y2: sy(v), class: "grid-line" }));
      var lb = el("text", { x: m.l - 8, y: sy(v) + 4, "text-anchor": "end", class: "axis-label" });
      lb.textContent = U.num(v);
      svg.appendChild(lb);
    });

    var span = tMax - tMin;
    for (var i = 0; i <= 4; i++) {
      var t = tMin + (span * i) / 4;
      var lx = el("text", { x: sx(t), y: H - 8, "text-anchor": i === 0 ? "start" : i === 4 ? "end" : "middle", class: "axis-label" });
      lx.textContent = fmtTime(new Date(t), span);
      svg.appendChild(lx);
    }

    series.forEach(function (s) {
      var d = s.points.map(function (p, i) { return (i ? "L" : "M") + sx(+p.t).toFixed(1) + " " + sy(p.v).toFixed(1); }).join("");
      svg.appendChild(el("path", { d: d, fill: "none", stroke: s.color, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }));
      if (s.points.length <= 40) {
        s.points.forEach(function (p) {
          svg.appendChild(el("circle", { cx: sx(+p.t), cy: sy(p.v), r: 2.5, fill: s.color }));
        });
      }
    });

    // ホバー
    var guide = el("line", { y1: m.t, y2: m.t + ih, stroke: "#9aa59e", "stroke-dasharray": "3 3", opacity: 0 });
    svg.appendChild(guide);
    var hit = el("rect", { x: m.l, y: m.t, width: iw, height: ih, fill: "transparent" });
    svg.appendChild(hit);

    var tip = document.createElement("div");
    tip.className = "chart-tip";
    container.appendChild(svg);
    container.appendChild(tip);

    var legend = document.createElement("div");
    legend.className = "chart-legend";
    legend.innerHTML = series.map(function (s) { return '<span style="--c:' + s.color + '">' + U.esc(s.label) + "</span>"; }).join("");
    container.appendChild(legend);

    function nearest(points, t) {
      var best = null, bd = Infinity;
      points.forEach(function (p) { var d = Math.abs(+p.t - t); if (d < bd) { bd = d; best = p; } });
      return best;
    }

    function move(ev) {
      var rect = svg.getBoundingClientRect();
      var cx = ((ev.clientX - rect.left) / rect.width) * W;
      var t = tMin + ((cx - m.l) / iw) * span;
      var ref = nearest(series[0].points, t);
      var lines = [U.date(ref.t, true)];
      series.forEach(function (s) {
        var p = nearest(s.points, +ref.t);
        lines.push(s.label + ": " + U.num(p.v));
      });
      var x = sx(+ref.t);
      guide.setAttribute("x1", x); guide.setAttribute("x2", x); guide.setAttribute("opacity", 1);
      tip.innerHTML = lines.map(U.esc).join("<br>");
      tip.style.left = (x / W) * rect.width + "px";
      tip.style.top = (sy(ref.v) / H) * rect.height + "px";
      tip.classList.add("show");
    }
    function leave() { guide.setAttribute("opacity", 0); tip.classList.remove("show"); }
    hit.addEventListener("pointermove", move);
    hit.addEventListener("pointerdown", move);
    hit.addEventListener("pointerleave", leave);
  }

  U.lineChart = lineChart;
})();
