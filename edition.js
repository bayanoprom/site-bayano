// Mode édition de l'aperçu (uniquement avec ?edition dans l'adresse).
// Renard clique sur un texte pour le réécrire, ou sur n'importe quel élément pour laisser une remarque,
// puis copie la liste complète pour la coller à Sésame. Rien n'est envoyé sur internet.
(function () {
  var CLE = "bayano-edition-v1";
  var mode = "texte"; // "texte" ou "remarque"
  var donnees = { textes: {}, remarques: [] };
  try { donnees = JSON.parse(localStorage.getItem(CLE)) || donnees; } catch (e) {}
  function sauver() { try { localStorage.setItem(CLE, JSON.stringify(donnees)); } catch (e) {} majCompteur(); }

  // Pas d'intro ni de bouton WhatsApp flottant pendant l'édition ; les questions fréquentes sont ouvertes
  var intro = document.getElementById("intro"); if (intro) intro.remove();
  document.querySelectorAll(".faq details").forEach(function (d) { d.open = true; });

  // ---------- Styles de l'éditeur ----------
  var css = document.createElement("style");
  css.textContent = [
    ".ed-barre{position:fixed;left:16px;bottom:16px;z-index:1000;display:flex;flex-wrap:wrap;gap:6px;align-items:center;max-width:calc(100vw - 32px);padding:10px;border-radius:12px;background:#fff;color:#111;font:500 14px/1.2 system-ui,sans-serif;box-shadow:0 20px 50px rgba(0,0,0,.5)}",
    ".ed-barre b{padding:0 6px}",
    ".ed-barre button{font:inherit;padding:9px 12px;border-radius:8px;border:1px solid #ddd;background:#f4f4f6;color:#111;cursor:pointer}",
    ".ed-barre button.on{background:#ff2e4d;border-color:#ff2e4d;color:#fff}",
    ".ed-barre .ed-copier{background:#25d366;border-color:#25d366;color:#052b13}",
    ".ed-compte{color:#555;font-weight:400;padding:0 4px}",
    "body.ed-texte [data-ed-cible]:hover{outline:2px dashed #3aa0ff;outline-offset:3px;cursor:text}",
    "body.ed-remarque *:hover{outline:2px dashed #ffb020!important;outline-offset:2px;cursor:crosshair}",
    "body.ed-remarque .ed-barre *:hover,body.ed-remarque .ed-bulle *:hover{outline:none!important;cursor:auto}",
    "[contenteditable=true]{outline:2px solid #3aa0ff!important;outline-offset:3px;background:rgba(58,160,255,.12)}",
    ".ed-modifie{box-shadow:inset 0 -2px 0 #3aa0ff}",
    ".ed-epingle{position:absolute;z-index:999;width:24px;height:24px;border-radius:50%;background:#ffb020;color:#111;font:700 12px/24px system-ui;text-align:center;pointer-events:none;box-shadow:0 0 0 3px rgba(0,0,0,.4)}",
    ".ed-bulle{position:fixed;z-index:1001;width:min(340px,calc(100vw - 32px));padding:14px;border-radius:12px;background:#fff;color:#111;font:14px/1.4 system-ui,sans-serif;box-shadow:0 20px 50px rgba(0,0,0,.55)}",
    ".ed-bulle p{margin:0 0 8px;color:#555;font-size:12px}",
    ".ed-bulle textarea{width:100%;min-height:80px;padding:8px;border-radius:8px;border:1px solid #ccc;font:inherit;resize:vertical}",
    ".ed-bulle div{display:flex;justify-content:flex-end;gap:6px;margin-top:8px}",
    ".ed-bulle button{font:inherit;padding:8px 12px;border-radius:8px;border:1px solid #ddd;background:#f4f4f6;cursor:pointer}",
    ".ed-bulle button.ok{background:#ff2e4d;border-color:#ff2e4d;color:#fff}",
    ".ed-message{position:fixed;left:50%;top:20px;transform:translateX(-50%);z-index:1002;padding:12px 18px;border-radius:10px;background:#111;color:#fff;font:500 14px system-ui;box-shadow:0 10px 30px rgba(0,0,0,.5)}",
    ".wa-flottant{display:none!important}"
  ].join("\n");
  document.head.appendChild(css);

  // ---------- Repérer chaque texte modifiable ----------
  var SELECTEUR = "h1,h2,h3,p,li,summary,figcaption,small,.btn,.sous-menu b,.sous-menu span,.tags li,.prix,.es-btn,.es-commande,.etiquette-cas,.bulle,.ac-msg,.ac-haut,.intro-qui p,.ligne-fiche b,.bandeau-piste span,footer span";
  var cibles = Array.prototype.slice.call(document.querySelectorAll(SELECTEUR)).filter(function (el) {
    return !el.closest(".ed-barre") && el.textContent.trim() && !el.querySelector(SELECTEUR.replace(/,/g, ",")); // le plus petit élément qui contient le texte
  });
  cibles.forEach(function (el, i) {
    var id = "t" + i;
    el.setAttribute("data-ed-cible", id);
    el.dataset.edOrigine = el.innerText.trim();
    if (donnees.textes[id] && donnees.textes[id].origine === el.dataset.edOrigine) {
      el.innerText = donnees.textes[id].nouveau;
      el.classList.add("ed-modifie");
    }
  });

  // Nom lisible de l'endroit où se trouve un élément (pour que Sésame le retrouve)
  function endroit(el) {
    var parties = [];
    var fiche = el.closest(".fiche"); if (fiche) parties.push("carte « " + fiche.getAttribute("aria-label") + " »");
    var sm = el.closest(".sous-menu"); if (sm) parties.push("menu " + document.querySelector('[aria-controls="' + sm.id + '"]').textContent.trim());
    var sec = el.closest("section, header, footer, .bandeau");
    if (sec) {
      var titre = sec.querySelector("h1, h2");
      var nom = sec.matches("header") ? "En-tête" : sec.classList.contains("hero") ? "Accueil (haut de page)" : sec.classList.contains("bandeau") ? "Bandeau des métiers" : titre ? titre.innerText.trim().slice(0, 50) : (sec.id || "section");
      parties.unshift("section « " + nom + " »");
    }
    return parties.join(", ");
  }
  function decrire(el) {
    var t = (el.innerText || el.getAttribute("alt") || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ");
    var type = el.tagName === "IMG" ? "image" : el.tagName === "VIDEO" ? "vidéo" : el.classList.contains("btn") ? "bouton" : "élément";
    return type + (t ? " « " + t.slice(0, 60) + (t.length > 60 ? "…" : "") + " »" : "");
  }

  // ---------- Barre d'outils ----------
  var barre = document.createElement("div");
  barre.className = "ed-barre";
  barre.innerHTML = '<b>Mode édition</b>' +
    '<button type="button" data-mode="texte">✏️ Modifier un texte</button>' +
    '<button type="button" data-mode="remarque">💬 Laisser une remarque</button>' +
    '<span class="ed-compte"></span>' +
    '<button type="button" class="ed-copier">📋 Copier pour Sésame</button>' +
    '<button type="button" class="ed-vider">Tout effacer</button>';
  document.body.appendChild(barre);
  var compteur = barre.querySelector(".ed-compte");
  function majCompteur() {
    compteur.textContent = Object.keys(donnees.textes).length + " texte(s), " + donnees.remarques.length + " remarque(s)";
  }
  function choisirMode(m) {
    mode = m;
    document.body.classList.toggle("ed-texte", m === "texte");
    document.body.classList.toggle("ed-remarque", m === "remarque");
    barre.querySelectorAll("[data-mode]").forEach(function (b) { b.classList.toggle("on", b.dataset.mode === m); });
  }
  barre.querySelectorAll("[data-mode]").forEach(function (b) { b.addEventListener("click", function () { choisirMode(b.dataset.mode); }); });
  choisirMode("texte");
  majCompteur();

  function message(t) {
    var m = document.createElement("div"); m.className = "ed-message"; m.textContent = t;
    document.body.appendChild(m); setTimeout(function () { m.remove(); }, 2600);
  }

  // ---------- Clics : on n'ouvre plus les liens, on édite ----------
  var LAISSER = ".ed-barre, .ed-bulle, .fleche, .points, .rubrique, #burger, input, select, #comparaison-curseur";
  document.addEventListener("click", function (e) {
    if (e.target.closest(LAISSER)) return;
    e.preventDefault(); e.stopPropagation();
    if (mode === "texte") {
      var el = e.target.closest("[data-ed-cible]");
      if (!el) { message("Pas de texte ici : utilisez « Laisser une remarque »."); return; }
      editer(el);
    } else {
      ouvrirBulle(e.target, e.clientX, e.clientY);
    }
  }, true);

  function editer(el) {
    if (el.isContentEditable) return;
    el.contentEditable = "true";
    el.focus();
    var r = document.createRange(); r.selectNodeContents(el);
    var sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    function fin() {
      el.contentEditable = "false";
      el.removeEventListener("blur", fin);
      var id = el.getAttribute("data-ed-cible");
      var nouveau = el.innerText.trim();
      if (nouveau === el.dataset.edOrigine) { delete donnees.textes[id]; el.classList.remove("ed-modifie"); }
      else { donnees.textes[id] = { origine: el.dataset.edOrigine, nouveau: nouveau, endroit: endroit(el) }; el.classList.add("ed-modifie"); }
      sauver();
    }
    el.addEventListener("blur", fin);
    el.addEventListener("keydown", function k(ev) {
      if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); el.blur(); el.removeEventListener("keydown", k); }
      if (ev.key === "Escape") { el.innerText = (donnees.textes[el.getAttribute("data-ed-cible")] || {}).nouveau || el.dataset.edOrigine; el.blur(); el.removeEventListener("keydown", k); }
    });
  }

  // ---------- Remarques ----------
  function ouvrirBulle(el, x, y) {
    var ancienne = document.querySelector(".ed-bulle"); if (ancienne) ancienne.remove();
    var b = document.createElement("div"); b.className = "ed-bulle";
    b.innerHTML = '<p></p><textarea placeholder="Ex. : mets ce bouton en vert, change cette image, enlève cette partie…"></textarea><div><button type="button" class="annuler">Annuler</button><button type="button" class="ok">Ajouter</button></div>';
    b.querySelector("p").textContent = "Sur : " + decrire(el) + " (" + endroit(el) + ")";
    b.style.left = Math.min(x, innerWidth - 360) + "px";
    b.style.top = Math.min(y + 12, innerHeight - 220) + "px";
    document.body.appendChild(b);
    var zone = b.querySelector("textarea"); zone.focus();
    b.querySelector(".annuler").onclick = function () { b.remove(); };
    b.querySelector(".ok").onclick = function () {
      var t = zone.value.trim(); if (!t) { b.remove(); return; }
      var rect = el.getBoundingClientRect();
      donnees.remarques.push({ texte: t, cible: decrire(el), endroit: endroit(el), x: rect.left + scrollX, y: rect.top + scrollY });
      sauver(); b.remove(); poserEpingles();
    };
  }
  function poserEpingles() {
    document.querySelectorAll(".ed-epingle").forEach(function (p) { p.remove(); });
    donnees.remarques.forEach(function (r, i) {
      var p = document.createElement("div"); p.className = "ed-epingle"; p.textContent = i + 1;
      p.style.left = (r.x - 10) + "px"; p.style.top = (r.y - 10) + "px";
      document.body.appendChild(p);
    });
  }
  poserEpingles();

  // ---------- Copier pour Sésame ----------
  barre.querySelector(".ed-copier").addEventListener("click", function () {
    var lignes = ["Modifications de l'aperçu du site Bayano :", ""];
    var n = 1;
    Object.keys(donnees.textes).forEach(function (id) {
      var t = donnees.textes[id];
      lignes.push(n++ + ". [Texte] " + t.endroit + "\n   Avant : « " + t.origine + " »\n   Après : « " + t.nouveau + " »");
    });
    donnees.remarques.forEach(function (r) {
      lignes.push(n++ + ". [Remarque] " + r.endroit + ", sur " + r.cible + "\n   " + r.texte);
    });
    if (n === 1) { message("Aucune modification pour l'instant."); return; }
    var texte = lignes.join("\n");
    function secours() {
      var z = document.createElement("textarea"); z.value = texte; z.style.cssText = "position:fixed;inset:10% 10%;z-index:1003;width:80%;height:70%;padding:12px;font:13px monospace";
      document.body.appendChild(z); z.select(); message("Copiez ce texte (Ctrl + C), puis cliquez ailleurs.");
      z.addEventListener("blur", function () { z.remove(); });
    }
    if (navigator.clipboard) navigator.clipboard.writeText(texte).then(function () { message("Copié ! Collez-le dans la conversation avec Sésame (Ctrl + V)."); }, secours);
    else secours();
  });

  barre.querySelector(".ed-vider").addEventListener("click", function () {
    if (!confirm("Effacer toutes vos modifications et remarques ?")) return;
    donnees = { textes: {}, remarques: [] }; sauver();
    location.reload();
  });
})();
