/* ==========================================================================
   ralfw.de Archiv — Zeitstrahl, Filter, Suche, Beitrags-Panel
   Keine Bibliotheken, keine externen Aufrufe.
   ========================================================================== */
(function(){
"use strict";

var BASE = document.body.dataset.base || "/";
var LANES = ["04-weblogs.aspnet","02-blog.ralfw.de","05-soziokratie","03-geekswithblogs","01-ralfw.de"];
var COLOR = {
  "02-blog.ralfw.de":"--s-02","05-soziokratie":"--s-05",
  "03-geekswithblogs":"--s-03","01-ralfw.de":"--s-01","04-weblogs.aspnet":"--s-04"
};
var D0 = Date.UTC(2003,0,1), D1 = Date.UTC(2023,0,1);

var ARTS = [], SRCMAP = {}, view = {a:D0,b:D1}, off = {}, query = "", current = null;
var SEARCH = null, searchState = "idle";
var PHRA = null, phrState = "idle";
var QRY = null, HITS = null, SCORE = null, HLT = [];

var plot = document.getElementById("plot"), cv = document.getElementById("cv");
var ctx = cv.getContext("2d");
var axis = document.getElementById("axis"), tip = document.getElementById("tip");
var cardsEl = document.getElementById("cards"), countEl = document.getElementById("count");
var panel = document.getElementById("panel"), main = document.getElementById("main");
var rangeEl = document.getElementById("range");
var LANE_H = 26, PAD_T = 8, DENS_H = 46;

function cssv(n){ return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
function col(k){ return cssv(COLOR[k] || "--s-04"); }
function esc(s){ return (s||"").replace(/[&<>"]/g,function(c){
  return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
function fmt(d){
  var p = d.split("-"), M = ["Jan.","Feb.","März","April","Mai","Juni","Juli","Aug.","Sept.","Okt.","Nov.","Dez."];
  return (+p[2]) + ". " + M[+p[1]-1] + " " + p[0];
}

/* ---------------------------------------------------------------- Start */
/* Die Datendateien tragen dieselbe Versionskennung wie CSS und JS, sonst zeigt
   ein zwischengespeichertes articles.json ein veraltetes Archiv an. */
var DV = window.__dataV || {};
fetch(BASE + "data/articles.json" + (DV.a ? "?v=" + DV.a : ""))
  .then(function(r){ return r.json(); })
  .then(function(data){
    SRCMAP = {}; data.sources.forEach(function(s){ SRCMAP[s.key] = s; });
    ARTS = data.articles;
    ARTS.forEach(function(a, i){ a.time = Date.parse(a.d); a.i = i; });
    buildGutter(data.sources);
    plot.style.height = (LANES.length*LANE_H + PAD_T + DENS_H + 26) + "px";
    buildDensity();
    render();
    window.addEventListener("popstate", onPop);
    onPop();
  })
  .catch(function(){
    countEl.textContent = "Das Archiv konnte nicht geladen werden.";
  });

/* ------------------------------------------------------------- Legende */
function buildGutter(sources){
  var gutter = document.getElementById("gutter"), srcsEl = document.getElementById("srcs");
  LANES.forEach(function(k){
    var s = SRCMAP[k]; if(!s) return;
    var el = document.createElement("div");
    el.className = "tl-lane-label"; el.dataset.k = k;
    el.innerHTML = '<span class="tl-swatch"></span><span class="tl-lane-name"></span>';
    el.querySelector(".tl-swatch").style.background = "var(" + COLOR[k] + ")";
    el.querySelector(".tl-lane-name").textContent = s.label;
    el.title = s.platform + " · " + s.from + "–" + s.to + " · " + s.fate;
    el.onclick = function(){ toggle(k); };
    gutter.appendChild(el);
  });
  sources.forEach(function(s){
    var n = ARTS.filter(function(a){ return a.s === s.key; }).length;
    var b = document.createElement("button");
    b.className = "src"; b.dataset.k = s.key; b.type = "button";
    b.innerHTML = '<span class="tl-swatch"></span><span class="src-name"></span><span class="src-n"></span>';
    b.querySelector(".tl-swatch").style.background = "var(" + COLOR[s.key] + ")";
    b.querySelector(".src-name").textContent = s.label;
    b.querySelector(".src-n").textContent = n || "–";
    b.title = s.platform + " · " + s.fate;
    b.onclick = function(){ toggle(s.key); };
    srcsEl.appendChild(b);
  });
}
function toggle(k){
  off[k] = !off[k];
  document.querySelectorAll('[data-k="' + k + '"]').forEach(function(e){
    e.classList.toggle("off", !!off[k]);
  });
  render();
}

/* ------------------------------------------------------------ Zeitstrahl */
var dens = [], densMax = 1;
function buildDensity(){
  var m = {};
  ARTS.forEach(function(a){
    var d = new Date(a.time), k = d.getUTCFullYear() + "-" + Math.floor(d.getUTCMonth()/3);
    m[k] = (m[k]||0) + 1;
  });
  dens = [];
  for(var y=2003;y<=2022;y++) for(var q=0;q<4;q++)
    dens.push({t:Date.UTC(y,q*3,1), n:m[y+"-"+q]||0});
  densMax = Math.max.apply(null, dens.map(function(d){ return d.n; })) || 1;
}
function x(t){ return (t - view.a) / (view.b - view.a) * cv.clientWidth; }
function tAt(px){ return view.a + px / cv.clientWidth * (view.b - view.a); }

function draw(){
  var w = plot.clientWidth, h = plot.clientHeight, dpr = window.devicePixelRatio || 1;
  if(!w || !dens.length) return;   // vor dem Laden der Daten gibt es nichts zu zeichnen
  cv.width = w*dpr; cv.height = h*dpr; ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,w,h);
  var rule = cssv("--rule"), ruleS = cssv("--rule-strong"), faint = cssv("--ink-faint");
  var paper = cssv("--paper");
  var by = PAD_T + LANES.length*LANE_H + 12;

  /* Dichteband */
  ctx.beginPath(); ctx.moveTo(0, by+DENS_H-14);
  dens.forEach(function(d){ ctx.lineTo(x(d.t), by+DENS_H-14 - (d.n/densMax)*(DENS_H-16)); });
  ctx.lineTo(x(dens[dens.length-1].t)+8, by+DENS_H-14);
  ctx.closePath();
  ctx.fillStyle = rule; ctx.globalAlpha = .85; ctx.fill(); ctx.globalAlpha = 1;
  ctx.strokeStyle = ruleS; ctx.lineWidth = 1; ctx.beginPath();
  dens.forEach(function(d,i){
    var px = x(d.t), py = by+DENS_H-14 - (d.n/densMax)*(DENS_H-16);
    i ? ctx.lineTo(px,py) : ctx.moveTo(px,py);
  });
  ctx.stroke();
  ctx.fillStyle = faint; ctx.font = '9px "IBM Plex Mono", monospace';
  ctx.fillText("Beiträge je Quartal", 1, by+9);

  /* Jahresraster */
  var span = (view.b - view.a) / 31557600000;
  var stepY = span > 28 ? 5 : span > 14 ? 2 : 1;
  ctx.strokeStyle = rule; ctx.lineWidth = 1;
  for(var y=2003;y<=2023;y++){
    if((y-2000) % stepY) continue;
    var px = Math.round(x(Date.UTC(y,0,1))) + .5;
    if(px < -20 || px > w+20) continue;
    ctx.beginPath(); ctx.moveTo(px, PAD_T-4); ctx.lineTo(px, by+DENS_H-14); ctx.stroke();
  }

  /* Spuren */
  LANES.forEach(function(k,i){
    var s = SRCMAP[k]; if(!s) return;
    var yy = PAD_T + i*LANE_H + LANE_H/2;
    var items = ARTS.filter(function(a){ return a.s === k; });
    var a0 = items.length ? items[0].time : Date.UTC(+s.from,0,1);
    var a1 = items.length ? items[items.length-1].time : Date.UTC(+s.to,11,31);
    var c = col(k);
    ctx.globalAlpha = off[k] ? .22 : 1;
    ctx.strokeStyle = c; ctx.lineWidth = 1;
    if(!items.length) ctx.setLineDash([3,3]);
    ctx.beginPath(); ctx.moveTo(x(a0), yy); ctx.lineTo(x(a1), yy); ctx.stroke();
    ctx.setLineDash([]);
    [a0,a1].forEach(function(tt){
      ctx.beginPath(); ctx.moveTo(x(tt), yy-4); ctx.lineTo(x(tt), yy+4); ctx.stroke();
    });
    if(!items.length){
      ctx.fillStyle = c; ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.fillText("Rekonstruktion läuft", x(a0)+7, yy-6);
    }
    items.forEach(function(a){
      var px = x(a.time);
      if(px < -6 || px > w+6) return;
      ctx.beginPath(); ctx.arc(px, yy, a === current ? 4.2 : 2.6, 0, 6.2832);
      ctx.fillStyle = c; ctx.fill();
      if(a === current){ ctx.strokeStyle = paper; ctx.lineWidth = 1.6; ctx.stroke(); }
    });
    ctx.globalAlpha = 1;
  });

  axis.innerHTML = "";
  for(var y2=2003;y2<=2023;y2++){
    if((y2-2000) % stepY) continue;
    var px2 = x(Date.UTC(y2,0,1));
    if(px2 < 8 || px2 > w-8) continue;
    var d2 = document.createElement("div");
    d2.className = "tl-tick" + (y2 % 10 === 0 ? " maj" : "");
    d2.style.left = px2 + "px"; d2.textContent = y2;
    axis.appendChild(d2);
  }
}

plot.addEventListener("wheel", function(e){
  e.preventDefault();
  var r = plot.getBoundingClientRect(), px = e.clientX - r.left;
  var t = tAt(px), f = Math.exp((e.deltaY||0) * 0.0016);
  var na = t - (t-view.a)*f, nb = t + (view.b-t)*f;
  var minSpan = 60*86400000, maxSpan = D1-D0;
  if(nb-na < minSpan){ var c=(na+nb)/2; na=c-minSpan/2; nb=c+minSpan/2; }
  if(nb-na > maxSpan){ na=D0; nb=D1; }
  if(na<D0){ nb += D0-na; na=D0; }
  if(nb>D1){ na -= nb-D1; nb=D1; }
  view.a = Math.max(D0,na); view.b = Math.min(D1,nb);
  render();
}, {passive:false});

var drag = null;
plot.addEventListener("pointerdown", function(e){
  drag = {x:e.clientX, a:view.a, b:view.b, moved:false};
  plot.classList.add("drag"); plot.setPointerCapture(e.pointerId);
});
plot.addEventListener("pointermove", function(e){
  var r = plot.getBoundingClientRect();
  if(drag){
    var dx = e.clientX - drag.x;
    if(Math.abs(dx) > 3) drag.moved = true;
    var dt = dx / cv.clientWidth * (drag.b - drag.a);
    var na = drag.a - dt, nb = drag.b - dt;
    if(na<D0){ nb += D0-na; na=D0; }
    if(nb>D1){ na -= nb-D1; nb=D1; }
    view.a = na; view.b = nb; render();
    return;
  }
  hover(e.clientX - r.left, e.clientY - r.top);
});
window.addEventListener("pointerup", function(){
  if(drag){ plot.classList.remove("drag"); setTimeout(function(){ drag = null; },0); }
});
plot.addEventListener("pointerleave", function(){ tip.classList.remove("on"); });
plot.addEventListener("click", function(e){
  if(drag && drag.moved) return;
  var r = plot.getBoundingClientRect();
  var hit = nearest(e.clientX - r.left, e.clientY - r.top);
  if(hit) open(hit, true);
});

function nearest(px, py){
  var best = null, bd = 1e9;
  LANES.forEach(function(k,i){
    if(off[k]) return;
    var yy = PAD_T + i*LANE_H + LANE_H/2;
    if(Math.abs(py-yy) > 11) return;
    ARTS.forEach(function(a){
      if(a.s !== k) return;
      var d = Math.abs(x(a.time) - px);
      if(d < bd && d < 7){ bd = d; best = a; }
    });
  });
  return best;
}
function hover(px, py){
  var a = nearest(px, py);
  plot.classList.toggle("over-dot", !!a);   // über einem Beitrag: Zeigefinger statt Greifhand
  if(!a){ tip.classList.remove("on"); return; }
  tip.innerHTML = '<span class="d">' + fmt(a.d) + " · " + esc(SRCMAP[a.s].label) + "</span>" + esc(a.t);
  tip.classList.add("on");
  tip.style.left = Math.min(Math.max(px+12, 4), plot.clientWidth-300) + "px";
  tip.style.top = (py+14) + "px";
}

/* ------------------------------------------------------------- Suchwerk */
/* Der Index kommt aus build.py. search.json trägt die sortierte Wortliste w
   und zu jedem Wort seine Fundstellen p als Folge "beitragsabstand.häufigkeit"
   in Hexadezimal. phrases.json trägt zu denselben Wörtern alle Wortpositionen
   und wird nur geladen, wenn jemand nach einer Wendung in Anführungszeichen
   sucht — die Datei ist rund dreimal so groß.                              */

var postCache = {}, posCache = {};

function decPost(i){                      /* → [[beitrag, häufigkeit], …] */
  if(postCache[i]) return postCache[i];
  var s = SEARCH.p[i], out = [], prev = 0;
  if(s) s.split(" ").forEach(function(e){
    var a = e.split(".");
    prev += parseInt(a[0],16);
    out.push([prev, parseInt(a[1],16)]);
  });
  return (postCache[i] = out);
}
function decPos(i){                       /* → {beitrag: [positionen], …} */
  if(posCache[i]) return posCache[i];
  var s = PHRA.p[i], out = {}, prevd = 0;
  if(s) s.split("|").forEach(function(seg){
    var a = seg.split("."), ps = [], p = 0;
    prevd += parseInt(a[0],16);
    for(var j=1;j<a.length;j++){ p += parseInt(a[j],16); ps.push(p); }
    out[prevd] = ps;
  });
  return (posCache[i] = out);
}
function hasPos(arr, v){
  var lo = 0, hi = arr.length-1;
  while(lo <= hi){ var m = (lo+hi) >> 1;
    if(arr[m] === v) return true;
    if(arr[m] <  v) lo = m+1; else hi = m-1; }
  return false;
}

/* Die Wortliste ist sortiert, also stehen alle Wörter mit gleichem Anfang
   beieinander. Ein binärer Sprung an den Anfang genügt.                    */
function lowerBound(t){
  var lo = 0, hi = SEARCH.w.length;
  while(lo < hi){ var m = (lo+hi) >> 1; if(SEARCH.w[m] < t) lo = m+1; else hi = m; }
  return lo;
}
var MAXEXP = 400;
function expand(t){
  var i = lowerBound(t), out = [];
  while(i < SEARCH.w.length && SEARCH.w[i].indexOf(t) === 0 && out.length < MAXEXP){
    out.push(i); i++;
  }
  return out;
}
function exactWord(t){
  var i = lowerBound(t);
  return (i < SEARCH.w.length && SEARCH.w[i] === t) ? i : -1;
}

/* "pile engine" → genaue Wendung. pile engine → beide Wörter, UND-verknüpft. */
function parseQuery(raw){
  var phrases = [];
  var rest = raw.replace(/"([^"]+)"|„([^“]+)“|“([^”]+)”/g, function(all, a, b, c){
    var ws = (a||b||c).toLowerCase().match(/[a-zäöüß0-9]{3,}/g);
    if(ws && ws.length) phrases.push(ws);
    return " ";
  });
  var terms = rest.toLowerCase().match(/[a-zäöüß0-9]{2,}/g) || [];
  if(!phrases.length && !terms.length) return null;
  var hl = terms.slice();
  phrases.forEach(function(p){ hl = hl.concat(p); });
  return {phrases: phrases, terms: terms, hl: hl};
}

/* Der Index kennt nur den Fließtext. Titel werden hier gesondert geprüft. */
function titleWords(a){
  if(!a._tw) a._tw = a.t.toLowerCase().match(/[a-zäöüß0-9]+/g) || [];
  return a._tw;
}
function titleHas(a, t){
  var ws = titleWords(a);
  for(var i=0;i<ws.length;i++) if(ws[i].indexOf(t) === 0) return true;
  return false;
}
function titleHasPhrase(a, ws){
  return titleWords(a).join(" ").indexOf(ws.join(" ")) >= 0;
}

function termSet(t, score){
  var set = {}, ex = expand(t);
  ex.forEach(function(wi){
    var post = decPost(wi);
    var idf = Math.log(1 + SEARCH.n / (1 + post.length));
    var w = (SEARCH.w[wi] === t) ? 1.6 : 1;       /* das getippte Wort zählt mehr */
    for(var k=0;k<post.length;k++){
      var d = post[k][0];
      set[d] = 1;
      score[d] = (score[d]||0) + idf * (1 + Math.log(post[k][1])) * w;
    }
  });
  ARTS.forEach(function(a){
    if(titleHas(a, t)){ set[a.i] = 1; score[a.i] = (score[a.i]||0) + 4; }
  });
  return set;
}

function phraseSet(ws, score){
  var maps = [], i;
  for(i=0;i<ws.length;i++){
    var wi = exactWord(ws[i]);
    if(wi < 0){ maps = null; break; }
    maps.push(decPos(wi));
  }
  var set = {};
  if(maps){
    for(var d in maps[0]){
      var starts = maps[0][d], hits = 0;
      for(var k=0;k<starts.length;k++){
        var ok = true;
        for(var m=1;m<maps.length;m++){
          var pl = maps[m][d];
          if(!pl || !hasPos(pl, starts[k]+m)){ ok = false; break; }
        }
        if(ok) hits++;
      }
      if(hits){ set[d] = 1; score[d] = (score[d]||0) + 6 + Math.log(1+hits); }
    }
  }
  ARTS.forEach(function(a){
    if(titleHasPhrase(a, ws)){ set[a.i] = 1; score[a.i] = (score[a.i]||0) + 8; }
  });
  return set;
}

function runQuery(){
  HITS = null; SCORE = null; HLT = QRY ? QRY.hl : [];
  if(!QRY || !SEARCH) return;              /* ohne Index greift die Notsuche */
  var acc = null, score = {};
  function merge(set){
    if(acc === null){ acc = set; return; }
    var out = {};
    for(var d in set) if(acc[d] !== undefined) out[d] = 1;
    acc = out;
  }
  QRY.terms.forEach(function(t){ merge(termSet(t, score)); });
  QRY.phrases.forEach(function(ws){
    if(PHRA) merge(phraseSet(ws, score));
    else ws.forEach(function(t){ merge(termSet(t, score)); });  /* solange nur UND */
  });
  HITS = acc || {}; SCORE = score;
}

function hilite(s){
  s = s || "";
  if(!HLT.length) return esc(s);
  var re = /[a-zäöüß0-9]+/gi, out = "", last = 0, m;
  while((m = re.exec(s))){
    var t = m[0].toLowerCase(), hit = false;
    for(var i=0;i<HLT.length;i++) if(t.indexOf(HLT[i]) === 0){ hit = true; break; }
    if(hit){
      out += esc(s.slice(last, m.index)) + "<mark>" + esc(m[0]) + "</mark>";
      last = m.index + m[0].length;
    }
  }
  return out + esc(s.slice(last));
}

/* ----------------------------------------------------------------- Karten */
var MAXC = 150;
function byDate(p, q2){ return q2.time - p.time; }        /* neueste zuerst */
function inView(a){
  return !off[a.s] && a.time >= view.a && a.time <= view.b;
}
function visible(){
  if(!QRY) return ARTS.filter(inView).sort(byDate);
  if(HITS){
    return ARTS.filter(function(a){ return inView(a) && HITS[a.i] !== undefined; })
               .sort(function(p, q2){
                 var d = (SCORE[q2.i]||0) - (SCORE[p.i]||0);
                 return d || (q2.time - p.time);
               });
  }
  /* Notsuche, bis der Index da ist: Titel und Anriss, alle Wörter müssen vor. */
  return ARTS.filter(function(a){
    if(!inView(a)) return false;
    var hay = (a.t + " " + (a.x||"")).toLowerCase();
    return QRY.hl.every(function(t){ return hay.indexOf(t) >= 0; });
  }).sort(byDate);
}
function renderCards(){
  var list = visible(), n = list.length, txt;
  if(QRY){
    txt = (n === 0 ? "kein Treffer"
                   : n + (n === 1 ? " Treffer" : " Treffer")
                     + (n > MAXC ? " · die " + MAXC + " besten angezeigt" : ""));
    if(searchState === "loading") txt += " · Volltextindex lädt …";
    else if(QRY.phrases.length && phrState === "loading") txt += " · Wendungsindex lädt …";
  } else {
    txt = (n === 0 ? "kein Treffer im Zeitraum"
                   : n + (n === 1 ? " Beitrag" : " Beiträge") + " im gewählten Zeitraum"
                     + (n > MAXC ? " · die ersten " + MAXC + " angezeigt" : ""));
  }
  countEl.textContent = txt;
  cardsEl.innerHTML = "";
  if(!n){
    var e = document.createElement("div"); e.className = "empty";
    e.textContent = QRY
      ? "Dazu steht hier nichts — anderes Wort versuchen, Zeitraum aufziehen oder Filter lösen."
      : "In diesem Zeitraum steht nichts — Zeitraum aufziehen oder Filter lösen.";
    cardsEl.appendChild(e); return;
  }
  var frag = document.createDocumentFragment();
  list.slice(0,MAXC).forEach(function(a){
    var el = document.createElement("a");
    el.className = "card" + (a === current ? " is-on" : "");
    el.href = BASE + a.u;
    el.innerHTML =
      '<span class="card-top"><span class="card-dot"></span><span class="card-src"></span><span class="card-date"></span></span>'
      + (a.th ? '<span class="card-fig"><img loading="lazy" alt=""></span>' : "")
      + '<span class="card-t"></span><span class="card-x"></span>'
      + '<span class="card-foot"><span class="card-sig"></span>'
      + '<span class="cond ' + (a.loss ? "loss" : "ok") + '">' + (a.loss ? "Verlust" : "vollst.") + "</span></span>";
    el.querySelector(".card-dot").style.background = "var(" + COLOR[a.s] + ")";
    el.querySelector(".card-src").textContent = SRCMAP[a.s].label;
    el.querySelector(".card-date").textContent = a.d;
    if(a.th) el.querySelector("img").src = BASE + a.th;
    el.querySelector(".card-t").innerHTML = hilite(a.t);
    el.querySelector(".card-x").innerHTML = hilite(a.x || "");
    el.querySelector(".card-sig").textContent = "/" + a.u.replace(/^archiv\//,"").replace(/\/$/,"");
    el.addEventListener("click", function(ev){
      if(ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button) return;  /* neuer Tab bleibt möglich */
      ev.preventDefault(); open(a, true);
    });
    frag.appendChild(el);
  });
  cardsEl.appendChild(frag);
}

/* ----------------------------------------------------------------- Panel */
var cache = {};
function open(a, push){
  current = a;
  main.classList.add("open"); panel.hidden = false; panel.scrollTop = 0;
  main.classList.toggle("wide", wide);
  var s = SRCMAP[a.s];
  var ps = document.getElementById("pSrc");
  ps.innerHTML = '<span class="tl-swatch"></span>' + esc(s.label);
  ps.querySelector(".tl-swatch").style.background = "var(" + COLOR[a.s] + ")";
  var url = BASE + a.u;
  document.getElementById("pBody").innerHTML =
      '<h1 class="doc-title">' + esc(a.t) + "</h1>"
    + '<div class="doc-meta"><span>' + fmt(a.d) + "</span>"
    + "<span>Erstveröffentlichung: " + esc(s.platform) + "</span>"
    + '<span class="perma"><code>' + esc(location.host + url) + "</code>"
    + '<button type="button" class="copy">Kopieren</button></span></div>'
    + '<div class="art" id="pArt"><p class="loading">wird geladen …</p></div>';
  if(push) history.pushState({u:a.u}, "", url);
  document.title = a.t + " — ralfw.de Archiv";
  renderCards(); draw();

  if(cache[a.u]){ document.getElementById("pArt").innerHTML = cache[a.u]; return; }
  fetch(url)
    .then(function(r){ return r.text(); })
    .then(function(html){
      var doc = new DOMParser().parseFromString(html, "text/html");
      var art = doc.querySelector(".art");
      var body = art ? art.innerHTML : "<p>Der Beitrag konnte nicht geladen werden.</p>";
      cache[a.u] = body;
      if(current === a) document.getElementById("pArt").innerHTML = body;
    })
    .catch(function(){
      if(current === a) document.getElementById("pArt").innerHTML =
        '<p class="note">Der Beitrag konnte nicht geladen werden. '
        + '<a href="' + url + '">Direkt öffnen</a></p>';
    });
}
function close(push){
  current = null; panel.hidden = true; main.classList.remove("open");
  if(push) history.pushState({}, "", BASE);
  document.title = "Archiv — ralfw.de";
  renderCards(); draw();
}
/* Lesemodus: seitlich angedockt oder groß in der Mitte. Bleibt für die Sitzung gemerkt. */
var wideBtn = document.getElementById("pWide");
var wide = false;
try { wide = localStorage.getItem("leseModus") === "gross"; } catch(e){}
function setWide(on){
  wide = on;
  main.classList.toggle("wide", wide);
  if (wideBtn) wideBtn.textContent = wide ? "Andocken" : "Groß lesen";
  try { localStorage.setItem("leseModus", wide ? "gross" : "seitlich"); } catch(e){}
  draw();
}
if (wideBtn) wideBtn.onclick = function(){ setWide(!wide); };
setWide(wide);

document.getElementById("pClose").onclick = function(){ close(true); };
document.getElementById("scrim").onclick = function(){ close(true); };
document.addEventListener("keydown", function(e){
  if(e.key === "Escape" && !panel.hidden) close(true);
});
panel.addEventListener("click", function(e){
  if(e.target.classList && e.target.classList.contains("copy")){
    var code = e.target.closest(".perma").querySelector("code").textContent;
    if(navigator.clipboard) navigator.clipboard.writeText(location.protocol + "//" + code);
    e.target.textContent = "Kopiert";
    setTimeout(function(){ e.target.textContent = "Kopieren"; }, 1400);
  }
});
function onPop(){
  var path = location.pathname;
  var rel = path.indexOf(BASE) === 0 ? path.slice(BASE.length) : path.replace(/^\//,"");
  if(rel && rel.indexOf("archiv/") === 0){
    var a = ARTS.filter(function(z){ return z.u === rel; })[0];
    if(a){ open(a, false); return; }
  }
  if(!panel.hidden) close(false);
}

/* ------------------------------------------------------------------ Suche */
var stateEl = document.getElementById("searchState");
var HINT = "Mehrere Wörter werden UND-verknüpft. „Wendung“ in Anführungszeichen sucht genau so.";

function loadSearch(){
  if(searchState !== "idle") return;
  searchState = "loading";
  stateEl.textContent = "Volltextindex wird geladen …";
  fetch(BASE + "data/search.json" + (DV.s ? "?v=" + DV.s : ""))
    .then(function(r){ return r.json(); })
    .then(function(j){
      SEARCH = j; searchState = "ready";
      postCache = {};
      stateEl.textContent = HINT;
      runQuery(); renderCards();
    })
    .catch(function(){
      searchState = "failed";
      stateEl.textContent = "Volltextindex nicht verfügbar — es wird in Titel und Anriss gesucht.";
      renderCards();
    });
}
function loadPhrases(){
  if(phrState !== "idle") return;
  phrState = "loading";
  fetch(BASE + "data/phrases.json" + (DV.p ? "?v=" + DV.p : ""))
    .then(function(r){ return r.json(); })
    .then(function(j){
      PHRA = j; phrState = "ready"; posCache = {};
      runQuery(); renderCards();
    })
    .catch(function(){
      phrState = "failed";
      stateEl.textContent = "Wendungen lassen sich gerade nicht prüfen — die Wörter werden UND-verknüpft.";
      renderCards();
    });
}
var qt;
document.getElementById("q").oninput = function(e){
  var v = e.target.value;
  clearTimeout(qt);
  qt = setTimeout(function(){
    QRY = parseQuery(v);
    if(QRY){
      loadSearch();
      if(QRY.phrases.length) loadPhrases();
    } else if(searchState === "ready"){
      stateEl.textContent = HINT;
    }
    runQuery(); renderCards();
  }, 140);
};

/* ------------------------------------------------------------------ Rest */
function render(){
  var a = new Date(view.a), b = new Date(view.b);
  var span = (view.b - view.a) / 31557600000;
  rangeEl.textContent = span > 3
    ? a.getUTCFullYear() + " – " + b.getUTCFullYear()
    : a.toISOString().slice(0,7) + " – " + b.toISOString().slice(0,7);
  draw(); renderCards();
}
document.getElementById("reset").onclick = function(){ view.a = D0; view.b = D1; render(); };
window.addEventListener("resize", function(){ draw(); });
})();
