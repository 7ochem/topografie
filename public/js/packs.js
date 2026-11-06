// Lesson packs: the names list of each worksheet. The map data of a pack is loaded only when it is opened.
// Lespakket: exact the names list of the worksheet "NOORD- & MIDDEN-AMERIKA".
// kind decides how the item is drawn and hit-tested; label = where its name goes on the map.
const PACK_NA = {
  id: 'noord-midden-amerika',
  series: 'De Wereld',
  chapter: '3',
  // Wat is dit?: zoom in a little on the asked item (times the whole-map view); a busy map
  quizZoom: 2,
  title: 'Noord- & Midden-Amerika',
  cats: [
    { id: 'land', plural: 'Landen', single: 'Land' },
    { id: 'staat', plural: 'Staten', single: 'Staat' },
    { id: 'water', plural: 'Wateren', single: 'Water' },
    { id: 'plaats', plural: 'Plaatsen', single: 'Plaats' },
    { id: 'gebied', plural: 'Gebieden', single: 'Gebied' },
  ],
  items: [
    { id: 'canada', name: 'Canada', cat: 'land', kind: 'country' },
    { id: 'cuba', name: 'Cuba', cat: 'land', kind: 'country' },
    { id: 'groenland', name: 'Groenland', cat: 'land', kind: 'country', aliases: ['Greenland'] },
    { id: 'guatemala', name: 'Guatemala', cat: 'land', kind: 'country' },
    { id: 'haiti', name: 'Haïti', cat: 'land', kind: 'country' },
    { id: 'mexico', name: 'Mexico', cat: 'land', kind: 'country' },
    { id: 'nicaragua', name: 'Nicaragua', cat: 'land', kind: 'country' },
    { id: 'vs', name: 'Verenigde Staten', cat: 'land', kind: 'country', aliases: ['VS', 'Verenigde Staten van Amerika', 'USA', 'Amerika'] },

    { id: 'alaska', name: 'Alaska', cat: 'staat', kind: 'state' },
    { id: 'florida', name: 'Florida', cat: 'staat', kind: 'state' },
    { id: 'texas', name: 'Texas', cat: 'staat', kind: 'state' },

    { id: 'atlantisch', name: 'Atlantische Oceaan', cat: 'water', kind: 'sea' },
    { id: 'caribisch', name: 'Caribische Zee', cat: 'water', kind: 'sea' },
    { id: 'grote', name: 'Grote Oceaan', cat: 'water', kind: 'sea', aliases: ['Stille Oceaan', 'Stille Zuidzee', 'Pacifische Oceaan'] },
    { id: 'mississippi', name: 'Mississippi', cat: 'water', kind: 'river' },
    { id: 'panamakanaal', name: 'Panamakanaal', cat: 'water', kind: 'canal' },
    { id: 'riogrande', name: 'Rio Grande', cat: 'water', kind: 'river' },

    { id: 'chicago', name: 'Chicago', cat: 'plaats', kind: 'city', lp: 'l' },
    { id: 'denver', name: 'Denver', cat: 'plaats', kind: 'city', lp: 'r' },
    { id: 'detroit', name: 'Detroit', cat: 'plaats', kind: 'city', lp: 'b' },
    { id: 'havana', name: 'Havana', cat: 'plaats', kind: 'city', lp: 't', aliases: ['Havanna', 'La Habana'] },
    { id: 'houston', name: 'Houston', cat: 'plaats', kind: 'city', lp: 'l' },
    { id: 'losangeles', name: 'Los Angeles', cat: 'plaats', kind: 'city', lp: 'l' },
    { id: 'mexicostad', name: 'Mexico-Stad', cat: 'plaats', kind: 'city', lp: 'r', aliases: ['Mexico City', 'Ciudad de Mexico'] },
    { id: 'miami', name: 'Miami', cat: 'plaats', kind: 'city', lp: 'r' },
    { id: 'monterrey', name: 'Monterrey', cat: 'plaats', kind: 'city', lp: 'r' },
    { id: 'montreal', name: 'Montréal', cat: 'plaats', kind: 'city', lp: 'r' },
    { id: 'neworleans', name: 'New Orleans', cat: 'plaats', kind: 'city', lp: 'b' },
    { id: 'newyork', name: 'New York', cat: 'plaats', kind: 'city', lp: 'r' },
    { id: 'ottawa', name: 'Ottawa', cat: 'plaats', kind: 'city', lp: 't' },
    { id: 'sanfrancisco', name: 'San Francisco', cat: 'plaats', kind: 'city', lp: 'l' },
    { id: 'toronto', name: 'Toronto', cat: 'plaats', kind: 'city', lp: 'l' },
    { id: 'vancouver', name: 'Vancouver', cat: 'plaats', kind: 'city', lp: 'l' },
    { id: 'washington', name: 'Washington', cat: 'plaats', kind: 'city', lp: 'r', aliases: ['Washington DC', 'Washington D.C.'] },

    { id: 'appalachen', name: 'Appalachen', cat: 'gebied', kind: 'mtn', carets: 'app', aliases: ['Appalachian Mountains', 'Appalachians'] },
    { id: 'rocky', name: 'Rocky Mountains', cat: 'gebied', kind: 'mtn', carets: 'rocky', aliases: ['Rockies'] },
    { id: 'sierra', name: 'Sierra Nevada', cat: 'gebied', kind: 'mtn', carets: 'sierra' },
  ],
};

