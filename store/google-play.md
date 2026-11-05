# Cana'pet sur Google Play : ce qu'il faut remplir

## Clé d'envoi (une seule fois)
Fichiers dans `Bureau\Canapet-cle-android` (hors du dépôt, à sauvegarder sur une clé USB, à ne jamais envoyer à personne).
Sur GitHub : dépôt > Settings > Secrets and variables > Actions > New repository secret. Créer 3 secrets, avec le contenu du fichier du même nom :
`UPLOAD_KEY_BASE64`, `UPLOAD_KEY_PASSWORD`, `UPLOAD_KEY_ALIAS`.
Puis Actions > Appli Android > Run workflow. Le fichier `.aab` apparaît sur la release `android-play`.

## Avant d'envoyer
- Dans `src/pages/Legal.tsx`, remplir `EDITOR` (nom) et `CONTACT` (e-mail public, pas forcément ton e-mail perso).
- Vérifier que le nom Cana'pet est libre (INPI, EUIPO, Play Store).

## Fiche
- Nom : Cana'pet : jeux de soirée
- Résumé (80 signes) : Le téléphone devient la manette, la télé devient le plateau. Jusqu'à 12 joueurs !
- Description :
  Transformez votre salon en soirée de jeux ! Ouvrez Cana'pet sur une télé ou un ordinateur, scannez le QR code, et chaque téléphone devient une manette. Vos amis n'ont rien à installer.
  28 jeux, de 2 à 12 joueurs : courses, bagarres molles, bluff, dessin, votes entre amis, définitions bidon, questions de culture et tournois avec podium.
  Crée ton perso rigolo, ajoute ton selfie, gagne des bonbons, relève les défis de la semaine et débloque des tenues.
  Il faut un écran (télé connectée avec navigateur, ordinateur en HDMI) et internet.
- Catégorie : Jeux > Soirée. Tags : Multijoueur local.
- Icône 512 × 512 : `public/da/logo`. Image de présentation 1024 × 500 et 2 captures minimum : à faire.

## Adresses à donner
- Confidentialité : https://kwakwa-ratatouille.github.io/Canapet/#/confidentialite
- Suppression de compte : https://kwakwa-ratatouille.github.io/Canapet/#/supprimer-compte

## Accès pour les testeurs de Google (App access)
Pas de connexion obligatoire. Instructions : ouvrir https://kwakwa-ratatouille.github.io/Canapet/#/tv sur un ordinateur, taper le code affiché dans l'appli.

## Sécurité des données (Data safety)
- Collectées, seulement avec compte Google : nom, e-mail (connexion Google), identifiant, photo de profil, progression. Facultatif. Pas partagées, pas de pub.
- Photos et vidéos : envoyées à la télé de la partie, seulement si le joueur les choisit, non gardées.
- Données chiffrées en transit : oui. Suppression possible : oui (adresse ci-dessus).
- Publicité : non.

## Questionnaire d'âge (IARC) : répondre honnêtement
- Violence : cartoon (bagarres, duel au pistolet dessiné dans le Bar des Bobards).
- Humour grossier et allusions : oui hors mode famille. Bar fictif : mention d'alcool possible.
- Contenu créé par les joueurs : oui (pseudos, textes, dessins, photos), avec masquage et exclusion par l'hôte.
- Argent, jeux d'argent : non.
- Public cible : 13 ans et plus (pas d'enfants).

## Test fermé
12 testeurs Android minimum, inscrits 14 jours d'affilée. Prendre 15 à 20 personnes. Demander ensuite la production.

## Quand on activera les ventes
1. Créer la micro-entreprise et le profil de paiement Google.
2. Créer le produit `pass_soiree` (achat unique) dans la console.
3. Brancher Google Play Billing et la vérification de l'achat par un serveur, puis passer `SALES_ON` à vrai dans `src/shared/offer.ts`.
