# Mise à jour de la direction artistique de Cana'pet

Ce dossier `canapet-da/` contient la nouvelle identité visuelle de Cana'pet, direction « Le salon du dimanche » : familiale, ronde, effet autocollant. Il remplace l'ancien style visuel de l'appli. Le gameplay, le réseau et la logique ne changent pas.

## Contenu du dossier

| Fichier | Rôle |
|---|---|
| `tokens.css` | Variables CSS : palette, 12 couleurs joueurs, contours, ombres, arrondis, typo. **Source de vérité des couleurs.** |
| `canapet-art.js` | Module ES sans dépendance qui génère tous les SVG. À utiliser pour les persos dynamiques (couleur des baskets, chapeau, accessoire, selfie, humeur). |
| `logo/` | `monogramme.svg` (logo principal C'p), `logotype.svg` (nom avec apostrophe-nuage), `logo-horizontal.svg`, `icone-claire.svg`, `icone-soiree.svg` |
| `mascotte/` | Pouet, le coussin péteur : face, trois quarts, surpris, triste, victoire, prout |
| `persos/` | Les 13 personnages, version statique de référence |
| `jeux/` | Les 13 icônes de jeux, nommées par slug |
| `maquettes/` | Maquettes de référence des écrans télé et téléphone. **À reproduire en vrai HTML/CSS, pas à afficher telles quelles.** |

## Ce que je veux

1. **Explore d'abord le projet** : où sont définis les couleurs, le logo, les personnages, les chapeaux et accessoires, les icônes de jeux, les écrans télé et manette. Fais-moi un plan court avant de modifier.
2. **Copie `canapet-da/` dans les assets du projet** (dossier adapté à la structure existante).
3. **Couleurs** : remplace les couleurs en dur par les variables de `tokens.css`. Les 12 couleurs joueurs gardent le même ordre qu'avant.
4. **Logo** : le logo principal est le monogramme C'p. Le logotype à apostrophe-nuage sert en tête des écrans télé et de l'écran d'accueil du téléphone. Mets à jour le favicon et l'icône d'appli (manifest PWA si présent) avec `icone-claire.svg`.
5. **Personnages** : remplace le rendu actuel par `characterSvg(kind, couleur, { hat, acc, mood, selfie })` de `canapet-art.js`.
   - Les noms de chapeaux et d'accessoires du module sont dans `HATS` et `ACCESSORIES`. Fais la correspondance avec les identifiants existants plutôt que de casser les données sauvegardées.
   - Selfie : `faceSlot(kind)` donne le centre et le rayon du visage. Superpose la photo du joueur en cercle à cet endroit (clipPath ou `<image>` arrondie) quand le joueur a un selfie.
   - Humeurs : `happy` par défaut, `win` sur le podium (avec `arms: true`), `sad` pour l'éliminé, `wow` pour les surprises.
6. **Icônes de jeux** : utilise `jeux/<slug>.svg` dans le catalogue. Chaque jeu a aussi sa couleur dans `GAME_LIST`.
7. **Écrans** : applique le style des maquettes aux écrans existants (salon d'attente, jeu, résultats, podium, hôte, éditeur, manettes) :
   - cartes blanches, contour prune 4 px sur téléphone et 6 px sur télé ;
   - ombre plate prune vers le bas, sans flou ;
   - boutons en pilule ;
   - gros titres en texte « autocollant » (rebord blanc + ombre prune).
8. **Typo** : Fredoka 600/700 pour les titres et boutons, Nunito pour le texte courant. Charge-les si ce n'est pas déjà fait (les SVG en dépendent). À la télé, aucun texte sous 28 px.

## Contraintes

- **Performances Chromecast** : formes plates, pas de `filter`, pas de `box-shadow` floue, pas de dégradés animés. Mets les SVG statiques en cache (une seule génération par perso et par couleur, pas à chaque frame).
- **Ne touche pas** à la logique de jeu, au réseau, au système de salons ni au format des données.
- Garde les textes de l'interface en français.
- Les icônes PNG pour les stores (si besoin) devront être exportées avec Fredoka chargée. Sinon, signale-le-moi.

Quand c'est fait, donne-moi la liste des fichiers modifiés et ce qui reste à faire à la main.
