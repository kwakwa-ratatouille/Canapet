# Cana'pet sur Google Play : ce qu'il faut remplir

## Clé d'envoi (une seule fois)
Fichiers dans `Bureau\Canapet-cle-android` (hors du dépôt, à sauvegarder sur une clé USB, à ne jamais envoyer à personne).
Sur GitHub : dépôt > Settings > Secrets and variables > Actions > New repository secret. Créer 3 secrets, avec le contenu du fichier du même nom :
`UPLOAD_KEY_BASE64`, `UPLOAD_KEY_PASSWORD`, `UPLOAD_KEY_ALIAS`.
Puis Actions > Appli Android > Run workflow. Le fichier `.aab` apparaît sur la release `android-play`.

## Avant d'envoyer
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
- Argent, jeux d'argent : pas de mise ni de gain d'argent. MAIS le Coffre à clé est un « achat d'objets aléatoires » : répondre OUI à cette question (PEGI ajoute la mention « Inclut des achats aléatoires »).
- Public cible : 13 ans et plus (pas d'enfants).

## Test fermé
12 testeurs Android minimum, inscrits 14 jours d'affilée. Prendre 15 à 20 personnes. Demander ensuite la production.

## Vente sur le site (Stripe)
1. Créer la micro-entreprise, puis un compte sur stripe.com et l'activer.
2. Formule Blaze sur Firebase (voir plus bas), puis : `npx firebase-tools functions:secrets:set STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET`.
3. Dans Stripe > Développeurs > Webhooks, ajouter `https://europe-west1-canapet-31bb7.cloudfunctions.net/stripeWebhook` avec les événements `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, `charge.dispute.created` et `charge.dispute.closed`. La clé `whsec_…` donnée par Stripe est le STRIPE_WEBHOOK_SECRET.
4. Commencer avec les clés de test de Stripe (`sk_test_…`, carte d'essai), passer `SALES_ON` à vrai, tester, puis mettre les vraies clés.
5. Adhérer à un médiateur de la consommation. Donner à Claude le SIRET, l'adresse, le médiateur (nom + site) et la mention de TVA : à remplir en haut de `src/pages/Legal.tsx`. Faire relire les pages légales (renonciation, et fonction de rétractation en ligne : savoir si elle reste due quand le client a renoncé). Vérifier sur un paiement d'essai que le reçu porte bien la phrase de renonciation. Activer les reçus par e-mail dans Stripe, et vérifier la TVA avec un comptable.

## Boîtes et clés
- Chances affichées dans l'onglet Boîtes avant d'ouvrir, comme Google l'exige pour les objets aléatoires payants. Liste complète sur le téléphone (« Voir tout ce qu'on peut gagner ») et sur le site.
- Produits Play à créer en plus (consommables) : `keys_1` 0,99 €, `keys_5` 3,99 €, `keys_12` 7,99 €.
- Belgique et Pays-Bas : coffre masqué d'après la langue et le fuseau de l'appareil (`KEYS_ALLOWED`). Ce filtre se contourne : exclure aussi ces pays pour ces produits dans la console Play si c'est possible, et refuser les cartes de ces pays dans Stripe (Radar).
- À faire relire par un juriste AVANT d'activer les clés : boîtes payantes et moins de 18 ans. Sans cet accord, garder les boîtes en bonbons seulement.
- Déployer aussi la fonction `openChest`, et coller les règles (`keys`).

## Quand on activera les ventes
1. Créer la micro-entreprise et le profil de paiement Google.
2. Créer les produits (achats uniques) dans la console : `pass_soiree` 3,99 € ; à 1,99 € : `pack_couples`, `pack_famille`, `pack_boulot`, `pack_minuit`, `coll_noel`, `coll_halloween`, `coll_plage`.
3. Passer le projet Firebase en formule Blaze (carte demandée, gratuit dans les limites, mettre une alerte de budget).
4. Mettre en ligne le serveur : `npx firebase-tools login` puis `npx firebase-tools deploy --only functions` (dossier du projet), et coller les règles `database.rules.json`.
5. Donner au compte de service du projet (`canapet-31bb7@appspot.gserviceaccount.com` ou celui indiqué par la console) l'accès « Voir les données financières » et « Gérer les commandes » dans la console Play > Utilisateurs et autorisations, et activer « Google Play Android Developer API » dans Google Cloud.
6. Tester avec un compte « testeur de licence » (achat fictif), puis passer `SALES_ON` à vrai dans `src/shared/offer.ts`.
7. Sécurité des données : ajouter « Historique d'achats ».
