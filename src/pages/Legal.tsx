import { store } from '../shared/device';
import { defaultLang } from '../shared/i18n';
import type { Lang } from '../shared/protocol';

// Pages légales, aussi demandées par Google Play (adresses à donner dans la console) :
// #/confidentialite, #/conditions, #/supprimer-compte, #/mentions-legales.
const EDITOR = 'Matis Rodrigues';
const CONTACT = 'matis.rodrigues1@gmail.com';
// À remplir AVANT d'ouvrir les ventes (voir store/google-play.md) :
const SIRET = '';
const ADDRESS = '';
/** Médiateur de la consommation : nom et adresse du site. */
const MEDIATOR = { name: '', url: '' };
/** En franchise de TVA : « TVA non applicable, art. 293 B du CGI ». */
const VAT_NOTE = '';
const UPDATED = '5 novembre 2026';

type Doc = { title: string; blocks: [string, string[]][] };

const who = (fr: boolean) =>
  `${EDITOR || (fr ? '[nom de l’éditeur à compléter]' : '[publisher name to be completed]')} · ${CONTACT || (fr ? '[e-mail de contact à compléter]' : '[contact e-mail to be completed]')}`;

/** Qui vend : seulement ce qui est connu (rien de tout ça tant que l'entreprise n'existe pas). */
const seller = (fr: boolean) =>
  [EDITOR, ADDRESS, SIRET && `SIRET ${SIRET}`, VAT_NOTE, fr ? `Contact : ${CONTACT}` : `Contact: ${CONTACT}`].filter(Boolean);

const mediator = (fr: boolean) =>
  MEDIATOR.name
    ? fr
      ? `Si tu n’obtiens pas de solution après nous avoir écrit, tu peux saisir gratuitement le médiateur de la consommation : ${MEDIATOR.name}, ${MEDIATOR.url}.`
      : `If writing to us does not solve the problem, you can refer it free of charge to the consumer mediator: ${MEDIATOR.name}, ${MEDIATOR.url}.`
    : fr
      ? 'Les ventes ne sont pas encore ouvertes. Les coordonnées du médiateur de la consommation seront indiquées ici avant leur ouverture.'
      : 'Sales are not open yet. The consumer mediator’s details will be shown here before they open.';

