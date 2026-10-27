# Cana'pet

Jeux de soirée multijoueurs **sur la télé** ; chaque **téléphone est une manette** (page web, rien à installer).
Site : https://kwakwa-ratatouille.github.io/Canapet/ (GitHub Pages, mis en ligne à chaque push par `.github/workflows/deploy.yml`).

## Décisions du propriétaire (oct. 2026)

- Nom **Cana'pet**. Style **cartoon bonbon** (pastel vif, formes rondes, contours prune `#3a2140`, police Fredoka).
- Personnages = **aliments et objets vivants** (coussin péteur = mascotte, tartine, cornichon…). Chaque joueur : perso + couleur (ses baskets) + chapeau + accessoire + **selfie possible comme visage**.
- Public : potes, humour piquant, avec un futur **mode famille** qui adoucit.
- Jusqu'à **12 joueurs** selon le jeu : bluff/obstacles/ambiance à 12, bagarre/combat à 8 (les autres regardent).
- Deux modes : **Tournoi** (5 jeux au hasard + podium) et **Hôte** (l'hôte 👑 choisit chaque jeu). L'hôte = premier joueur connecté.
- Compte Google **facultatif** (stats, accessoires débloqués) : pas encore fait, attend le projet Firebase.
- Son : musiques originales générées (Web Audio), bruitages rigolos (dont le « pet »), présentateur (voix de synthèse), sons/vibrations sur la manette.
- Écran : PC en HDMI d'abord (navigateur, puis .exe Electron), Chromecast ensuite.
- Téléphones : mélange iPhone/Android. Langues : **FR + EN** (chaque joueur choisit ; la télé suit l'hôte).
- Firebase : **nouveau projet** dédié (à créer par le propriétaire).

## Direction artistique « Le salon du dimanche » (oct. 2026)

- Source : dossier `canapet-da` du propriétaire, copié dans `public/da/` (logos, mascotte Pouet, persos, icônes de jeux `jeux/<slug>.svg`, maquettes) et `src/tokens.css` (couleurs, contours, ombres, typo = source de vérité). Brief : `public/da/BRIEF-CLAUDE-CODE.md`.
- Dessin : `src/shared/art/canapet-art.js` (+ `.d.ts`). Les persos passent par `characterSvg()` puis sont convertis UNE fois en image (cache dans `characters.ts`) ; selfie posé sur `faceSlot()`. Humeurs : happy, wow, sad, win (+ bras sur le podium).
- Canvas : couleurs via `src/shared/palette.ts`. Écrans HTML : variables `--cp-*` (alias `--ink`, `--pink`… dans `styles.css`). Télé : unité `--u` = 1 px d’un écran 1920, aucun texte sous 28 px, contours 6 px ; téléphone : contours 4 px. Ombres plates prune, jamais de flou ni de filter (Chromecast).
- Typo : Fredoka 600/700 (titres, boutons), Nunito (texte). Logo principal = monogramme C’p ; logotype à apostrophe-nuage (`<Wordmark/>`) en tête de la télé et de l’accueil ; favicon `icone-claire.svg`. Icône PC : `desktop/make-icon.js` (rendu par Electron avec Fredoka chargée).

## Catalogue (ordre de fabrication)

1. ✅ Course de pouces (`src/games/thumbRace.ts`) : test de latence.
2. ✅ La Dégringolade (`src/games/tumble.ts`) : course d’obstacles vue de côté, parcours tiré au hasard (tronçons), caméra qui suit le premier, A = saut, B = plongeon.
3. ✅ Le Bar des Bobards (`src/games/bluff.ts` + `src/pad/BluffPad.tsx`) : bluff 2-6 joueurs, main privée sur le téléphone (`padData` + `ctx.refresh()`), roulette du coussin péteur.
4. ✅ Sumo Tamponneur (`sumo.ts`, 12 joueurs, 3 vies, assiette qui rétrécit) et Pétards Mouillés (`bombs.ts`, 8 joueurs, grille, bonus, bots qui fuient le danger).
5. ✅ Mini Bolides (`kart.ts`, 8 karts, 5 tours, bordures qui renvoient sur la piste, tapis turbo, rattrapage pour les derniers, objets turbo/sirop/pétard, glissade unique puis protection).
6. ✅ Flèches à Ventouse (`archers.ts`, 8 joueurs, bords qui se rejoignent, premier à 3 manches, saut assez haut pour toutes les plateformes, manche de 45 s avec mort subite à 30 s).
7. ✅ Gribouillis (`scribble.ts` + `ScribblePad.tsx`) : dessin en direct du téléphone vers la télé, devinettes tapées, seuls les humains dessinent.
8. ✅ Le Traître du Frigo (`traitor.ts` + `TraitorPad.tsx`) : rôle caché 4-12, nuit/débat/vote, Goûteur dès 5.
9. ✅ Coussin Clash (`clash.ts`) : combat de plateforme sur un canapé, % de dégâts, 3 vies, 4 coups + super coup (bas + B jauge pleine).
10. ✅ Bagarre Molle (`brawl.ts`) : persos mous, baffe / attraper / jeter, sonné après 4 baffes.
11. ✅ Cuisine en Panique (`kitchen.ts`) : coop 1-8, caisses/planche/feux/assiettes/passe-plat, 3 recettes, bots commis.
12. ✅ Le Grand Plateau (`board.ts` + `BoardPad.tsx`) : dé sur le téléphone, bonbons, Coussins d’or, mini-jeux Tapotage et Réflexe.
13. ✅ Mode famille : interrupteur sur le téléphone de l’hôte (salon), mémorisé sur la télé (`session.family`, `ctx.family`), badge à la télé, « pet » → « pouic », PROUT → POUF, mots limites retirés de Gribouillis. Touche H en aperçu.
14. ✅ Undercover (`undercover.ts` + `UndercoverPad.tsx`, mots dans `undercoverWords.ts`) : indices tapés sur le téléphone et affichés à la télé, Mr White peut deviner, 10 thèmes (le piquant caché en mode famille). Touche U.
15. ✅ Photo Roulette (`roulette.ts` + `RoulettePad.tsx`) : photos (réduites à 960 px) et vidéos (20 s / 8 Mo) envoyées en morceaux de 48 Ko (`act up`, acceptés même pendant le tuto), 3 par joueur tirées au hasard, 12 manches, vote rapide = plus de points, le propriétaire marque s’il trompe la majorité. Rien n’est gardé. Touche J.
16. Ensuite : activer le Chromecast (identifiant Google Cast à fournir), refonte graphique des persos (direction à choisir avec le propriétaire).

Manette : boutons X (`c`) et Y (`d`) dans le message `in`, croix façon Switch dans `Stick.tsx` (libellés par jeu dans `LABELS`). La Dégringolade : 3 vies, 12 tronçons, glace/gants/pluie. Flèches : esquive X, coffre, bulle.
Tout est **inspiré**, jamais copié : noms, persos, sons et images originaux.

## Cartes et ajouts (oct. 2026)

- Chaque jeu d'action tire une carte au hasard (`mapName`, affiché à l'intro) : Pouces (Plage/Neige/Parc + boue 🐌 et turbo ⚡), Dégringolade (Pâtisserie/Jardin/Nuit Pyjama + ventilateurs + caramel qui s'enfonce), Sumo (Assiette/Patinoire/Pizza Flipper à champignons), Bolides (Bonbon/Huit/Ovale Express), Flèches (Tour/Étagères/Puits), Clash (Canapé/Étagère/Frigo), Bagarre (Nénuphars/Pont/Pile de Crêpes), Pétards (Classique/Arène ouverte/Croix + bonus bouclier 🛡️), Cuisine (Bistrot/Couloir), Plateau (Ovale/Grand Salon/Cœur).
- Bar des Bobards : carte Miroir 🪞 (si elle est retournée, l'accusateur perd). Gribouillis : 90 mots. Plateau : mini-jeu Pile ou Face. Traître : rôle Glouton dès 7 joueurs (gagne s'il est voté). Cuisine : bots commis (prendre, couper, cuire, poser sur un plan de travail ; les humains dressent et servent).
- Tester sans afficher le panneau : appeler `__session.frame(t)` en boucle avec un temps croissant (le panneau caché ralentit l'animation).

## Tutos, Coussin Clash v2, persos (oct. 2026)

- Tuto avant chaque jeu (`src/games/tutos.ts`, but + 3 étapes, 8,5 s ; intro courte si on rejoue le même jeu).
- Coussin Clash (`clash.ts`) : caméra qui suit/zoome, arrêt sur image + tremblement + traînées, objets qui tombent (tapette, coussin-bombe, cœur, étoile), 5 scènes (Canapé, Étagère, Frigo, Lustre et Baignoire à plateformes mobiles).
- 19 personnages : 6 ajoutés dans `canapet-art.js` (pizza, glace, avocat, macaron, banane, nuage) + SVG de référence dans `public/da/persos/`. Clignement des yeux = sprite « toot » quelques ms.
- La Dégringolade v2 : caméra qui dézoome, effets, qualification 70 %, Portes surprises. Bagarre Molle v2 : manches (premier à 2), pièges par carte (vent, gouttes de sirop, nénuphars/tabourets mobiles), crème qui monte après 40 s, effets (arrêt sur image, étoiles, PLOUF).
- Décor commun : `smileSun` + `stickerCloud` dans `draw.ts`.

## Architecture

- React + TypeScript + Vite, navigation par `#` (`#/tv`, `#/m/CODE`, `#/aide`).
- **La télé fait autorité** (`src/tv/session.ts`) : boucle à pas fixe 60 Hz, rendu Canvas 2D en repère 1920×1080. Les téléphones n'envoient que leurs entrées (`src/shared/protocol.ts`).
- Liaison : **PeerJS** (WebRTC DataChannel). La télé ouvre le pair `canapet-v1-<CODE>` ; les manettes s'y connectent. Ping toutes les 2 s, et un joueur muet depuis 9 s est compté comme parti.
  Prévu : Firebase Realtime Database pour l'appairage de secours et les comptes. Pas Firestore pour le temps réel.
- Un jeu = un `GameDef` dans `src/games/registry.ts` avec `create(runners, ctx)` qui rend un `GameInstance` (input/update/render/ranking). Intro, compte à rebours, points et résultats sont gérés par la session.
- Personnages dessinés par le code : `src/shared/characters.ts`. Sons : `src/shared/sound.ts`. Textes FR/EN : `src/shared/i18n.ts`.
- Mode léger automatique (`LIGHT`, Chromecast et petits Android) : canvas en 1280×720, moins d'effets.

## Mode équipes et musique

- **Chrono** : `limit` (+ `timerTop`) dans chaque `GameBase` ; la session (`limitTick`, `timeLeft`) annonce « Plus que 30 secondes ! » et accélère la musique (`setMusicRush`), tic-tac sur les 10 dernières, sirène + « Temps écoulé ! » (2,2 s) puis résultats avec le classement du moment. Pastille dessinée par `drawTimer` (TvApp). Pas de chrono pour Cuisine (le sien) ni Traître.

- **Équipes** (interrupteur de l’hôte, touche E) : Fraise 🍓 contre Menthe 🌿 (`src/games/teams.ts`), chacun choisit son camp sur sa manette, les bots équilibrent. Tous les jeux : chaque équipe marque la moyenne des places de ses joueurs (juste à 3 contre 2), l’équipe gagnante prend 10 pts chacun, l’autre 4 (égalité 7). Sumo, Pétards, Bagarre, Clash, Flèches : pas de coups entre coéquipiers (sauf Pétards), fin quand il reste un seul camp (`allies`, `sidesLeft`). Sans équipes = mêlée générale.
- **Musique** (`sound.ts`) : compositeur maison, grille couplet + pont par ambiance, mélodie réinventée à chaque tour (A A' B A, 32 mesures), basse, batterie, nappe, bus musique filtré et plus bas que les bruitages.

## Progression et boutique (oct. 2026)

- Gardée sur le téléphone (`src/shared/progress.ts`, clé `progress`) : XP, niveaux (`xpFor`), bonbons 🍬, objets achetés (`PRICES` : prix + niveau minimum ; le reste est gratuit). Gains comptés une fois par partie (`gid` dans les écrans results/podium, clé code télé + numéro). Niveau envoyé dans le profil (badge « Niv. » dans le salon télé). Boutique = éditeur de perso (cadenas, prix, fenêtre d’achat). 7 chapeaux et 4 accessoires ajoutés dans `canapet-art.js`.
- Compte Google : projet Firebase `canapet-31bb7` (config dans `src/shared/cloud.ts`, Firebase chargé à la demande via `cloudImpl.ts`). Bouton « Sauvegarder avec Google » sur la carte de progression du téléphone (popup, sinon redirection). Progression dans Realtime Database `players/<uid>/progress` (Belgique, europe-west1), fusion « le meilleur des deux » à la connexion. Règles : `database.rules.json`.
- Manette : colonne du milieu (perso, place en direct, chrono) via le message `status` envoyé chaque seconde. Tuto : 16 s, les joueurs appuient sur un bouton pour dire « prêt » (`ready`, saute au compte à rebours quand tout le monde l’est).

## Chromecast et appli PC

- **Chromecast** : récepteur `public/cast.html` (SDK CAF, iframe vers `index.html?cast=1#/tv`, bandeau de diagnostic). La page télé envoie son code au récepteur (postMessage), qui le renvoie aux téléphones sur le canal `urn:x-cast:com.canapet`. Bouton « Lancer sur le Chromecast » sur l’accueil (`src/shared/cast.ts`), caché tant que `CAST_APP_ID` est vide : le propriétaire doit enregistrer l’appli (Custom Receiver, URL `https://kwakwa-ratatouille.github.io/Canapet/cast.html`) dans la console Google Cast, la **publier**, et donner l’identifiant.
- **Appli PC** : `desktop/` (Electron). Charge `…/Canapet/#/tv` en plein écran sans cache ; page `offline.html` si pas d’internet ; F11 plein écran, F5 recharger. `npx electron . --smoke` (dans desktop/) charge la télé et affiche le code puis quitte. Le .exe est fabriqué par `.github/workflows/desktop.yml` (seulement quand desktop/** change) et publié sur la release `pc-latest` : https://github.com/kwakwa-ratatouille/Canapet/releases/download/pc-latest/Canapet-Setup.exe. Ne pas lancer l’installateur sur le PC du propriétaire pour tester.

## Tester

- `npm run dev` (port 5180, déclaré dans `.claude/launch.json`).
- `#/tv?apercu=1` : la télé avec 3 faux joueurs. Clavier : E = équipes, Entrée = Course de pouces, D = Dégringolade, B = Bar des Bobards, S = Sumo, P = Pétards, K = Kart, A = Archers, G = Gribouillis, V = Traître, C = Clash, W = Bagarre, O = Cuisine, Y = Plateau, T = tournoi, N = suivant, R = rejouer, L = salon, M = muet, F = plein écran.
- `#/m/TEST?s=lobby|tap|stick|results|podium` : la manette sans connexion.
- En aperçu, `window.__session` donne la session télé : `__session.game.input(pid, {t:'in', …})` pour piloter un joueur. Attention : un onglet manette au premier plan met la télé en pause (onglet en arrière-plan) ; mettre la manette dans une iframe de la page télé pour tester.

## Règles de travail

- Après chaque modification : commit, `git pull --rebase --autostash`, `git push`, **sans demander**.
- Ne jamais modifier de fichiers avec PowerShell. Utiliser Edit/Write ou un petit script node avec `s.replace(a, () => b)`.
- Processus longs : en arrière-plan via WMI (`Invoke-CimMethod Win32_Process Create`).
- Ne jamais dire « c'est en ligne » sans l'avoir vérifié (fichier en ligne, capture d'écran, log). GitHub Pages garde la page en cache 10 min.
- Règles Firebase dans le dépôt (`database.rules.json`) : dire au propriétaire de les coller dans la console quand elles changent.
- Répondre **en français, simplement**, sans jargon (le propriétaire n'est pas développeur). Pas de questions sur les choix évidents : choisir et le dire en une ligne.
- Chromecast : appli Cast **publiée** dans la console, bandeau de diagnostic dans `cast.html`, `skipPlayersLoad` + `disableIdleTimeout`.
- Connexion Google : ajouter `kwakwa-ratatouille.github.io` aux domaines autorisés Firebase. Dans les applis, page relais + jeton chiffré (voir Croivez). iOS Capacitor : `initializeAuth`.
