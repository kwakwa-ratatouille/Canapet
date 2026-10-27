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

## Catalogue (ordre de fabrication)

1. ✅ Course de pouces (`src/games/thumbRace.ts`) : test de latence.
2. ✅ La Dégringolade (`src/games/tumble.ts`) : course d’obstacles vue de côté, parcours tiré au hasard (tronçons), caméra qui suit le premier, A = saut, B = plongeon.
3. ✅ Le Bar des Bobards (`src/games/bluff.ts` + `src/pad/BluffPad.tsx`) : bluff 2-6 joueurs, main privée sur le téléphone (`padData` + `ctx.refresh()`), roulette du coussin péteur.
4. ✅ Sumo Tamponneur (`sumo.ts`, 12 joueurs, 3 vies, assiette qui rétrécit) et Pétards Mouillés (`bombs.ts`, 8 joueurs, grille, bonus, bots qui fuient le danger).
5. ✅ Mini Bolides (`kart.ts`, 8 karts, 3 tours, objets turbo/sirop/pétard).
6. ✅ Flèches à Ventouse (`archers.ts`, 8 joueurs, bords qui se rejoignent, premier à 3 manches).
7. ✅ Gribouillis (`scribble.ts` + `ScribblePad.tsx`) : dessin en direct du téléphone vers la télé, devinettes tapées, seuls les humains dessinent.
8. ✅ Le Traître du Frigo (`traitor.ts` + `TraitorPad.tsx`) : rôle caché 4-12, nuit/débat/vote, Goûteur dès 5.
9. ✅ Coussin Clash (`clash.ts`) : combat de plateforme sur un canapé, % de dégâts, 3 vies, 4 coups + super coup (bas + B jauge pleine).
10. ✅ Bagarre Molle (`brawl.ts`) : persos mous, baffe / attraper / jeter, sonné après 4 baffes.
11. ✅ Cuisine en Panique (`kitchen.ts`) : coop 1-8, caisses/planche/feux/assiettes/passe-plat, 3 recettes. Pas d’IA de commis : les bots restent plantés (botFill 0).
12. ✅ Le Grand Plateau (`board.ts` + `BoardPad.tsx`) : dé sur le téléphone, bonbons, Coussins d’or, mini-jeux Tapotage et Réflexe.
13. Ensuite : mode famille, comptes Google (Firebase), Chromecast, appli PC .exe, Pétards Mouillés (Bomberman), Sumo Tamponneur, Mini Bolides (kart), Flèches à Ventouse (TowerFall), Bagarre Molle (Gang Beasts), Cuisine en Panique (Overcooked), Le Traître du Frigo (rôle caché), Gribouillis (dessin), Le Grand Plateau (Mario Party), Coussin Clash (Smash, le jeu phare).
Tout est **inspiré**, jamais copié : noms, persos, sons et images originaux.

## Architecture

- React + TypeScript + Vite, navigation par `#` (`#/tv`, `#/m/CODE`, `#/aide`).
- **La télé fait autorité** (`src/tv/session.ts`) : boucle à pas fixe 60 Hz, rendu Canvas 2D en repère 1920×1080. Les téléphones n'envoient que leurs entrées (`src/shared/protocol.ts`).
- Liaison : **PeerJS** (WebRTC DataChannel). La télé ouvre le pair `canapet-v1-<CODE>` ; les manettes s'y connectent. Ping toutes les 2 s, et un joueur muet depuis 9 s est compté comme parti.
  Prévu : Firebase Realtime Database pour l'appairage de secours et les comptes. Pas Firestore pour le temps réel.
- Un jeu = un `GameDef` dans `src/games/registry.ts` avec `create(runners, ctx)` qui rend un `GameInstance` (input/update/render/ranking). Intro, compte à rebours, points et résultats sont gérés par la session.
- Personnages dessinés par le code : `src/shared/characters.ts`. Sons : `src/shared/sound.ts`. Textes FR/EN : `src/shared/i18n.ts`.
- Mode léger automatique (`LIGHT`, Chromecast et petits Android) : canvas en 1280×720, moins d'effets.

## Tester

- `npm run dev` (port 5180, déclaré dans `.claude/launch.json`).
- `#/tv?apercu=1` : la télé avec 3 faux joueurs. Clavier : Entrée = Course de pouces, D = Dégringolade, B = Bar des Bobards, S = Sumo, P = Pétards, K = Kart, A = Archers, G = Gribouillis, V = Traître, C = Clash, W = Bagarre, O = Cuisine, Y = Plateau, T = tournoi, N = suivant, R = rejouer, L = salon, M = muet, F = plein écran.
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
