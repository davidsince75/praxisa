# Accessibilité — Audit RGAA 4.1 / WCAG 2.2 (2026-06-10)

Référentiel appliqué : `accessibilite_web.pdf` (critères essentiels WCAG 2.2 / RGAA 4.1,
niveau AA). Ce document liste ce qui a été corrigé, les valeurs retenues, et ce qui
reste à vérifier manuellement.

---

## 1 · Couleurs & contrastes (AA : texte 4,5:1 · grand texte / UI 3:1)

Tous les jetons de couleur ont été mesurés (luminance relative WCAG) et corrigés.
**Ne pas éclaircir ces valeurs sans recalculer les ratios.**

| Jeton                | Avant                | Ratio avant (blanc) | Après          | Ratio après (blanc / crème) |
| -------------------- | -------------------- | ------------------- | -------------- | --------------------------- |
| `teal` (primaire)    | `#5E85B2`            | 3,84 ✗              | `#4A6F96`      | 5,24 / 4,54 ✓               |
| `teal.dark` (hover)  | `#4A6F96`            | 5,24                | `#3E608A`      | 6,47 ✓                      |
| `teal.light`         | —                    | —                   | `#8FB0D4`      | 7,4 sur fond sombre ✓       |
| `rose`               | `#C07060`            | 3,67 ✗              | `#A04E3C`      | 5,75 ✓                      |
| `rose.light`         | —                    | —                   | `#C07060`      | 4,75 sur `#1A1A18` ✓        |
| `olive`              | `#8A9665`            | 3,17 ✗              | `#656E49`      | 5,41 / 4,68 ✓               |
| `meta` (texte gris)  | `#7A7772`            | 4,46 ✗              | `#6B6862`      | 5,55 / 4,80 ✓               |
| `--input` (bordures) | 1,43 ✗               |                     | hsl 35 12% 54% | 3,29 ✓ (UI ≥ 3:1)           |
| `--destructive`      | 3,52 ✗ (texte blanc) |                     | hsl 12 46% 42% | 5,89 ✓                      |
| `--muted-foreground` | 4,54 (limite)        |                     | hsl 27 6% 40%  | 5,73 / 4,95 ✓               |

Règles d'usage : `teal.light` et `rose.light` uniquement sur fonds sombres
(`#1A1A18` — login, sidebars). `sand` et `steel` sont décoratifs (tints) — jamais
comme couleur de texte.

Couleur jamais seule : la pastille rouge de notifications affiche désormais le
**nombre** de non-lues + texte sr-only ; les badges portent toujours un libellé.

## 2 · Typographie

- Corps de texte : **1 rem (16 px)**, `line-height: 1.6` (avant : 15 px fixes, font-light 300).
- Graisse : `font-normal` (400) par défaut ; **toutes** les occurrences de
  `font-bold` (700) remplacées par `font-semibold` (600) — 208 occurrences.
- Échelle Tailwind redéfinie en rem avec interligne ≥ 1,5 (`xs`/`sm`/`base`/`lg`).
- Plancher 12 px : 83 occurrences de `text-[10px]`/`text-[11px]` remontées à `text-xs`.
- 52 occurrences de texte estompé par opacité (`text-meta/60` etc.) remises à pleine opacité.
- Police : `"Segoe UI", system-ui, "Helvetica Neue", Helvetica, Arial, sans-serif`.

## 3 · Mise en page & navigation

- **Liens d'évitement** « Aller au contenu principal » dans les trois shells
  (admin / formateur / apprenant) → `<main id="contenu" tabIndex={-1}>`.
- Landmarks : `<main>` présent partout ; `<nav aria-label>` distinct par portail.
- **Focus visible global** : `*:focus-visible { outline: 3px solid #4A6F96 }` +
  offset 2 px — ratio ≥ 3:1 sur toutes les surfaces (blanc 5,24 / crème 4,54 /
  sombre 3,32). Rendu en `outline` (compatible Windows High Contrast /
  `forced-colors`). Les `focus-visible:outline-none` de shadcn sont neutralisés.
- **Cibles tactiles 44 px** : boutons `default` et `icon` à `h-11` (44 px), inputs
  `h-11`. _Déviation documentée_ : la taille `sm` (36 px) subsiste dans les
  tableaux denses du back-office.
- `prefers-reduced-motion: reduce` : animations et transitions neutralisées.
- **Avertissement d'expiration de session** : bannière `role="alert"` quand le JWT
  expire dans < 10 min (`SessionExpiryBanner`, les trois shells).
- `<h1>` présent sur toutes les pages (45/45) — promu sur le lecteur de cours,
  sr-only sur l'éditeur de leçon.

## 4 · Formulaires

- `Label` (composant) : 14 px, semibold — associé via `htmlFor` (existant).
- Login : `autocomplete` email / current-password (existant) ; erreur en
  `role="alert"`, `text-sm`, `rose.light` (4,75:1 sur fond sombre) ; bordures
  d'inputs `white/40` ; placeholders `white/50`.
- Inputs sans label visible (barre d'outils éditeur) : `aria-label` ajoutés.
- Bouton fermer icône-seule (popover média, dialogues) : `aria-label="Fermer"` /
  sr-only « Fermer » (localisé).

## 5 · Images & médias

- Insertion d'image (éditeur de leçon) : **champ « Description (alt) »** ajouté —
  vide = décorative (`alt=""`), renseigné = alternative textuelle (échappée).
- Iframes vidéo : attribut `title` ajouté à l'insertion.
- Pas de contenu clignotant ; pas de CAPTCHA (N/A).

---

## Reste à faire (manuel ou contenu)

Ces points ne sont pas automatisables depuis le code et doivent être vérifiés
avant toute déclaration de conformité :

1. **Tests manuels obligatoires** (checklist du référentiel) : navigation 100 %
   clavier sur les trois portails ; lecteur d'écran NVDA ; zoom 200 % (vérifier
   la sidebar fixe `ml-56`) ; espacement de texte utilisateur ; simulateur de
   daltonisme.
2. **Outils** : passer axe DevTools / Lighthouse / WAVE sur les pages principales
   (les outils automatiques ne détectent que ~30 % des problèmes).
3. **Ordre des titres h2→h6** à l'intérieur des 45 pages (seule la présence d'un
   h1 est garantie).
4. **Contenu pédagogique** : sous-titres des vidéos YouTube (responsabilité de
   l'auteur du cours), transcriptions des leçons audio, qualité des textes alt
   saisis par les formateurs.
5. **Fil d'Ariane** : non implémenté (boutons retour présents) — amélioration future.
6. **Mode sombre** (`prefers-color-scheme`) : non implémenté — non requis au
   niveau AA ; les valeurs cibles du référentiel (fond ≥ `#121212`) sont notées
   pour une future itération.
7. **Déclaration d'accessibilité** : à rédiger/publier si le client est soumis à
   l'obligation légale (loi du 28 mai 2019, services publics / CA > 250 M€).
