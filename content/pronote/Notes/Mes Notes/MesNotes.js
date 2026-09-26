/* ============================================================
   PAGE NOTES — MES NOTES façon Papillon
   Cible : .InterfaceDernieresNotes de la page « Détail de mes
   notes » (fil d'Ariane h1#breadcrumbBandeau[aria-label=
   "Détail de mes notes"]).

   Ce que fait le module :
   1. pose le marquage idempotent .pap-mn sur la page ;
   2. construit la carte « Moyennes » façon Papillon
      (Averages.tsx) : gros score sur 20, sélecteur d'algorithme
      (moyenne générale / par matière / médiane) et graphique
      SVG de l'historique des moyennes — courbe verte de l'élève
      + courbe pointillée de la moyenne de la classe, avec
      survol/scrub ;
   3. construit le bandeau horizontal des moyennes par matière ;
   4. transforme chaque ligne de note en carte façon Grade.tsx
      (pastille matière, écart à la moyenne de classe, note sur
      20 quand le barème natif est un autre) ;
   5. habille le panneau de détail et son état vide.

   Le restyle est porté par MesNotes.css, le thème
   (html.papillon-dark) par pronote.js. Les contrôles natifs —
   sélecteur de période, radios « Par ordre chronologique / Par
   matière », navigation clavier dans la liste — ne sont jamais
   touchés : on n'ajoute des gestionnaires que sur les éléments
   créés par ce module.

   Le DOM PRONOTE étant reconstruit à chaque navigation, tout est
   idempotent (jetons dataset.pap*) et branché sur le double
   MutationObserver (body + attribut class de <html>).
   ============================================================ */

