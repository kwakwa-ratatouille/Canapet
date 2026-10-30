// Questions de la soirée : votes rapides entre deux jeux.
// « who » = on vote pour un joueur (le désigné gagne un titre) ; « ab » = tu préfères A ou B (la majorité marque).
// fam: false = caché en mode famille.
import type { Lang } from '../shared/protocol';

export interface WhoQ {
  q: Record<Lang, string>;
  /** Titre gagné par le désigné. */
  t: Record<Lang, string>;
  fam?: false;
}
export interface AbQ {
  q: Record<Lang, string>;
  a: Record<Lang, string>;
  b: Record<Lang, string>;
  fam?: false;
}

const w = (fr: string, tfr: string, en: string, ten: string, fam?: false): WhoQ => ({ q: { fr, en }, t: { fr: tfr, en: ten }, fam });
const ab = (fr: string, afr: string, bfr: string, en: string, aen: string, ben: string, fam?: false): AbQ => ({ q: { fr, en }, a: { fr: afr, en: aen }, b: { fr: bfr, en: ben }, fam });

export const WHO: WhoQ[] = [
  w('Qui finirait en prison en premier ?', '🚔 Futur taulard', 'Who would end up in jail first?', '🚔 Future convict', false),
  w('Qui survivrait le moins longtemps dans un film d’horreur ?', '🔪 Première victime', 'Who would die first in a horror movie?', '🔪 First victim'),
  w('Qui a le plus de chances de devenir célèbre ?', '🌟 Future star', 'Who is most likely to become famous?', '🌟 Future star'),
  w('Qui triche le plus aux jeux de société ?', '🃏 Gros tricheur', 'Who cheats the most at board games?', '🃏 Big cheater'),
  w('Qui est le plus mauvais perdant ?', '😤 Mauvais perdant', 'Who is the sorest loser?', '😤 Sore loser'),
  w('Qui oublierait son propre anniversaire ?', '🎂 Tête en l’air', 'Who would forget their own birthday?', '🎂 Scatterbrain'),
  w('Qui se perdrait dans un supermarché ?', '🧭 Boussole cassée', 'Who would get lost in a supermarket?', '🧭 Broken compass'),
  w('Qui passe le plus de temps sur son téléphone ?', '📱 Accro à l’écran', 'Who spends the most time on their phone?', '📱 Screen addict'),
  w('Qui rirait à un enterrement ?', '😅 Fou rire incontrôlable', 'Who would laugh at a funeral?', '😅 Uncontrollable giggles', false),
  w('Qui mangerait le dernier morceau de pizza sans demander ?', '🍕 Voleur de pizza', 'Who would eat the last slice without asking?', '🍕 Pizza thief'),
  w('Qui ferait le pire colocataire ?', '🧦 Coloc de l’enfer', 'Who would be the worst roommate?', '🧦 Roommate from hell'),
  w('Qui gagnerait à un jeu télé ?', '🏆 Champion du petit écran', 'Who would win a TV game show?', '🏆 Game show champ'),
  w('Qui envoie des messages à 3 h du matin ?', '🌙 Oiseau de nuit', 'Who texts at 3 a.m.?', '🌙 Night owl'),
  w('Qui chante le plus faux sous la douche ?', '🎤 Rossignol enrhumé', 'Who sings the most off-key in the shower?', '🎤 Squeaky nightingale'),
  w('Qui pleure devant les dessins animés ?', '😭 Cœur d’artichaut', 'Who cries at cartoons?', '😭 Big softie'),
  w('Qui serait le premier à fuir en cas d’invasion de zombies ?', '🏃 Sprinteur peureux', 'Who would run first in a zombie invasion?', '🏃 Scaredy sprinter'),
  w('Qui a le rire le plus bizarre ?', '🦭 Rire de phoque', 'Who has the weirdest laugh?', '🦭 Seal laugh'),
  w('Qui dépenserait tout son salaire en une journée ?', '💸 Panier percé', 'Who would blow their whole paycheck in a day?', '💸 Big spender'),
  w('Qui raconte les pires blagues ?', '🥁 Roi de la blague nulle', 'Who tells the worst jokes?', '🥁 King of bad jokes'),
  w('Qui arrive toujours en retard ?', '⏰ Éternel retardataire', 'Who is always late?', '⏰ Forever late'),
  w('Qui serait le meilleur président ?', '🎩 Futur président', 'Who would make the best president?', '🎩 Future president'),
  w('Qui a des goûts musicaux douteux ?', '🎧 DJ de la honte', 'Who has questionable taste in music?', '🎧 DJ of shame'),
  w('Qui ferait un excellent espion ?', '🕵️ Agent double', 'Who would make a great spy?', '🕵️ Double agent'),
  w('Qui est le plus dramatique ?', '🎭 Reine du drame', 'Who is the most dramatic?', '🎭 Drama queen'),
  w('Qui dort le plus ?', '😴 Marmotte officielle', 'Who sleeps the most?', '😴 Official sloth'),
  w('Qui adopterait 15 chats ?', '🐈 Futur(e) maître des chats', 'Who would adopt 15 cats?', '🐈 Cat overlord'),
  w('Qui ne sait pas garder un secret ?', '📣 Haut-parleur', 'Who can’t keep a secret?', '📣 Loudspeaker'),
  w('Qui a le plus de chance ?', '🍀 Trèfle à quatre feuilles', 'Who is the luckiest?', '🍀 Four-leaf clover'),
  w('Qui ferait un procès à son voisin pour une haie ?', '⚖️ Avocat du dimanche', 'Who would sue a neighbor over a hedge?', '⚖️ Sunday lawyer'),
  w('Qui a la pire écriture ?', '✍️ Gribouilleur pro', 'Who has the worst handwriting?', '✍️ Pro scribbler'),
  w('Qui finirait milliardaire ?', '💰 Futur milliardaire', 'Who would become a billionaire?', '💰 Future billionaire'),
  w('Qui parle à ses plantes ?', '🪴 Chuchoteur de plantes', 'Who talks to their plants?', '🪴 Plant whisperer'),
  w('Qui ferait exploser la cuisine en faisant des pâtes ?', '🔥 Danger en cuisine', 'Who would blow up the kitchen making pasta?', '🔥 Kitchen hazard'),
  w('Qui raconte sa vie à des inconnus ?', '🗣️ Moulin à paroles', 'Who tells strangers their life story?', '🗣️ Chatterbox'),
  w('Qui serait le premier éliminé de Koh-Lanta ?', '🏝️ Naufragé express', 'Who would be first voted off a survival show?', '🏝️ Express castaway'),
  w('Qui a sûrement un compte secret sur les réseaux ?', '🥸 Compte mystère', 'Who surely has a secret social account?', '🥸 Mystery account', false),
  w('Qui mettrait des chaussettes avec des sandales ?', '🧦 Icône de mode', 'Who would wear socks with sandals?', '🧦 Fashion icon'),
  w('Qui ronfle le plus fort ?', '🐗 Tronçonneuse nocturne', 'Who snores the loudest?', '🐗 Night chainsaw'),
  w('Qui ferait un selfie avec un ours ?', '🐻 Inconscient(e)', 'Who would take a selfie with a bear?', '🐻 Fearless fool'),
  w('Qui ment le mieux ?', '🤥 Pinocchio', 'Who lies the best?', '🤥 Pinocchio', false),
  w('Qui mange le plus ?', '🍔 Estomac sans fond', 'Who eats the most?', '🍔 Bottomless stomach'),
  w('Qui serait le pire chauffeur de bus ?', '🚌 Pilote de l’extrême', 'Who would be the worst bus driver?', '🚌 Extreme driver'),
  w('Qui gagnerait un concours de grimaces ?', '🤪 Roi des grimaces', 'Who would win a funny-face contest?', '🤪 Funny-face king'),
  w('Qui a déjà parlé tout seul aujourd’hui ?', '💬 Monologueur', 'Who already talked to themselves today?', '💬 Monologuer'),
  w('Qui piquerait une crise pour un jeu vidéo ?', '🎮 Rage quit', 'Who would rage over a video game?', '🎮 Rage quitter'),
  w('Qui a le plus de chances de se marier à Las Vegas sur un coup de tête ?', '💒 Coup de tête', 'Who would get married in Vegas on a whim?', '💒 Wild card', false),
  w('Qui se ferait avoir par une arnaque par SMS ?', '📩 Proie facile', 'Who would fall for a text scam?', '📩 Easy target'),
  w('Qui est secrètement un génie ?', '🧠 Génie caché', 'Who is secretly a genius?', '🧠 Hidden genius'),
  w('Qui ferait le meilleur parent ?', '🍼 Super parent', 'Who would make the best parent?', '🍼 Super parent'),
  w('Qui oserait chanter au karaoké devant 500 personnes ?', '🎙️ Bête de scène', 'Who would sing karaoke for 500 people?', '🎙️ Stage beast'),
];