const DOCS: Record<string, (fr: boolean) => Doc> = {
  'mentions-legales': (fr) =>
    fr
      ? {
          title: 'Mentions légales',
          blocks: [
            ['Éditeur', seller(true)],
            [
              'Hébergement',
              [
                'Site : GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis.',
                'Comptes et données : Google Firebase, Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irlande.',
              ],
            ],
            ['Propriété', ['Le jeu, ses personnages, ses dessins, ses textes et ses musiques sont protégés. Merci de ne pas les reprendre sans accord.']],
          ],
        }
      : {
          title: 'Legal notice',
          blocks: [
            ['Publisher', seller(false)],
            [
              'Hosting',
              [
                'Site: GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA.',
                'Accounts and data: Google Firebase, Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ireland.',
              ],
            ],
            ['Ownership', ['The game, its characters, drawings, text and music are protected. Please do not reuse them without permission.']],
          ],
        },
  confidentialite: (fr) =>
    fr
      ? {
          title: 'Politique de confidentialité',
          blocks: [
            ['Qui est responsable ?', [who(true)]],
            [
              'Ce que le jeu utilise',
              [
                'Sans compte : ton pseudo, ton perso et ta progression restent sur ton téléphone. Ton pseudo et ton perso sont envoyés à la télé de la partie.',
                'Avec un compte Google (facultatif) : ton identifiant, ton nom et ta photo Google, et ta progression (niveau, bonbons, objets), pour la retrouver sur un autre téléphone.',
                'Achats (Pass, packs, collections) : Google Play ou Stripe (sur le site) encaisse le paiement, nous ne voyons jamais ta carte. Stripe reçoit les informations nécessaires au paiement et ton e-mail, pour t’envoyer le reçu ; ces données peuvent être traitées hors de l’Union européenne, avec les garanties prévues par la loi. Nous gardons le numéro de commande et la date, liés à ton compte, comme preuve d’achat.',
                'Amis (facultatif, avec un compte) : ton pseudo, ton perso, ton code ami, quand tu étais en ligne et ta partie en cours sont visibles par les personnes qui ont ton code ou que tu as ajoutées. Tu peux les retirer à tout moment.',
                'Si tu nous écris : ton adresse et ton message, le temps de te répondre.',
                'Selfie et Photo Mystère (facultatifs) : seules les images que tu choisis sont envoyées à la télé de la partie, pour les afficher. Elles ne sont pas gardées quand la partie se termine.',
                'Textes et dessins : ce que tu tapes ou dessines dans un jeu s’affiche à la télé de la partie et n’est pas gardé.',
              ],
            ],
            [
              'Où ça passe',
              [
                'La télé et les téléphones se parlent en direct quand c’est possible. Un service de mise en relation (PeerJS) et des relais techniques peuvent voir passer les adresses IP et les données de la liaison.',
                'Si la liaison directe ne marche pas, les messages de la partie, photos comprises, passent par Google Firebase et sont effacés dès leur lecture. Ils restent lisibles par une personne qui connaîtrait le code de la partie à ce moment-là : n’envoie rien de sensible.',
                'Le compte et la progression sont gardés par Google Firebase (base de données en Belgique). La voix du présentateur est celle de ton appareil, qui peut utiliser un service en ligne selon le navigateur.',
              ],
            ],
            ['Pourquoi (bases légales)', ['Faire fonctionner le jeu que tu as demandé (exécution du service), et sauvegarder ta progression si tu crées un compte (ton choix). Il n’y a ni publicité, ni revente de données, ni profilage.']],
            ['Combien de temps', ['Le compte et la progression sont gardés jusqu’à leur suppression. Les données d’une partie sont effacées quand elle se termine. Les preuves d’achat sont gardées 10 ans pour la comptabilité.']],
            ['Tes droits', ['Tu peux demander à voir, corriger, supprimer ou récupérer tes données, ou t’opposer à leur usage, en écrivant au contact ci-dessus. Tu peux aussi saisir la CNIL (cnil.fr). Pour effacer ton compte : voir « Supprimer mon compte » sur l’accueil.']],
            ['Âge', ['Le jeu est réservé aux 13 ans et plus. Avant 15 ans, en France, l’accord d’un parent est demandé pour créer un compte.']],
          ],
        }
      : {
          title: 'Privacy policy',
          blocks: [
            ['Who is responsible?', [who(false)]],
            [
              'What the game uses',
              [
                'Without an account: your nickname, character and progress stay on your phone. Your nickname and character are sent to the TV of the game.',
                'With a Google account (optional): your Google ID, name and photo, and your progress (level, candies, items), so you can get it back on another phone.',
                'Purchases (Pass, packs, collections): Google Play or Stripe (on the site) takes the payment, we never see your card. Stripe receives what it needs for the payment and your e-mail, to send you the receipt; this data may be processed outside the European Union, with the safeguards required by law. We keep the order number and date, linked to your account, as proof of purchase.',
                'Friends (optional, with an account): your nickname, character, friend code, when you were last online and your current game are visible to people who have your code or whom you added. You can remove them at any time.',
                'If you write to us: your address and message, long enough to answer you.',
                'Selfie and Mystery Photo (optional): only the pictures you choose are sent to the TV of the game, to display them. They are not kept when the game ends.',
                'Text and drawings: what you type or draw in a game appears on the TV of the game and is not kept.',
              ],
            ],
            [
              'Where it goes',
              [
                'The TV and the phones talk directly when possible. A pairing service (PeerJS) and technical relays can see IP addresses and connection data.',
                'If the direct link fails, game messages, photos included, go through Google Firebase and are erased as soon as they are read. Someone who knows the game code at that moment could read them: do not send anything sensitive.',
                'Your account and progress are stored by Google Firebase (database in Belgium). The host’s voice comes from your device, which may use an online service depending on the browser.',
              ],
            ],
            ['Why (legal bases)', ['To run the game you asked for (performance of the service), and to save your progress if you create an account (your choice). No ads, no data sales, no profiling.']],
            ['How long', ['Your account and progress are kept until deleted. Game data is erased when the game ends. Proof of purchase is kept for 10 years for accounting.']],
            ['Your rights', ['You can ask to access, correct, delete or export your data, or object to its use, by writing to the contact above. You can also contact your data protection authority. To erase your account: see “Delete my account” on the home screen.']],
            ['Age', ['The game is for ages 13 and up. Under the age of digital consent in your country, a parent’s agreement is needed to create an account.']],
          ],
        },
  conditions: (fr) =>
    fr
      ? {
          title: 'Conditions d’utilisation',
          blocks: [
            ['Le jeu', ['Cana’pet est un jeu de soirée : une télé ou un ordinateur affiche le jeu, les téléphones servent de manettes. Il faut une connexion internet. Le jeu est fourni tel quel et peut évoluer.']],
            ['Âge et contenu', ['Réservé aux 13 ans et plus. Certains jeux ont un humour piquant et un duel de cartoon : le mode famille, sur le téléphone de l’hôte, adoucit les textes.']],
            [
              'Ce que tu envoies',
              [
                'Tu es responsable de tes pseudos, textes, dessins, photos et vidéos. N’envoie que des images que tu as le droit de montrer, et jamais rien de sexuel, de violent, de haineux, d’illégal, ni la photo de quelqu’un sans son accord. Rien impliquant un mineur de façon inappropriée.',
              ],
            ],
            [
              'Signaler et bloquer',
              ['Pendant Photo Mystère, n’importe quel joueur peut masquer tout de suite une photo avec le bouton 🚩. L’hôte peut retirer un joueur de la partie. Pour signaler un abus : écris au contact ci-dessous.'],
            ],
            ['Achats', ['Le Pass Soirée, les packs et les collections sont des achats uniques, sans abonnement : le prix est affiché avant de payer, et Google Play (dans l’appli) ou Stripe (sur le site) encaisse. Ils s’activent tout de suite. Sur le site, tu demandes cet accès immédiat et renonces à ton droit de rétractation de 14 jours avant de payer. Dans l’appli, les remboursements suivent les règles de Google Play. Pour un problème d’achat sur le site, écris au contact ci-dessous. Les bonbons 🍬 du jeu n’ont pas de valeur en argent.']],
            ['Ce qu’il faut pour jouer', ['Un écran avec un navigateur récent (télé connectée ou ordinateur), un téléphone par joueur et internet. Le Pass et les packs marchent quand l’acheteur est connecté à son compte dans le salon. Vérifie que le jeu gratuit marche chez toi avant d’acheter.']],
            ['Confirmation', ['Après le paiement, le reçu envoyé par e-mail confirme ta commande, ta demande d’accès immédiat et la perte de ton droit de rétractation.']],
            ['Garantie', ['Tu bénéficies de la garantie légale de conformité des contenus numériques. Si un achat ne marche pas, écris-nous : nous le réparons, sinon nous le remboursons.']],
            ['Litiges', [mediator(true), 'Ces conditions suivent le droit français, sans te priver des protections de ton pays de résidence.']],
            ['Vendeur et contact', seller(true)],
          ],
        }
      : {
          title: 'Terms of use',
          blocks: [
            ['The game', ['Cana’pet is a party game: a TV or computer shows the game, phones are the controllers. An internet connection is needed. The game is provided as is and may change.']],
            ['Age and content', ['For ages 13 and up. Some games have edgy humour and a cartoon duel: family mode, on the host’s phone, softens the text.']],
            ['What you send', ['You are responsible for your nicknames, text, drawings, photos and videos. Only send pictures you have the right to show, and never anything sexual, violent, hateful or illegal, nor a picture of someone without their consent. Nothing involving a minor inappropriately.']],
            ['Report and block', ['During Mystery Photo, any player can hide a picture at once with the 🚩 button. The host can remove a player from the game. To report abuse, write to the contact below.']],
            ['Purchases', ['The Party Pass, packs and collections are one-time purchases, no subscription: the price is shown before paying, and Google Play (in the app) or Stripe (on the site) takes the payment. They activate at once. On the site, you ask for this immediate access and give up your 14-day right of withdrawal before paying. In the app, refunds follow Google Play’s rules. For a problem with a site purchase, write to the contact below. In-game candies 🍬 have no money value.']],
            ['What you need to play', ['A screen with a recent browser (smart TV or computer), one phone per player and internet. The Pass and packs work when the buyer is signed in to their account in the room. Check that the free game works for you before buying.']],
            ['Confirmation', ['After payment, the receipt sent by e-mail confirms your order, your request for immediate access and the loss of your right of withdrawal.']],
            ['Warranty', ['You benefit from the legal guarantee of conformity for digital content. If a purchase does not work, write to us: we fix it, otherwise we refund it.']],
            ['Disputes', [mediator(false), 'These terms follow French law, without removing the protections of your country of residence.']],
            ['Seller and contact', seller(false)],
          ],
        },
  'supprimer-compte': (fr) =>
    fr
      ? {
          title: 'Supprimer mon compte',
          blocks: [
            ['Dans l’appli ou sur le site', ['Ouvre l’accueil de Cana’pet sur ton téléphone, carte « Mon compte », puis « Supprimer mon compte » et confirme. Si on te le demande, reconnecte-toi et recommence.']],
            ['Ce qui est effacé', ['Ton compte de connexion et ta progression en ligne (niveau, bonbons, objets), tout de suite. La preuve de tes achats est gardée pour la comptabilité. La progression gardée sur ton téléphone part quand tu désinstalles l’appli ou effaces les données du site.']],
            ['Sans accès à l’appli', [`Écris à : ${who(true)}, depuis l’adresse de ton compte Google. Réponse sous 30 jours.`]],
          ],
        }
      : {
          title: 'Delete my account',
          blocks: [
            ['In the app or on the site', ['Open the Cana’pet home screen on your phone, “My account” card, then “Delete my account” and confirm. If asked, sign in again and retry.']],
            ['What is erased', ['Your sign-in account and online progress (level, candies, items), right away. Proof of your purchases is kept for accounting. Progress stored on your phone goes when you uninstall the app or clear the site’s data.']],
            ['Without access to the app', [`Write to: ${who(false)}, from your Google account address. Reply within 30 days.`]],
          ],
        },
};