(() => {
  'use strict';

  /* ---------- Papicons ---------- */
  const ICON_CACHE = new Map();
  const ICON_FILES = { grades: 'grades.svg', ghost: 'ghost.svg' };

  function icon(name) {
    return ICON_CACHE.get(name) || null;
  }

  async function loadIcon(name) {
    const file = ICON_FILES[name];
    if (!file || ICON_CACHE.has(name)) return;
    try {
      const url = chrome.runtime.getURL(`assets/icons/${file}`);
      const res = await fetch(url);
      const text = await res.text();
      ICON_CACHE.set(name, text.replace(/fill="black"/g, 'fill="currentColor"'));
    } catch (e) {
      /* ignore — l'icône est optionnelle */
    }
  }

  function svgWrap(inner, component) {
    const span = document.createElement('span');
    span.className = 'papillon-icon';
    span.dataset.papicon = component;
    span.innerHTML = inner;
    return span;
  }

  /* ---------- Palette officielle Papillon (utils/subjects/colors.ts) ---------- */
  const COLORS = [
    '#C50017', '#DA2400', '#DD6B00', '#E8901C', '#E8B048',
    '#6BAE00', '#37BB12', '#12BB67', '#26B290', '#26ABB2',
    '#2DB9D8', '#009EC5', '#007FDA', '#3A56D0', '#7600CA',
    '#962DD8', '#B300CA', '#C50066', '#DD004A', '#DD0030',
  ];

  function hashColor(subject) {
    let hash = 0;
    const s = String(subject || '');
    for (let i = 0; i < s.length; i++) {
      hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
    }
    return COLORS[Math.abs(hash) % COLORS.length];
  }

  function normalizeSubject(subject) {
    return String(subject || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  const EMOJI_MAP = [
    ['allemand', '🇩🇪'],
    ['anglais', '🇬🇧'],
    ['espagnol', '🇪🇸'],
    ['italien', '🇮🇹'],
    ['mathematique', '🧮'],
    ['math', '🧮'],
    ['physiquechimie', '🧪'],
    ['physique', '🧪'],
    ['chimie', '🧪'],
    ['svt', '🌱'],
    ['science', '🔬'],
    ['histoire', '🌍'],
    ['geo', '🌎'],
    ['geographie', '🌎'],
    ['nsi', '💻'],
    ['informatique', '💻'],
    ['technologie', '⚙️'],
    ['ingenierie', '⚙️'],
    ['ingenier', '⚙️'],
    ['ses', '🏦'],
    ['eps', '⚽'],
    ['educationphysique', '⚽'],
    ['art', '🎨'],
    ['plastique', '🎨'],
    ['musique', '🎵'],
    ['philosophie', '🧠'],
    ['emc', '⚖️'],
    ['enseignement', '⚖️'],
    ['latin', '🏛️'],
    ['grec', '🏺'],
  ];

  function subjectEmoji(subject) {
    const normalized = normalizeSubject(subject);
    for (const [key, emoji] of EMOJI_MAP) {
      if (normalized.includes(key)) return emoji;
    }
    return '📚';
  }

  /* ---------- Nombres ---------- */
  /* parseFr('12,30') → 12.3 ; renvoie null si non numérique */
  function parseFr(text) {
    const n = parseFloat(
      String(text || '')
        .replace(/[\s\u00a0]/g, '')
        .replace(',', '.')
        .replace(/[^0-9.\-]/g, '')
    );
    return isNaN(n) ? null : n;
  }

  /* parsePair('Moyenne classe : 4,72/10') → { value: 4.72, out: 10 }
     parsePair('Note élève : 20,00')    → { value: 20,   out: null } */
  const PAIR_RE = /(-?[\d\s]*[\d](?:[.,][\d]+)?)\s*(?:\/\s*([\d\s]*[\d](?:[.,][\d]+)?))?/;
  function parsePair(text) {
    const m = PAIR_RE.exec(String(text || '').replace(/\u00a0/g, ' '));
    if (!m) return { value: null, out: null };
    return { value: parseFr(m[1]), out: m[2] ? parseFr(m[2]) : null };
  }

  /* 12.3 → '12,30' (format Papillon, virgule décimale) */
  function fmt(value, digits) {
    const d = digits === undefined ? 2 : digits;
    return Number(value).toFixed(d).replace('.', ',');
  }

  /* Ramène une note sur 20 (échelle d'affichage Papillon) */
  function on20(value, out) {
    if (value === null || value === undefined) return null;
    if (out && out > 0) return (value / out) * 20;
    return value;
  }

  /* ---------- Lecture d'une ligne de note ---------- */
  /* datetime="09-22" → { mm: 9, dd: 22 } */
  function readDate(time) {
    const m = /^(\d{1,2})-(\d{1,2})$/.exec((time && time.getAttribute('datetime')) || '');
    if (!m) return null;
    return { mm: +m[1], dd: +m[2] };
  }

  /* Couleur de matière donnée par PRONOTE : inline sur le <time> en mode
     chronologique, sur la pastille .ie-line-color de la ligne d'en-tête de
     matière en mode « Par matière ». */
  function readColor(row) {
    const time = row.querySelector('.zone-gauche time, time');
    const style = (time && time.getAttribute('style')) || '';
    const m = /--color-line\s*:\s*(#[0-9a-f]{3,8})/i.exec(style);
    if (m) return m[1];
    const pastille = row.querySelector('.ie-line-color');
    const s2 = (pastille && pastille.getAttribute('style')) || '';
    const m2 = /--color-line\s*:\s*(#[0-9a-f]{3,8})/i.exec(s2);
    return m2 ? m2[1] : '';
  }

  /* `matiere` / `couleurMatiere` : ce que porte la ligne d'en-tête de
     matière précédente (mode « Par matière »), dont les notes héritent. */
  function readRow(row, matiere, couleurMatiere) {
    const time = row.querySelector('.zone-gauche time, time');
    const lignes = row.querySelectorAll('.zone-principale .titre-principale .ie_ellipsis');

    /* En mode « Par matière », PRONOTE intercale une ligne d'en-tête par
       matière : pas de date, pas de devoir, seulement le nom de la matière
       et sa moyenne. Elle ne doit pas être comptée comme une note (sinon la
       moyenne générale et le graphique intègrent les moyennes de matière),
       et ses notes héritent de sa matière et de sa couleur. */
    const gros = row.querySelector('.zone-principale .titre-principale .ie-titre-gros');
    if (!lignes.length && gros) {
      const mat = (gros.textContent || '').trim();
      return {
        el: row,
        estMatiere: true,
        subject: mat,
        subjectKey: normalizeSubject(mat) || 'note',
        color: readColor(row) || hashColor(mat),
        sig: `M|${mat}`,
      };
    }

    /* Chronologique : 2 lignes (matière puis devoir).
       Par matière : 1 seule ligne, le devoir — la matière vient de l'en-tête
       qui le précède (on ne le sait que si `matiere` est renseignée). */
    const deuxLignes = lignes.length >= 2;
    const uneLigne = lignes.length === 1;
    const mat = deuxLignes
      ? ((lignes[0].textContent || '').trim())
      : (matiere || (uneLigne ? (lignes[0].textContent || '').trim() : ''));
    const devoir = deuxLignes
      ? ((lignes[1].textContent || '').trim())
      : (uneLigne && matiere ? (lignes[0].textContent || '').trim() : '');
    const matKey = mat || 'Note';

    /* Note élève : l'aria-label est la source la plus fiable
       (« Note élève : 10,00/10 »), le .note-devoir sert de repli. */
    const comp = row.querySelector('.zone-complementaire');
    const aria = comp ? comp.getAttribute('aria-label') || '' : '';
    let score = parsePair(aria);
    if (score.value === null) {
      const valeur = row.querySelector('.note-valeur, .note-devoir');
      score = parsePair(valeur ? valeur.textContent : '');
    }
    if (score.out === null && /:\s*-?[\d\s]*[\d](?:[.,][\d]+)?\s*$/.test(aria)) score.out = 20;

    /* Moyenne de classe / de groupe */
    const sousTitre = row.querySelector('.infos-supp .ie-sous-titre');
    const subText = sousTitre ? sousTitre.textContent.trim() : '';
    let clsKind = '';
    if (/moyenne\s+classe/i.test(subText)) clsKind = 'classe';
    else if (/moyenne\s+(de\s+la\s+)?groupe/i.test(subText)) clsKind = 'groupe';
    const cls = parsePair(subText);
    /* « Moyenne groupe : 14,46 » est déjà sur 20 chez PRONOTE */
    const clsOut = cls.out !== null ? cls.out : (cls.value !== null ? 20 : null);

    const pieces = row.querySelectorAll('.zone-message .chips-btn');
    const date = readDate(time);
    const raw = time ? (time.textContent || '').trim() : '';

    if (!mat && score.value === null) return null;

    return {
      el: row,
      estMatiere: false,
      subject: matKey,
      subjectKey: normalizeSubject(mat) || 'note',
      devoir,
      date,
      dateRaw: time ? time.getAttribute('datetime') || '' : '',
      dateLabel: raw,
      color: readColor(row) || couleurMatiere || hashColor(matKey),
      score: score.value,
      out: score.out,
      score20: on20(score.value, score.out),
      clsKind,
      cls: cls.value,
      cls20: on20(cls.value, clsOut),
      pieces: pieces.length,
      sig: [
        time ? time.getAttribute('datetime') || '' : '',
        mat,
        devoir,
        score.value,
        score.out,
        cls.value,
        clsKind,
      ].join('|'),
    };
  }

  function readRows(list) {
    const out = [];
    let matiere = '';
    let couleur = '';
    list.querySelectorAll('.liste_celluleGrid').forEach((row) => {
      const g = readRow(row, matiere, couleur);
      if (!g) return;
      /* ligne d'en-tête de matière : elle porte la matière et sa couleur
         pour les notes suivantes, mais n'est pas une note */
      if (g.estMatiere) {
        matiere = g.subject;
        couleur = g.color;
        return;
      }
      out.push(g);
    });
    return out;
  }

  /* ---------- Tri chronologique ----------
     PRONOTE trie la liste par date, mais on ne parie pas sur le sens
     (croissant ou décroissant) ni sur la présence d'un passage d'année
     (sept. → janv.) : on détecte la direction sur les deux premiers
     mois distincts, on inverse si besoin, puis on « déroule » les mois
     sur une échelle de 12 positions continues. En mode « Par matière »
     l'ordre n'est pas chronologique (sauts de mois dans les deux sens) :
     on suit alors l'ordre d'affichage, qui est celui que l'élève voit. */
  function chrono(list) {
    const items = list.slice();
    let dir = 0;

    for (let i = 1; i < items.length; i++) {
      const a = items[i - 1].date;
      const b = items[i].date;
      if (!a || !b || a.mm === b.mm) continue;
      const d = ((b.mm - a.mm) + 12) % 12;
      if (d <= 2) { dir = 1; break; }
      if (d >= 10) { dir = -1; break; }
    }

    /* Ordre d'affichage : rien à calculer. */
    if (dir === 0) {
      items.forEach((g, i) => { g.order = i; });
      return items;
    }
    if (dir < 0) items.reverse();

    let abs = null;
    let prev = null;
    items.forEach((g) => {
      if (!g.date) { g.order = Infinity; return; }
      if (prev === null) abs = g.date.mm;
      else if (g.date.mm < prev - 6) abs += 12; /* on a repassé en janvier */
      else abs += g.date.mm - prev; /* mois suivant, skipped months included */
      g.order = abs;
      prev = g.date.mm;
    });
    return items.sort((a, b) => a.order - b.order);
  }

  /* ---------- Algorithmes de moyenne (Averages.tsx) ---------- */
  const ALGOS = [
    { id: 'general', label: 'Générale' },
    { id: 'subject', label: 'Par matière' },
    { id: 'median', label: 'Médiane' },
  ];

  function aggregate(items, algo) {
    if (!items.length) return null;
    if (algo === 'median') {
      const vs = items.map((i) => i.v).sort((a, b) => a - b);
      const mid = vs.length >> 1;
      return vs.length % 2 ? vs[mid] : (vs[mid - 1] + vs[mid]) / 2;
    }
    if (algo === 'subject') {
      /* moyenne des moyennes de matière, chaque matière pesant 1 */
      const parMat = new Map();
      items.forEach((it) => {
        if (!parMat.has(it.g.subjectKey)) parMat.set(it.g.subjectKey, []);
        parMat.get(it.g.subjectKey).push(it.v);
      });
      const means = [];
      parMat.forEach((vs) => {
        means.push(vs.reduce((s, v) => s + v, 0) / vs.length);
      });
      return means.reduce((s, v) => s + v, 0) / means.length;
    }
    /* générale : moyenne simple des notes ramenées sur 20 */
    return items.reduce((s, i) => s + i.v, 0) / items.length;
  }

  /* Historique cumulé : à chaque nouvelle note, la moyenne est recalculée
     sur toutes les notes vues jusqu'ici → c'est la courbe de l'application. */
  function history(grades, algo) {
    const out = [];
    const vus = [];
    grades.forEach((g) => {
      if (g.score20 === null) return;
      vus.push({ g, v: g.score20 });
      out.push({
        value: aggregate(vus, algo),
        grade: g,
      });
    });
    return out;
  }

  /* Même chose pour la classe, alignée sur les mêmes abscisses : on
     « porte la dernière valeur connue » quand une note n'a pas de
     moyenne de classe. */
  function classHistory(historyBase, grades) {
    const out = [];
    let last = null;
    historyBase.forEach((pt) => {
      if (pt.grade.clsKind === 'classe' && pt.grade.cls20 !== null) last = pt.grade.cls20;
      out.push({ value: last, grade: pt.grade });
    });
    return out;
  }

  /* ---------- Modèle de la page ---------- */
  function buildModel(list) {
    const rows = chrono(readRows(list).filter((g) => g.score20 !== null));
    const algo = state.algo;
    const hist = history(rows, algo);
    const cls = classHistory(hist, rows);

    /*.Domaines de toutes les valeurs ramenées sur 20 (élève + classe) */
    const valeurs = [];
    hist.forEach((p) => valeurs.push(p.value));
    cls.forEach((p) => { if (p.value !== null) valeurs.push(p.value); });

    /* Regroupement par matière, du plus fort au plus faible */
    const parMat = new Map();
    rows.forEach((g) => {
      if (!parMat.has(g.subjectKey)) parMat.set(g.subjectKey, { subject: g.subject, color: g.color, vs: [] });
      parMat.get(g.subjectKey).vs.push(g.score20);
    });
    const groupes = [];
    parMat.forEach((v) => {
      const moyenne = v.vs.reduce((s, x) => s + x, 0) / v.vs.length;
      groupes.push({ subject: v.subject, color: v.color, moyenne, count: v.vs.length });
    });
    groupes.sort((a, b) => b.moyenne - a.moyenne);

    const notes = hist.map((p) => p.value);
    return {
      rows,
      hist,
      cls,
      groupes,
      valeurs,
      notes,
      final: notes.length ? notes[notes.length - 1] : null,
      scale: chartScale(valeurs),
      periode: periodLabel(),
      sig: [algo, rows.map((g) => g.sig).join(';')].join('#'),
    };
  }

  function periodLabel() {
    const el = document.querySelector(
      '#ligne_bandeau.objetBandeauEntete_thirdmenu .ocb-libelle,' +
        '.objetBandeauEntete_thirdmenu:not(.sr-only) .ocb-libelle'
    );
    return el ? (el.textContent || '').trim() : '';
  }

  /* ---------- Graphique ---------- */
  const CH = { h: 148, pt: 20, pr: 16, pb: 22, pl: 38 };

  /* Échelle verticale : valeurs réelles, jamais amplifiées — on ne ment pas
     sur l'axe des notes. On choisit juste un pas « rond » (1, 2, 5, 10) pour
     que les graduations se lisent comme une échelle de note sur 20. */
  function chartScale(values) {
    if (!values.length) return { lo: 0, hi: 20, ticks: [0, 5, 10, 15, 20] };
    let lo = Math.max(0, Math.min.apply(null, values));
    let hi = Math.min(20, Math.max.apply(null, values));
    if (hi - lo < 1) {
      const c = (lo + hi) / 2;
      lo = c - 1;
      hi = c + 1;
    }
    const step = [1, 2, 5, 10].find((s) => (hi - lo) / s <= 4) || 10;
    lo = Math.max(0, Math.floor(lo / step) * step);
    hi = Math.min(20, Math.ceil(hi / step) * step);
    if (hi - lo < step) hi = Math.min(20, lo + step);
    const ticks = [];
    for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(+v.toFixed(2));
    return { lo, hi, ticks };
  }

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  function scale(series, lo, hi, W) {
    const n = series.length;
    const top = CH.pt;
    const bottom = CH.h - CH.pb;
    const span = bottom - top;
    return series.map((p, i) => ({
      x: n === 1 ? CH.pl + (W - CH.pl - CH.pr) / 2 : CH.pl + (i * (W - CH.pl - CH.pr)) / (n - 1),
      y: p.value === null ? null : bottom - ((p.value - lo) / (hi - lo)) * span,
      p,
    }));
  }

  /* Catmull-Rom → Bézier cubique (lignes lissées façon react-native-graph) */
  function linePath(pts) {
    const valid = pts.filter((q) => q.y !== null);
    if (valid.length < 2) return '';
    let d = `M ${valid[0].x.toFixed(1)} ${valid[0].y.toFixed(1)}`;
    for (let i = 0; i < valid.length - 1; i++) {
      const p0 = valid[i - 1] || valid[i];
      const p1 = valid[i];
      const p2 = valid[i + 1];
      const p3 = valid[i + 2] || p2;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = clamp(p1.y + (p2.y - p0.y) / 6, CH.pt, CH.h - CH.pb);
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = clamp(p2.y - (p3.y - p1.y) / 6, CH.pt, CH.h - CH.pb);
      d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  }

  function svgEl(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  function renderChart(host, model, animate) {
    host.textContent = '';
    const W = Math.max(260, Math.round(host.clientWidth || 560));
    const { lo, hi, ticks } = model.scale;
    const moi = scale(model.hist, lo, hi, W);
    const classe = scale(model.cls, lo, hi, W);
    const aMoi = linePath(moi);
    const aCls = linePath(classe.filter((q) => q.y !== null));

    const svg = svgEl('svg', {
      viewBox: `0 0 ${W} ${CH.h}`,
      width: '100%',
      height: CH.h,
      preserveAspectRatio: 'none',
      role: 'img',
      'aria-label':
        `Évolution de la moyenne : ${model.final !== null ? fmt(model.final) + ' sur 20' : '—'}` +
        `, calculée sur ${model.rows.length} note${model.rows.length > 1 ? 's' : ''}.`,
    });

    const base = CH.h - CH.pb;
    const plot = base - CH.pt;
    const right = W - CH.pr;

    /* ---------- defs : dégradés + halo ---------- */
    const defs = svgEl('defs');

    /* Aire sous la courbe : vert dense en haut → transparent en bas. */
    const area = svgEl('linearGradient', { id: 'papMnArea', x1: '0', y1: '0', x2: '0', y2: '1' });
    area.appendChild(svgEl('stop', { offset: '0%', 'stop-color': 'var(--pap-mn-line)', 'stop-opacity': '.42' }));
    area.appendChild(svgEl('stop', { offset: '55%', 'stop-color': 'var(--pap-mn-line)', 'stop-opacity': '.14' }));
    area.appendChild(svgEl('stop', { offset: '100%', 'stop-color': 'var(--pap-mn-line)', 'stop-opacity': '0' }));
    defs.appendChild(area);

    /* Fond du rectangle de tracé : dégradé très clair, pour « décoller »
       la courbe de la carte sans ajouter de bordure. L'alpha passe par
       stop-opacity : stop-color n'accepte pas partout un rgba(). */
    const plate = svgEl('linearGradient', { id: 'papMnPlate', x1: '0', y1: '0', x2: '0', y2: '1' });
    plate.appendChild(svgEl('stop', { offset: '0%', 'stop-color': 'var(--pap-mn-line)', 'stop-opacity': '.1' }));
    plate.appendChild(svgEl('stop', { offset: '100%', 'stop-color': 'var(--pap-mn-line)', 'stop-opacity': '.01' }));
    defs.appendChild(plate);

    /* Halo de la courbe de l'élève. */
    const glow = svgEl('filter', { id: 'papMnGlow', x: '-25%', y: '-60%', width: '150%', height: '220%' });
    glow.appendChild(svgEl('feGaussianBlur', { stdDeviation: '4.5', result: 'b' }));
    const merge = svgEl('feMerge');
    merge.appendChild(svgEl('feMergeNode', { in: 'b' }));
    merge.appendChild(svgEl('feMergeNode', { in: 'SourceGraphic' }));
    glow.appendChild(merge);
    defs.appendChild(glow);

    svg.appendChild(defs);

    /* ---------- fond du tracé + grille ---------- */
    svg.appendChild(svgEl('rect', {
      x: 0, y: CH.pt - 12, width: W, height: plot + 24,
      rx: 14, fill: 'url(#papMnPlate)', stroke: 'none',
    }));

    ticks.forEach((val) => {
      const y = (base - ((val - lo) / (hi - lo)) * plot).toFixed(1);
      svg.appendChild(svgEl('line', {
        x1: CH.pl, x2: right, y1: y, y2: y, class: 'pap-mn-grid',
      }));
      const label = svgEl('text', { x: CH.pl - 8, y: (+y + 3).toFixed(1), class: 'pap-mn-axis' });
      label.textContent = fmt(val, val % 1 === 0 ? 0 : 1);
      svg.appendChild(label);
    });

    /* ---------- aire ---------- */
    if (aMoi) {
      const last = moi[moi.length - 1];
      const first = moi[0];
      svg.appendChild(svgEl('path', {
        d: `${aMoi} L ${last.x.toFixed(1)} ${base} L ${first.x.toFixed(1)} ${base} Z`,
        class: 'pap-mn-area',
        stroke: 'none',
      }));
    }

    /* ---------- courbes ---------- */
    if (aCls) {
      svg.appendChild(svgEl('path', { d: aCls, class: 'pap-mn-path pap-mn-path-cls' }));
    }
    if (aMoi) {
      svg.appendChild(svgEl('path', { d: aMoi, class: 'pap-mn-path pap-mn-glow', stroke: 'none' }));
      const path = svgEl('path', { d: aMoi, class: 'pap-mn-path pap-mn-path-me' });
      svg.appendChild(path);
      /* Le tracé « se dessine » à l'ouverture : on a besoin de la longueur
         réelle du chemin, qu'on approxime par la largeur du viewBox. */
      if (animate !== false) {
        const len = W + CH.h;
        path.style.strokeDasharray = String(len);
        path.style.strokeDashoffset = String(len);
      }
    }

    /* ---------- points ---------- */
    const lastPts = moi.filter((q) => q.y !== null);
    lastPts.forEach((q, i) => {
      const last = i === lastPts.length - 1;
      if (last) svg.appendChild(svgEl('circle', { cx: q.x, cy: q.y, r: 8, class: 'pap-mn-halo' }));
      svg.appendChild(svgEl('circle', {
        cx: q.x, cy: q.y, r: last ? 3.8 : 2.8, class: last ? 'pap-mn-dot' : 'pap-mn-dot-sm',
      }));
    });

    /* Repère de survol */
    const scrub = svgEl('g', { class: 'pap-mn-scrub', opacity: '0' });
    const vline = svgEl('line', { x1: 0, x2: 0, y1: CH.pt, y2: base, class: 'pap-mn-scrub-line' });
    const sdot = svgEl('circle', { r: 4.6, cx: 0, cy: 0, class: 'pap-mn-scrub-dot' });
    scrub.appendChild(vline);
    scrub.appendChild(sdot);
    svg.appendChild(scrub);

    /* Abscisses : première et dernière date */
    [0, moi.length - 1].forEach((i) => {
      const g = model.hist[i];
      if (!g) return;
      const q = moi[i];
      const t = svgEl('text', {
        x: clamp(q.x, CH.pl, W - CH.pr),
        y: CH.h - 6,
        class: 'pap-mn-axis pap-mn-axis-x',
      });
      if (i === 0) t.setAttribute('text-anchor', 'start');
      if (i === moi.length - 1) t.setAttribute('text-anchor', 'end');
      t.textContent = g.grade.dateLabel || '';
      svg.appendChild(t);
    });

    host.appendChild(svg);

    /* Infobulle HTML (plus lisible que du texte SVG) */
    const tip = document.createElement('div');
    tip.className = 'pap-mn-tip';
    tip.hidden = true;
    host.appendChild(tip);

    if (moi.length < 2) return;

    /* ---------- Scrub : on suit le pointeur sur l'abscisse ---------- */
    const ratio = () => W / (svg.getBoundingClientRect().width || W);

    function show(i) {
      const q = moi[i];
      if (!q || q.y === null) return;
      const g = model.hist[i];
      vline.setAttribute('x1', q.x);
      vline.setAttribute('x2', q.x);
      sdot.setAttribute('cx', q.x);
      sdot.setAttribute('cy', q.y);
      scrub.setAttribute('opacity', '1');
      tip.hidden = false;
      tip.innerHTML =
        `<b>${fmt(g.value)}<i>/20</i></b>` +
        `<span>${g.grade.subject}${g.grade.devoir ? ' · ' + escapeHtml(g.grade.devoir) : ''}</span>` +
        `<span class="pap-mn-tip-date">${g.grade.dateLabel || ''}</span>`;
      const px = q.x / ratio();
      tip.style.left = `${clamp(px, 46, (host.clientWidth || W) - 46)}px`;
    }

    function nearest(e) {
      const r = ratio();
      const x = (e.clientX - svg.getBoundingClientRect().left) * r;
      let best = 0;
      let dist = Infinity;
      moi.forEach((q, i) => {
        const d = Math.abs(q.x - x);
        if (d < dist) { dist = d; best = i; }
      });
      return best;
    }

    svg.addEventListener('pointermove', (e) => show(nearest(e)));
    svg.addEventListener('pointerdown', (e) => show(nearest(e)));
    svg.addEventListener('pointerleave', () => {
      scrub.setAttribute('opacity', '0');
      tip.hidden = true;
    });
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  /* ---------- Carte « Moyennes » + bandeau des matières ---------- */
  function buildOverview(objet, model) {
    objet.querySelectorAll('.pap-mn-overview, .pap-mn-subjects').forEach((el) => el.remove());
    if (!model.rows.length) return null;

    const card = document.createElement('div');
    card.className = 'pap-mn-overview';
    card.dataset.papMnOverview = '1';

    /* ---- en-tête : libellé + gros score ---- */
    const head = document.createElement('div');
    head.className = 'pap-mn-ov-head';

    const titles = document.createElement('div');
    titles.className = 'pap-mn-ov-titles';
    const label = document.createElement('span');
    label.className = 'pap-mn-ov-label';
    label.textContent = 'Moyenne générale';
    const sub = document.createElement('span');
    sub.className = 'pap-mn-ov-sub';
    sub.textContent = subLabel(model);
    titles.appendChild(label);
    titles.appendChild(sub);

    const score = document.createElement('div');
    score.className = 'pap-mn-ov-score';
    score.innerHTML = `<b>${model.final !== null ? fmt(model.final) : '—'}</b><i>/20</i>`;

    head.appendChild(titles);
    head.appendChild(score);
    card.appendChild(head);

    /* ---- sélecteur d'algorithme (moyenne générale / matière / médiane) ---- */
    const algos = document.createElement('div');
    algos.className = 'pap-mn-algos';
    algos.setAttribute('role', 'group');
    algos.setAttribute('aria-label', 'Algorithme de moyenne');
    ALGOS.forEach((a) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pap-mn-algo' + (a.id === state.algo ? ' is-on' : '');
      b.dataset.papMnAlgo = a.id;
      b.textContent = a.label;
      b.setAttribute('aria-pressed', a.id === state.algo ? 'true' : 'false');
      b.addEventListener('click', () => {
        if (state.algo === a.id) return;
        state.algo = a.id;
        state.sig = '';
        saveAlgo(a.id);
        processAll();
      });
      algos.appendChild(b);
    });
    card.appendChild(algos);

    /* ---- graphique ---- */
    const graph = document.createElement('div');
    graph.className = 'pap-mn-graph';
    card.appendChild(graph);
    renderChart(graph, model);

    /* le SVG est construit à la largeur réelle : on refait le rendu au
       redimensionnement (fenêtre agrandie, colonne qui change de largeur),
       sans rejouer l'animation de tracé. */
    if (state.ro) state.ro.disconnect();
    state.ro = new ResizeObserver(() => {
      const live = card.querySelector('.pap-mn-graph');
      if (live && live.isConnected) renderChart(live, model, false);
    });
    state.ro.observe(graph);

    /* ---- légende : seulement si la courbe pointillée est réellement
       tracée (au moins deux points de moyenne de classe connus) ---- */
    if (model.cls.filter((p) => p.value !== null).length >= 2) {
      const legend = document.createElement('div');
      legend.className = 'pap-mn-legend';
      legend.innerHTML =
        '<span class="pap-mn-legend-item"><i class="is-me"></i>Ma moyenne</span>' +
        '<span class="pap-mn-legend-item"><i class="is-cls"></i>Moyenne de la classe</span>';
      card.appendChild(legend);
    }

    /* ---- bandeau horizontal des moyennes par matière ---- */
    let strip = null;
    if (model.groupes.length > 1) {
      strip = document.createElement('div');
      strip.className = 'pap-mn-subjects';
      model.groupes.forEach((gr) => {
        const el = document.createElement('div');
        el.className = 'pap-mn-subj';
        el.style.setProperty('--pap-mn-c', gr.color);
        el.innerHTML =
          `<span class="pap-mn-subj-emoji">${subjectEmoji(gr.subject)}</span>` +
          `<span class="pap-mn-subj-name">${escapeHtml(gr.subject)}</span>` +
          `<span class="pap-mn-subj-score"><b>${fmt(gr.moyenne)}</b><i>/20</i></span>` +
          `<span class="pap-mn-subj-count">${gr.count} note${gr.count > 1 ? 's' : ''}</span>`;
        strip.appendChild(el);
      });
    }

    const zone = objet.querySelector('.liste_zone');
    if (zone) {
      objet.insertBefore(card, zone);
      if (strip) objet.insertBefore(strip, zone);
    } else {
      objet.appendChild(card);
      if (strip) objet.appendChild(strip);
    }
    return card;
  }

  function subLabel(model) {
    const n = model.rows.length;
    const notes = `sur ${n} note${n > 1 ? 's' : ''}`;
    const first = model.hist[0] ? model.hist[0].grade.dateLabel : '';
    const last = model.hist[model.hist.length - 1];
    const lastLabel = last ? last.grade.dateLabel : '';
    if (first && lastLabel && first !== lastLabel) return `${notes} · du ${first} au ${lastLabel}`;
    if (lastLabel) return `${notes} · au ${lastLabel}`;
    return model.periode || notes;
  }

  /* ---------- Lignes de notes façon Grade.tsx ---------- */
  function enhanceRow(g) {
    const row = g.el;
    if (row.dataset.papMn) return;
    row.dataset.papMn = '1';
    row.classList.add('pap-mn-row');
    row.style.setProperty('--pap-mn-c', g.color);

    /* pastille matière dans la colonne de gauche */
    const left = row.querySelector('.zone-gauche');
    if (left && !left.querySelector('.pap-mn-emoji')) {
      const em = document.createElement('span');
      em.className = 'pap-mn-emoji';
      em.textContent = subjectEmoji(g.subject);
      em.title = g.subject;
      left.prepend(em);
    }

    /* écart à la moyenne de la classe */
    if (g.clsKind === 'classe' && g.cls20 !== null && g.score20 !== null) {
      const delta = g.score20 - g.cls20;
      const sup = row.querySelector('.infos-supp');
      if (sup && Math.abs(delta) >= 0.25 && !sup.querySelector('.pap-mn-delta')) {
        const badge = document.createElement('span');
        const up = delta > 0;
        badge.className = `pap-mn-delta ${up ? 'is-up' : 'is-down'}`;
        badge.textContent = `${up ? '+' : '−'}${fmt(Math.abs(delta))}`;
        badge.title = up
          ? `Au-dessus de la moyenne de la classe (${fmt(g.cls20)}/20)`
          : `Sous la moyenne de la classe (${fmt(g.cls20)}/20)`;
        sup.appendChild(badge);
      }
    }

    /* note ramenée sur 20 quand le barème natif est un autre (7/10 → 14/20) */
    if (g.out && g.out !== 20 && g.score20 !== null) {
      const comp = row.querySelector('.zone-complementaire');
      if (comp && !comp.querySelector('.pap-mn-on20')) {
        const on = document.createElement('span');
        on.className = 'pap-mn-on20';
        on.textContent = `sur 20 : ${fmt(g.score20)}`;
        on.title = `Note ramenée sur 20 (barème ${fmt(g.out, 0)})`;
        comp.appendChild(on);
      }
    }
  }

  /* ---------- Panneau de détail ----------
     DOM natif : <header class="infos-note"><div class="m-top-l">
     <h2 class="ie-titre">MATHS</h2><p class="ie-texte">Note du …</p>
     <p class="ie-texte">Thème(s): …</p></div></header>
     <article class="details"><dl class="details-notes">
     <div><dt>Note élève : </dt><dd>7,00 /10</dd></div> … </dl></article>
     On garde tout le DOM natif (aucun comportement à casser) et on lui
     ajoute un bloc « note élève » façon Papillon + un graphe de position. */
  const DT = {
    eleve: /note\s+élève/i,
    classe: /moyenne\b[^:;]{0,24}?\bclasse\b/i,
    plusHaut: /plus\s+haute/i,
    plusBas: /plus\s+basse/i,
    coef: /coefficient/i,
  };

  function readDl(dl) {
    const out = [];
    dl.querySelectorAll('dt').forEach((dt) => {
      const dd = dt.parentElement.querySelector('dd');
      if (!dd) return;
      const label = (dt.textContent || '').replace(/[:\s]+$/, '').trim();
      const raw = (dd.textContent || '').replace(/\s+/g, ' ').trim();
      const p = parsePair(raw);
      out.push({ label, raw, value: p.value, out: p.out });
    });
    return out;
  }

  function pick(list, re) {
    for (const item of list) if (re.test(item.label)) return item;
    return null;
  }

  /* ---------- Moyenne de classe : recherche large ----------
     PRONOTE n'inscrit la moyenne de classe dans le <dl> de détail que
     pour certains devoirs (les autres n'ont que note / plus haute /
     plus basse / coefficient) : le repère jaune de la barre disparaît
     alors. On la cherche donc successivement :
       1. dans la ligne de liste correspondant au devoir sélectionné ;
       2. dans n'importe quel texte ou attribut de cette ligne ou du
          panneau de détail (PRONOTE varie lesClasses) ;
       3. à défaut, dans la moyenne des moyennes de classe de la période,
          signalée comme une estimation (repère en pointillés, sans écart
          chiffré pour ne pas faire croire à une donnée de PRONOTE).
     Format renvoyé aligné sur readDl ({ value, out }) pour réutiliser
     onEchelle, plus un `estime` pour le cas 3. */
  const CLS_RE = /moyenne\b[^:;]{0,24}?\bclasse\b\s*[:\-]?\s*(-?[\d\s]*[\d](?:[.,][\d]+)?)\s*(?:\/\s*([\d\s]*[\d](?:[.,][\d]+)?))?/i;

  function parseClasse(text) {
    const s = String(text || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    const m = CLS_RE.exec(s);
    if (!m) return null;
    const value = parseFr(m[1]);
    if (value === null) return null;
    return { label: 'Moyenne de la classe', raw: s, value, out: m[2] ? parseFr(m[2]) : null };
  }

  /* texte visible + attributs porteurs d'information (title, aria-label…) */
  function textes(el) {
    if (!el) return [];
    const out = [el.textContent || ''];
    const all = [el].concat(Array.prototype.slice.call(el.querySelectorAll('*')));
    all.forEach((n) => {
      ['title', 'aria-label', 'data-value', 'data-note', 'alt'].forEach((a) => {
        const v = n.getAttribute && n.getAttribute(a);
        if (v) out.push(v);
      });
    });
    return out;
  }

  function premiereClasse(list) {
    for (let i = 0; i < list.length; i++) {
      const f = parseClasse(list[i]);
      if (f) return f;
    }
    return null;
  }

  /* Ligne de liste du devoir affiché : PRONOTE la marque le plus souvent,
     sinon on la retrouve par matière. */
  function ligneSelectionnee(detail) {
    const list = document.querySelector('.ListeDernieresNotes');
    if (!list) return null;
    const marquee = list.querySelector('.liste_celluleGrid[aria-selected="true"]')
      || list.querySelector('.liste_celluleGrid.selected')
      || list.querySelector('.liste_celluleGrid.est-selectionne');
    if (marquee) return marquee;
    const h2 = detail.querySelector('.ie-titre');
    const mat = h2 ? (h2.textContent || '').trim() : '';
    if (!mat) return null;
    const rows = Array.prototype.slice.call(list.querySelectorAll('.liste_celluleGrid'));
    for (let i = 0; i < rows.length; i++) {
      const l = rows[i].querySelectorAll('.zone-principale .titre-principale .ie_ellipsis');
      if (l[0] && (l[0].textContent || '').trim() === mat) return rows[i];
    }
    return null;
  }

  function classeDeLaListe(detail) {
    return premiereClasse(textes(ligneSelectionnee(detail)))
      || premiereClasse(textes(detail));
  }

  /* Dernier recours : la moyenne des moyennes de classe connues sur la
     période — c'est la même référence que la ligne en pointillés du
     graphique, lissée sur toutes les notes plutôt que portée par la
     dernière valeur. */
  function classeDeLaPeriode() {
    const list = document.querySelector('.ListeDernieresNotes');
    if (!list) return null;
    const vs = readRows(list)
      .filter((g) => g.clsKind === 'classe' && g.cls20 !== null)
      .map((g) => g.cls20);
    if (!vs.length) return null;
    const moy = vs.reduce((s, v) => s + v, 0) / vs.length;
    return {
      label: 'Moyenne de la classe',
      raw: `moyenne de classe de la période (${vs.length} notes)`,
      value: moy,
      out: 20,
      estime: true,
    };
  }

  /* Couleur du devoir sélectionné : celle que PRONOTE a donnée à la
     ligne de la liste, sinon le hash du nom de matière. */
  function detailColor(detail, matiere) {
    const sel = document.querySelector(
      '.ListeDernieresNotes .liste_celluleGrid[aria-selected="true"]'
    );
    const c = sel && sel.style.getPropertyValue('--pap-mn-c');
    return c || hashColor(matiere);
  }

  function buildHero(detail, dl) {
    const data = readDl(dl);
    const eleve = pick(data, DT.eleve);
    if (!eleve || eleve.value === null) return;

    const titre0 = detail.querySelector('.ie-titre');
    const color0 = detailColor(detail, titre0 ? titre0.textContent.trim() : '');

    const classe = pick(data, DT.classe);
    const haut = pick(data, DT.plusHaut);
    const bas = pick(data, DT.plusBas);
    const coef = pick(data, DT.coef);
    /* Repli hors <dl> : ligne de liste, puis moyenne de la période */
    const moy = (classe && classe.value !== null) ? classe
      : (classeDeLaListe(detail) || classeDeLaPeriode());

    /* PRONOTE réécrit le <dd> en place quand on change de devoir sans
       remplacer les nœuds. La clé doit donc englober TOUS les <dd> lus :
       deux devoirs peuvent afficher la même note (deux 12,30 dans la même
       matière) tout en ayant des moyennes de classe et des extrêmes
       différents — sinon le héros garderait ceux du devoir précédent. */
    const key = [
      eleve.raw,
      moy ? moy.raw : '',
      haut ? haut.raw : '',
      bas ? bas.raw : '',
      coef ? coef.raw : '',
      color0,
    ].join('|');

    let hero = detail.querySelector('.pap-mn-det-hero');
    if (hero && hero.dataset.papMnHero === key) return;
    if (hero) hero.remove();

    /* Une seule échelle pour toute la barre : celle de l'élève. PRONOTE
       omet le dénominateur quand c'est /20, et il arrive qu'une note soit
       sur 10 pendant que la moyenne de classe est sur 20 — sans conversion,
       le remplissage et le marqueur ne seraient pas comparables.
       onEchelle() convertit donc chaque valeur sur l'échelle de l'élève. */
    const barème = eleve.out || 20;
    const onEchelle = (item) => {
      if (!item || item.value === null) return null;
      return (item.value / (item.out || 20)) * barème;
    };
    const pct = (v) => Math.max(0, Math.min(100, (v / barème) * 100));

    const vEleve = onEchelle(eleve);
    const vClasse = onEchelle(moy);
    const vHaut = onEchelle(haut);
    const vBas = onEchelle(bas);

    const titre = titre0;
    const color = color0;

    const pEleve = pct(vEleve);
    const pClasse = vClasse !== null ? pct(vClasse) : null;
    const pHaut = vHaut !== null ? pct(vHaut) : null;
    const pBas = vBas !== null ? pct(vBas) : null;
    /* L'écart chiffré n'a de sens que sur une moyenne de classe réellement
       fournie par PRONOTE : sur une estimation de période, on s'abstient. */
    const estime = !!(moy && moy.estime);
    const delta = (vClasse !== null && !estime) ? vEleve - vClasse : null;
    const up = delta !== null && delta >= 0;
    const tipClasse = pClasse === null ? ''
      : estime
        ? `Moyenne de classe de la période : ${fmt(vClasse)}/20 (estimation, cette note n'a pas de moyenne de classe)`
        : `Moyenne de la classe : ${fmt(vClasse)}/20`;

    hero = document.createElement('div');
    hero.className = 'pap-mn-det-hero';
    hero.dataset.papMnHero = key;
    hero.style.setProperty('--pap-mn-c', color);

    /* barre de position : étendue min..max de la classe, marqueur moyenne,
       remplissage jusqu'à la note de l'élève */
    const bar = (pClasse !== null || pHaut !== null)
      ? `<div class="pap-mn-det-bar">
           ${pHaut !== null && pBas !== null
             ? `<span class="pap-mn-det-range" style="left:${pBas.toFixed(1)}%;width:${(pHaut - pBas).toFixed(1)}%"></span>`
             : ''}
           <span class="pap-mn-det-fill" style="width:${pEleve.toFixed(1)}%"></span>
           ${pClasse !== null
             ? `<span class="pap-mn-det-avg${estime ? ' is-estime' : ''}" style="left:${pClasse.toFixed(1)}%" title="${escapeHtml(tipClasse)}"></span>`
             : ''}
         </div>`
      : '';

    hero.innerHTML =
      `<div class="pap-mn-det-hero-top">
         <span class="pap-mn-det-label">Note élève</span>
         ${delta !== null
           ? `<span class="pap-mn-det-delta ${up ? 'is-up' : 'is-down'}">${up ? '+' : '−'}${fmt(Math.abs(delta))}</span>`
           : ''}
         ${coef && coef.value !== null
           ? `<span class="pap-mn-det-coef" title="Coefficient de la note">×${fmt(coef.value, 0)}</span>`
           : ''}
       </div>
       <div class="pap-mn-det-score"><b>${escapeHtml(eleve.raw)}</b></div>
       ${bar}
        <div class="pap-mn-det-scale">
          <span>0</span>
          <span>${pClasse !== null ? (estime ? 'Moy. classe (période)' : `Classe ${fmt(vClasse)}`) : ''}</span>
          <span>${fmt(barème, 0)}</span>
        </div>`;


    /* La ligne « Note élève » du <dl> est reprise par le bloc ci-dessus. */
    const first = dl.querySelector('div');
    if (first && DT.eleve.test(first.querySelector('dt') ? first.querySelector('dt').textContent : '')) {
      first.classList.add('pap-mn-dl-hidden');
    }

    dl.parentElement.insertBefore(hero, dl);
  }

  function enhanceDetail(detail) {
    detail.classList.add('pap-mn-detail');
    const zone = detail.querySelector('.liste_zone, .detail-contain');
    if (zone) zone.classList.add('pap-mn-detail-zone');

    /* Avatar matière devant l'intitulé de l'en-tête */
    const h2 = detail.querySelector('.infos-note .ie-titre, .ie-titre');
    if (h2) {
      h2.classList.add('pap-mn-det-title');
      const matiere = (h2.textContent || '').trim();
      const wrap = h2.parentElement;
      if (wrap && !wrap.querySelector('.pap-mn-det-avatar')) {
        const av = document.createElement('span');
        av.className = 'pap-mn-det-avatar';
        av.style.setProperty('--pap-mn-c', detailColor(detail, matiere));
        av.textContent = subjectEmoji(matiere);
        wrap.insertBefore(av, h2);
      }
      h2.style.setProperty('--pap-mn-c', detailColor(detail, matiere));
      detail.classList.add('pap-mn-det-has-title');
    }

    const dl = detail.querySelector('.details-notes');
    if (dl) buildHero(detail, dl);

    /* État vide natif (« Sélectionnez un devoir ») → EmptyItem Papillon */
    const vide = Array.prototype.find.call(detail.querySelectorAll('div'), (d) => {
      return !d.firstElementChild && /^Sélectionnez/i.test((d.textContent || '').trim());
    });
    if (vide) {
      vide.classList.add('pap-mn-empty');
      if (vide.dataset.papMnEmpty) return;
      vide.dataset.papMnEmpty = '1';
      const g = icon('ghost');
      if (g) {
        const ico = svgWrap(g, 'ghost');
        ico.classList.add('pap-mn-empty-icon');
        vide.insertBefore(ico, vide.firstChild);
      }
    }
  }

  /* ---------- Intertitres de matière (mode « Par matière ») ----------
     Ces lignes ne sont pas des notes : on les marque pour les styler en
     en-tête de section (petit titre + moyenne de la matière). */
  function enhanceMatiere(list) {
    list.querySelectorAll('.liste_celluleGrid').forEach((row) => {
      if (row.dataset.papMnMat) return;
      const titre = row.querySelector('.zone-principale .titre-principale');
      if (!titre || titre.querySelector('.ie_ellipsis')) return;
      const gros = titre.querySelector('.ie-titre-gros');
      if (!gros) return;
      row.dataset.papMnMat = '1';
      row.classList.add('pap-mn-matiere');
      const mat = (gros.textContent || '').trim();
      row.style.setProperty('--pap-mn-c', readColor(row) || hashColor(mat));
    });
  }

  /* ---------- Pied de liste (« Moyenne générale élève / classe ») ----------
     PRONOTE rend ce bandeau comme un objet FRÈRE de la liste (son
     aria-labelledby pointe sur `…collection._1.Instances[2]…`, la liste
     étant `Instances[1]`) : laissé en place, il tombe sous la grille des
     deux colonnes et aucun sélecteur `.pap-mn-list .liste-totale-fd` ne le
     stylait. On le rentre dans la carte pour qu'il forme son bandeau de
     bas. Purement cosmétique : aucun listener ni état n'est touché. */
  function placeFooter(root, list) {
    const objet = list.querySelector('.ObjetListe');
    if (!objet) return;
    const pied = root.querySelector('.liste-totale-fd');
    if (!pied) return;
    if (pied.parentElement === objet && objet.lastElementChild === pied) return;
    pied.classList.add('pap-mn-footer');
    objet.appendChild(pied);
  }

  /* ---------- Traitement de la page ---------- */
  function processAll() {
    const root = document.querySelector('.InterfaceDernieresNotes');
    if (!root) return;

    /* Le fil d'Ariane confirme la page : sans lui, on ne touche à rien
       (le même libellé existe dans d'autres contextes PRONOTE). */
    const bc = document.querySelector('h1#breadcrumbBandeau');
    if (bc) {
      const name = bc.getAttribute('aria-label') || '';
      if (name && !/d[ée]tail de mes notes/i.test(name)) return;
    }

    root.classList.add('pap-mn');

    const list = root.querySelector('section.ListeDernieresNotes');
    if (list) {
      list.classList.add('pap-mn-list');
      const objet = list.querySelector('.ObjetListe');

      /* lignes */
      enhanceMatiere(list);
      readRows(list).forEach(enhanceRow);
      placeFooter(root, list);

      /* carte Moyennes : reconstruite seulement si les données ont changé
         (sinon un simple survol ou un clic sur les algorithmes la casserait) */
      const model = buildModel(list);
      if (!(state.card && state.card.isConnected && state.sig === model.sig)) {
        state.sig = model.sig;
        state.card = objet ? buildOverview(objet, model) : null;
      }
    }

    const detail = root.querySelector('section.Zone-DetailsNotes');
    if (detail) enhanceDetail(detail);
  }

  /* ---------- Persistance du choix d'algorithme ---------- */
  const ALGO_KEY = 'papillonMesNotesAlgo';

  function loadAlgo() {
    try {
      chrome.storage.local.get(ALGO_KEY, (data) => {
        const id = data && data[ALGO_KEY];
        if (ALGOS.some((a) => a.id === id)) {
          state.algo = id;
          state.sig = '';
          processAll();
        }
      });
    } catch (e) {
      /* ignore */
    }
  }

  function saveAlgo(id) {
    try {
      chrome.storage.local.set({ [ALGO_KEY]: id });
    } catch (e) {
      /* ignore */
    }
  }

  /* ---------- État ---------- */
  const state = { algo: 'general', sig: '', card: null, ro: null };

  /* ---------- Amorçage ---------- */
  function init() {
    Promise.all(Object.keys(ICON_FILES).map((k) => loadIcon(k))).then(() => {
      processAll();
      loadAlgo();

      /* Re-rendus PRONOTE (navigation, changement de période, nouvelle note) */
      const raf = { id: 0 };
      new MutationObserver(() => {
        if (raf.id) return;
        raf.id = requestAnimationFrame(() => {
          raf.id = 0;
          processAll();
        });
      }).observe(document.body, { childList: true, subtree: true });

      /* Bascule Clair ↔ Sombre : on force un re-rendu de la carte */
      new MutationObserver(() => {
        state.sig = '';
        processAll();
      }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