export const AB: AbQ[] = [
  ab('Tu préfères…', '🦵 Des jambes de poulet', '💪 Des bras de T-Rex', 'Would you rather…', '🦵 Chicken legs', '💪 T-Rex arms'),
  ab('Tu préfères…', '🍕 Pizza à l’ananas à vie', '🥦 Plus jamais de pizza', 'Would you rather…', '🍕 Pineapple pizza forever', '🥦 No pizza ever again'),
  ab('Tu préfères…', '🦸 Voler', '👻 Être invisible', 'Would you rather…', '🦸 Fly', '👻 Be invisible'),
  ab('Tu préfères…', '🐌 Parler très lentement', '🐇 Parler très vite', 'Would you rather…', '🐌 Talk super slowly', '🐇 Talk super fast'),
  ab('Tu préfères…', '🦆 Combattre 1 canard géant', '🐴 Combattre 100 mini-chevaux', 'Would you rather…', '🦆 Fight 1 giant duck', '🐴 Fight 100 tiny horses'),
  ab('Tu préfères…', '🎤 Chanter tout ce que tu dis', '💃 Danser à chaque pas', 'Would you rather…', '🎤 Sing everything you say', '💃 Dance every step'),
  ab('Tu préfères…', '🧀 Sentir le fromage', '🐟 Sentir le poisson', 'Would you rather…', '🧀 Smell like cheese', '🐟 Smell like fish'),
  ab('Tu préfères…', '📵 Plus d’internet', '🚿 Plus d’eau chaude', 'Would you rather…', '📵 No internet', '🚿 No hot water'),
  ab('Tu préfères…', '🦖 Un dinosaure de compagnie', '🐉 Un dragon de poche', 'Would you rather…', '🦖 A pet dinosaur', '🐉 A pocket dragon'),
  ab('Tu préfères…', '😂 Rire à chaque éternuement', '🤧 Éternuer à chaque rire', 'Would you rather…', '😂 Laugh every time you sneeze', '🤧 Sneeze every time you laugh'),
  ab('Tu préfères…', '⏪ Revenir dans le passé', '⏩ Voir le futur', 'Would you rather…', '⏪ Go to the past', '⏩ See the future'),
  ab('Tu préfères…', '🍫 Chocolat', '🍬 Bonbons', 'Would you rather…', '🍫 Chocolate', '🍬 Candy'),
  ab('Tu préfères…', '🏖️ Plage', '🏔️ Montagne', 'Would you rather…', '🏖️ Beach', '🏔️ Mountains'),
  ab('Tu préfères…', '🐶 Parler aux animaux', '🌍 Parler toutes les langues', 'Would you rather…', '🐶 Talk to animals', '🌍 Speak every language'),
  ab('Tu préfères…', '🧦 Chaussettes mouillées à vie', '👕 T-shirt qui gratte à vie', 'Would you rather…', '🧦 Wet socks forever', '👕 Itchy shirt forever'),
  ab('Tu préfères…', '🎬 Vivre dans un dessin animé', '🎮 Vivre dans un jeu vidéo', 'Would you rather…', '🎬 Live in a cartoon', '🎮 Live in a video game'),
  ab('Tu préfères…', '🦷 Des dents en chocolat', '💇 Des cheveux en spaghetti', 'Would you rather…', '🦷 Chocolate teeth', '💇 Spaghetti hair'),
  ab('Tu préfères…', '🕷️ Une araignée dans ton lit', '🐍 Un serpent dans ta baignoire', 'Would you rather…', '🕷️ A spider in your bed', '🐍 A snake in your bath'),
  ab('Tu préfères…', '🤐 Ne plus jamais parler', '🙈 Ne plus jamais voir de film', 'Would you rather…', '🤐 Never speak again', '🙈 Never watch a movie again'),
  ab('Tu préfères…', '💨 Péter à chaque bisou', '🤢 Roter à chaque câlin', 'Would you rather…', '💨 Fart with every kiss', '🤢 Burp with every hug', false),
  ab('Tu préfères…', '👑 Être roi pour un jour', '💎 Être riche pour un an', 'Would you rather…', '👑 Be king for a day', '💎 Be rich for a year'),
  ab('Tu préfères…', '🥶 Toujours avoir froid', '🥵 Toujours avoir chaud', 'Would you rather…', '🥶 Always be cold', '🥵 Always be hot'),
  ab('Tu préfères…', '🦒 Un cou de girafe', '🐘 Une trompe d’éléphant', 'Would you rather…', '🦒 A giraffe neck', '🐘 An elephant trunk'),
  ab('Tu préfères…', '🎵 Une chanson coincée dans la tête à vie', '📢 Une pub à chaque phrase', 'Would you rather…', '🎵 A song stuck in your head forever', '📢 An ad after every sentence'),
  ab('Tu préfères…', '🍝 Manger que des pâtes', '🍚 Manger que du riz', 'Would you rather…', '🍝 Only eat pasta', '🍚 Only eat rice'),
  ab('Tu préfères…', '🛋️ Gagner à Cana’pet', '❤️ Être aimé de tous', 'Would you rather…', '🛋️ Win at Cana’pet', '❤️ Be loved by all'),
  ab('Tu préfères…', '🧟 Apocalypse zombie', '👽 Invasion alien', 'Would you rather…', '🧟 Zombie apocalypse', '👽 Alien invasion'),
  ab('Tu préfères…', '📸 Que ta pire photo soit sur une affiche', '🎥 Que ta pire vidéo passe à la télé', 'Would you rather…', '📸 Your worst photo on a billboard', '🎥 Your worst video on TV'),
  ab('Tu préfères…', '🐌 Une limace dans la bouche', '🪳 Un cafard dans l’oreille', 'Would you rather…', '🐌 A slug in your mouth', '🪳 A roach in your ear', false),
  ab('Tu préfères…', '🎅 Que ce soit Noël tous les jours', '🎂 Ton anniversaire tous les mois', 'Would you rather…', '🎅 Christmas every day', '🎂 Your birthday every month'),
];