export const isLegal = (page: string) => page in DOCS;

export function Legal({ page }: { page: string }) {
  const lang: Lang = store('profile', { lang: defaultLang() }).lang ?? defaultLang();
  const fr = lang === 'fr';
  const doc = DOCS[page](fr);
  return (
    <div className="home help legal">
      <a className="pill" href="#/">
        ← {fr ? 'Retour' : 'Back'}
      </a>
      <h1>{doc.title}</h1>
      {doc.blocks.map(([h, ps]) => (
        <div className="home-card" key={h}>
          <h2>{h}</h2>
          {ps.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      ))}
      <p className="pad-small">{fr ? `Mis à jour le ${UPDATED}.` : `Updated ${UPDATED}.`}</p>
    </div>
  );
}

/** Liens en bas des écrans d'accueil. */
export function LegalLinks({ lang }: { lang: Lang }) {
  const fr = lang === 'fr';
  return (
    <p className="legal-links">
      <a className="legal-avis" href={`mailto:${CONTACT}?subject=${encodeURIComponent(fr ? 'Mon avis sur Cana’pet' : 'My feedback on Cana’pet')}`}>💬 {fr ? 'Donner mon avis' : 'Send feedback'}</a>
      <br />
      <a href="#/confidentialite">{fr ? 'Confidentialité' : 'Privacy'}</a> · <a href="#/conditions">{fr ? 'Conditions' : 'Terms'}</a> · <a href="#/mentions-legales">{fr ? 'Mentions légales' : 'Legal notice'}</a>
    </p>
  );
}
