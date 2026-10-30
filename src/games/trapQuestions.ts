// Questions de La Trappe : deux réponses, gauche ou droite. ok = index de la bonne réponse.
// fam: false = cachée en mode famille.
import type { Lang } from '../shared/protocol';

type T = Record<Lang, string>;
export interface TrapQ {
  q: T;
  a: [T, T];
  ok: 0 | 1;
  fam?: false;
}

const Q = (fr: string, en: string, a: [string, string], b: [string, string], ok: 0 | 1, fam?: false): TrapQ => ({
  q: { fr, en },
  a: [
    { fr: a[0], en: a[1] },
    { fr: b[0], en: b[1] },
  ],
  ok,
  ...(fam === false ? { fam } : {}),
});
const VF = (fr: string, en: string, vrai: boolean, fam?: false) => Q(fr, en, ['Vrai', 'True'], ['Faux', 'False'], vrai ? 0 : 1, fam);

export const TRAP_QUESTIONS: TrapQ[] = [
  VF('Une pieuvre a trois cœurs.', 'An octopus has three hearts.', true),
  VF('La Grande Muraille de Chine se voit à l’œil nu depuis la Lune.', 'The Great Wall of China is visible from the Moon.', false),
  VF('Les bananes poussent sur des arbres.', 'Bananas grow on trees.', false),
  VF('Le miel ne périme presque jamais.', 'Honey basically never goes bad.', true),
  VF('Un escargot peut dormir trois ans.', 'A snail can sleep for three years.', true),
  VF('Les autruches cachent leur tête dans le sable.', 'Ostriches bury their heads in sand.', false),
  VF('La tomate est un fruit.', 'A tomato is a fruit.', true),
  VF('Napoléon était tout petit pour son époque.', 'Napoleon was very short for his time.', false),
  VF('Les vaches ont des meilleures amies.', 'Cows have best friends.', true),
  VF('On utilise seulement 10 % de notre cerveau.', 'We only use 10% of our brain.', false),
  VF('Un flamant rose est rose à cause de ce qu’il mange.', 'Flamingos are pink because of what they eat.', true),
  VF('La foudre ne tombe jamais deux fois au même endroit.', 'Lightning never strikes the same place twice.', false),
  VF('Les fraises ont leurs graines à l’extérieur.', 'Strawberries wear their seeds on the outside.', true),
  VF('Un pet peut sortir à plus de 10 km/h.', 'A fart can come out faster than 10 km/h.', true, false),
  VF('Les poissons rouges ont une mémoire de 3 secondes.', 'Goldfish have a 3-second memory.', false),
  VF('Il pleut des diamants sur Neptune.', 'It rains diamonds on Neptune.', true),
  VF('Les chats ne sentent pas le goût sucré.', 'Cats can’t taste sweetness.', true),
  VF('Le Mont Blanc est la plus haute montagne d’Europe.', 'Mont Blanc is the highest mountain in Europe.', false),
  VF('Un humain a plus d’os à la naissance qu’adulte.', 'Babies have more bones than adults.', true),
  VF('La Tour Eiffel grandit en été.', 'The Eiffel Tower gets taller in summer.', true),
  VF('Les koalas boivent beaucoup d’eau.', 'Koalas drink a lot of water.', false),
  VF('On ronfle pendant qu’on rêve.', 'People snore while dreaming.', false),
  VF('Le cœur d’une baleine bleue est grand comme une voiture.', 'A blue whale’s heart is as big as a car.', true),
  VF('Les pingouins vivent au pôle Sud.', 'Penguins live at the South Pole.', true),
  VF('Les carottes rendent nyctalope.', 'Carrots give you night vision.', false),
  VF('Une journée sur Vénus dure plus qu’une année sur Vénus.', 'A day on Venus is longer than its year.', true),
  VF('Le chocolat blanc contient du cacao.', 'White chocolate contains cocoa solids.', false),
  VF('Les gauchers vivent moins longtemps.', 'Left-handed people live shorter lives.', false),
  VF('On ne peut pas éternuer les yeux ouverts.', 'You can’t sneeze with your eyes open.', false),
  VF('Les hippopotames transpirent rouge.', 'Hippos sweat red.', true),
  Q('Qui pond des œufs ?', 'Which one lays eggs?', ['L’ornithorynque', 'The platypus'], ['Le dauphin', 'The dolphin'], 0),
  Q('Le plus grand pays du monde ?', 'The biggest country in the world?', ['Le Canada', 'Canada'], ['La Russie', 'Russia'], 1),
  Q('Combien de pattes a une araignée ?', 'How many legs does a spider have?', ['6', '6'], ['8', '8'], 1),
  Q('La capitale de l’Australie ?', 'Capital of Australia?', ['Sydney', 'Sydney'], ['Canberra', 'Canberra'], 1),
  Q('Le plus rapide ?', 'Which is faster?', ['Le guépard', 'Cheetah'], ['L’autruche', 'Ostrich'], 0),
  Q('Le plus lourd ?', 'Which is heavier?', ['Un kilo de plumes', 'A kilo of feathers'], ['C’est pareil', 'Same weight'], 1),
  Q('D’où vient la pizza ?', 'Where does pizza come from?', ['Italie', 'Italy'], ['États-Unis', 'USA'], 0),
  Q('Quelle planète est la plus proche du Soleil ?', 'Closest planet to the Sun?', ['Mercure', 'Mercury'], ['Vénus', 'Venus'], 0),
  Q('Combien de joueurs dans une équipe de foot ?', 'Players on a football team?', ['11', '11'], ['9', '9'], 0),
  Q('Le plus long fleuve ?', 'The longest river?', ['L’Amazone ou le Nil', 'Amazon or Nile'], ['Le Mississippi', 'Mississippi'], 0),
  Q('Les frites viennent de…', 'Fries come from…', ['Belgique', 'Belgium'], ['Amérique', 'America'], 0),
  Q('Qui a peint la Joconde ?', 'Who painted the Mona Lisa?', ['Léonard de Vinci', 'Leonardo da Vinci'], ['Picasso', 'Picasso'], 0),
  Q('Le plus gros animal ?', 'The biggest animal?', ['L’éléphant', 'Elephant'], ['La baleine bleue', 'Blue whale'], 1),
  Q('Combien de temps met la lumière du Soleil pour arriver ?', 'How long does sunlight take to reach us?', ['8 minutes', '8 minutes'], ['8 secondes', '8 seconds'], 0),
  Q('Le métal liquide à température ambiante ?', 'Metal that’s liquid at room temperature?', ['Le mercure', 'Mercury'], ['L’aluminium', 'Aluminium'], 0),
  Q('Les Jeux olympiques sont nés…', 'The Olympics were born in…', ['en Grèce', 'Greece'], ['à Rome', 'Rome'], 0),
  Q('Combien de cordes sur une guitare classique ?', 'Strings on a classic guitar?', ['6', '6'], ['5', '5'], 0),
  Q('Le meilleur ami du coussin péteur ?', 'The whoopee cushion’s best friend?', ['Une chaise', 'A chair'], ['Un oreiller', 'A pillow'], 0),
  VF('Un « pet » d’ado est plus odorant qu’un pet d’adulte.', 'Teen farts smell worse than adult farts.', false, false),
  VF('On rote en moyenne 15 fois par jour.', 'People burp about 15 times a day.', true, false),
  VF('Embrasser brûle des calories.', 'Kissing burns calories.', true, false),
  VF('Les crocodiles ne peuvent pas tirer la langue.', 'Crocodiles can’t stick out their tongue.', true),
  VF('Le Coca était vert au début.', 'Coca-Cola was originally green.', false),
  VF('Les papillons goûtent avec leurs pieds.', 'Butterflies taste with their feet.', true),
];