// Lespakket: exact the names list of the worksheet "ZEELAND" (Topografie Nederland, 2).
const PACK_ZL = {
  id: 'zeeland',
  series: 'Nederland',
  chapter: '2',
  title: 'Zeeland',
  cats: [
    { id: 'provincie', plural: 'Provincies', single: 'Provincie' },
    { id: 'land', plural: 'Landen', single: 'Land' },
    { id: 'gebied', plural: 'Gebieden', single: 'Gebied' },
    { id: 'plaats', plural: 'Plaatsen', single: 'Plaats' },
    { id: 'water', plural: 'Wateren', single: 'Water' },
  ],
  items: [
    { id: 'noordbrabant', name: 'Noord-Brabant', cat: 'provincie', kind: 'country', aliases: ['Brabant'] },
    { id: 'zeeland', name: 'Zeeland', cat: 'provincie', kind: 'country' },
    { id: 'zuidholland', name: 'Zuid-Holland', cat: 'provincie', kind: 'country' },

    { id: 'belgie', name: 'België', cat: 'land', kind: 'country', aliases: ['Belgium'] },

    { id: 'walcheren', name: 'Walcheren', cat: 'gebied', kind: 'state' },
    { id: 'zeeuwsvlaanderen', name: 'Zeeuws-Vlaanderen', cat: 'gebied', kind: 'state' },
    { id: 'zuidbeveland', name: 'Zuid-Beveland', cat: 'gebied', kind: 'state' },

    { id: 'breskens', name: 'Breskens', cat: 'plaats', kind: 'city', lp: 'l' },
    { id: 'domburg', name: 'Domburg', cat: 'plaats', kind: 'city', lp: 'r' },
    { id: 'goes', name: 'Goes', cat: 'plaats', kind: 'city', lp: 'r' },
    { id: 'hulst', name: 'Hulst', cat: 'plaats', kind: 'city', lp: 'r' },
    { id: 'middelburg', name: 'Middelburg', cat: 'plaats', kind: 'city', lp: 'r' },
    { id: 'terneuzen', name: 'Terneuzen', cat: 'plaats', kind: 'city', lp: 'r' },
    { id: 'veere', name: 'Veere', cat: 'plaats', kind: 'city', lp: 'r' },
    { id: 'vlissingen', name: 'Vlissingen', cat: 'plaats', kind: 'city', lp: 'l' },
    { id: 'yerseke', name: 'Yerseke', cat: 'plaats', kind: 'city', lp: 'r' },
    { id: 'zierikzee', name: 'Zierikzee', cat: 'plaats', kind: 'city', lp: 'r' },

    { id: 'grevelingen', name: 'Grevelingen', cat: 'water', kind: 'sea', aliases: ['Grevelingenmeer'] },
    { id: 'noordzee', name: 'Noordzee', cat: 'water', kind: 'sea', aliases: ['North Sea'] },
    { id: 'oosterschelde', name: 'Oosterschelde', cat: 'water', kind: 'sea' },
    { id: 'westerschelde', name: 'Westerschelde', cat: 'water', kind: 'sea' },
  ],
};

// Lespakket: exact the names list of the worksheet "MIDDEN-OOSTEN" (Topografie De Wereld, 4).
const PACK_MO = {
  id: 'midden-oosten',
  series: 'De Wereld',
  chapter: '4',
  // Wat is dit?: zoom in a little on the asked item (times the whole-map view); small countries close together
  quizZoom: 2,
  title: 'Midden-Oosten',
  cats: [
    { id: 'land', plural: 'Landen', single: 'Land' },
    { id: 'plaats', plural: 'Plaatsen', single: 'Plaats' },
    { id: 'water', plural: 'Wateren', single: 'Water' },
  ],
  items: [
    { id: 'armenie', name: 'Armenië', cat: 'land', kind: 'country' },
    { id: 'azerbeidzjan', name: 'Azerbeidzjan', cat: 'land', kind: 'country', aliases: ['Azerbaidzjan', 'Azerbaijan'] },
    { id: 'georgie', name: 'Georgië', cat: 'land', kind: 'country' },
    { id: 'irak', name: 'Irak', cat: 'land', kind: 'country', aliases: ['Iraq'] },
    { id: 'iran', name: 'Iran', cat: 'land', kind: 'country' },
    { id: 'israel', name: 'Israël', cat: 'land', kind: 'country' },
    { id: 'jemen', name: 'Jemen', cat: 'land', kind: 'country', aliases: ['Yemen'] },
    { id: 'jordanie', name: 'Jordanië', cat: 'land', kind: 'country' },
    { id: 'koeweit', name: 'Koeweit', cat: 'land', kind: 'country', aliases: ['Kuwait'] },
    { id: 'libanon', name: 'Libanon', cat: 'land', kind: 'country' },
    { id: 'saudiarabie', name: 'Saudi-Arabië', cat: 'land', kind: 'country', aliases: ['Saoedi-Arabië'] },
    { id: 'syrie', name: 'Syrië', cat: 'land', kind: 'country' },
    { id: 'turkije', name: 'Turkije', cat: 'land', kind: 'country' },

    { id: 'ankara', name: 'Ankara', cat: 'plaats', kind: 'city', lp: 'r' },
    { id: 'bagdad', name: 'Bagdad', cat: 'plaats', kind: 'city', lp: 'r', aliases: ['Baghdad'] },
    { id: 'damaskus', name: 'Damaskus', cat: 'plaats', kind: 'city', lp: 'r', aliases: ['Damascus'] },
    { id: 'jeruzalem', name: 'Jeruzalem', cat: 'plaats', kind: 'city', lp: 'l', aliases: ['Jerusalem'] },
    { id: 'mekka', name: 'Mekka', cat: 'plaats', kind: 'city', lp: 'r', aliases: ['Mecca'] },
    { id: 'teheran', name: 'Teheran', cat: 'plaats', kind: 'city', lp: 'r', aliases: ['Tehran'] },

    { id: 'eufraat', name: 'Eufraat', cat: 'water', kind: 'river', aliases: ['Euphraat', 'Euphrates'] },
    { id: 'indischeoceaan', name: 'Indische Oceaan', cat: 'water', kind: 'sea' },
    { id: 'kaspischezee', name: 'Kaspische Zee', cat: 'water', kind: 'sea' },
    { id: 'middellandsezee', name: 'Middellandse Zee', cat: 'water', kind: 'sea' },
    // alsoExact: another spelling that is just as right, also with spelling 'streng' (the official spelling has a capital G)
    { id: 'perzischegolf', name: 'Perzische golf', cat: 'water', kind: 'sea', alsoExact: ['Perzische Golf'], aliases: ['Arabische Golf'] },
    { id: 'rodezee', name: 'Rode Zee', cat: 'water', kind: 'sea' },
    { id: 'suezkanaal', name: 'Suezkanaal', cat: 'water', kind: 'canal', aliases: ['Suez-kanaal', 'Kanaal van Suez'] },
    { id: 'zwartezee', name: 'Zwarte Zee', cat: 'water', kind: 'sea' },
  ],
};

// Lespakket: exact the names list of the worksheet "GRONINGEN & DRENTHE" (Topografie Nederland, 3).
// Groningen is on the list twice: as a province and as a city.
const PACK_GD = {
  id: 'groningen-drenthe',
  series: 'Nederland',
  chapter: '3',
  title: 'Groningen & Drenthe',
  cats: [
    { id: 'provincie', plural: 'Provincies', single: 'Provincie' },
    { id: 'land', plural: 'Landen', single: 'Land' },
    { id: 'gebied', plural: 'Gebieden', single: 'Gebied' },
    { id: 'plaats', plural: 'Plaatsen', single: 'Plaats' },
    { id: 'water', plural: 'Wateren', single: 'Water' },
  ],
  items: [
    { id: 'drenthe', name: 'Drenthe', cat: 'provincie', kind: 'country' },
    { id: 'fryslan', name: 'Fryslân', cat: 'provincie', kind: 'country', aliases: ['Friesland', 'Fryslan'] },
    { id: 'groningen', name: 'Groningen', cat: 'provincie', kind: 'country' },
    { id: 'overijssel', name: 'Overijssel', cat: 'provincie', kind: 'country' },

    { id: 'duitsland', name: 'Duitsland', cat: 'land', kind: 'country' },

    { id: 'hondsrug', name: 'Hondsrug', cat: 'gebied', kind: 'state' },

    { id: 'appingedam', name: 'Appingedam', cat: 'plaats', kind: 'city', lp: 'l' },
    { id: 'assen', name: 'Assen', cat: 'plaats', kind: 'city', lp: 'r' },
    { id: 'coevorden', name: 'Coevorden', cat: 'plaats', kind: 'city', lp: 'l' },
    { id: 'delfzijl', name: 'Delfzijl', cat: 'plaats', kind: 'city', lp: 'r' },
    { id: 'emmen', name: 'Emmen', cat: 'plaats', kind: 'city', lp: 'l' },
    { id: 'groningenstad', name: 'Groningen', cat: 'plaats', kind: 'city', lp: 'l' },
    { id: 'hoogeveen', name: 'Hoogeveen', cat: 'plaats', kind: 'city', lp: 'r' },
    { id: 'klazienaveen', name: 'Klazienaveen', cat: 'plaats', kind: 'city', lp: 'r' },
    { id: 'meppel', name: 'Meppel', cat: 'plaats', kind: 'city', lp: 'r' },
    { id: 'schoonebeek', name: 'Schoonebeek', cat: 'plaats', kind: 'city', lp: 'b' },
    { id: 'stadskanaal', name: 'Stadskanaal', cat: 'plaats', kind: 'city', lp: 'r' },
    { id: 'terapel', name: 'Ter Apel', cat: 'plaats', kind: 'city', lp: 'r' },
    { id: 'veendam', name: 'Veendam', cat: 'plaats', kind: 'city', lp: 'r' },
    { id: 'westerbork', name: 'Westerbork', cat: 'plaats', kind: 'city', lp: 'r' },
    { id: 'winschoten', name: 'Winschoten', cat: 'plaats', kind: 'city', lp: 'r' },
    { id: 'zuidlaren', name: 'Zuidlaren', cat: 'plaats', kind: 'city', lp: 'r' },

    { id: 'dollard', name: 'Dollard', cat: 'water', kind: 'sea' },
    { id: 'eems', name: 'Eems', cat: 'water', kind: 'sea', aliases: ['Ems'] },
    { id: 'eemskanaal', name: 'Eemskanaal', cat: 'water', kind: 'canal' },
    { id: 'waddenzee', name: 'Waddenzee', cat: 'water', kind: 'sea' },
  ],
};

// All packs, in the order of the start screen (grouped by series).
// map: the map data (loaded when the pack is opened); thumb: the small picture on the start screen.
const PACKS = [
  { pack: PACK_NA, map: 'maps/noord-midden-amerika.json', thumb: 'maps/noord-midden-amerika-thumb.svg' },
  { pack: PACK_MO, map: 'maps/midden-oosten.json', thumb: 'maps/midden-oosten-thumb.svg' },
  { pack: PACK_ZL, map: 'maps/zeeland.json', thumb: 'maps/zeeland-thumb.svg' },
  { pack: PACK_GD, map: 'maps/groningen-drenthe.json', thumb: 'maps/groningen-drenthe-thumb.svg' },
];
