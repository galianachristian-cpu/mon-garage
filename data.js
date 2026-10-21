/* Mon Garage : fiches techniques et plans d'entretien des véhicules.
   Les valeurs marquées « ≈ » sont des valeurs courantes à confirmer dans le carnet d'entretien. */

/* Plans d'entretien : km = intervalle en kilomètres, mois = intervalle en mois (0 = pas de limite) */
const PLAN_CAR = [
  { id:'vidange',  ic:'🛢️', nom:'Vidange huile + filtre à huile', km:15000, mois:12 },
  { id:'fair',     ic:'🌬️', nom:'Filtre à air moteur', km:30000, mois:24 },
  { id:'fhab',     ic:'🍃', nom:'Filtre d’habitacle', km:15000, mois:12 },
  { id:'bougies',  ic:'⚡', nom:'Bougies d’allumage', km:60000, mois:72 },
  { id:'lfrein',   ic:'🧪', nom:'Liquide de frein', km:0, mois:24 },
  { id:'lrefr',    ic:'❄️', nom:'Liquide de refroidissement', km:100000, mois:60 },
  { id:'plaq',     ic:'🛑', nom:'Plaquettes / disques (contrôle)', km:20000, mois:24 },
  { id:'pneus',    ic:'🛞', nom:'Pneus : usure, parallélisme', km:15000, mois:12 },
  { id:'batt',     ic:'🔋', nom:'Batterie (contrôle)', km:0, mois:24 },
  { id:'clim',     ic:'🧊', nom:'Climatisation (recharge / contrôle)', km:0, mois:24 },
  { id:'essuie',   ic:'🌧️', nom:'Balais d’essuie-glace', km:0, mois:12 }
];
const PLAN_MOTO = [
  { id:'vidange',    ic:'🛢️', nom:'Vidange huile + filtre à huile', km:6000, mois:12 },
  { id:'chaine-gr',  ic:'⛓️', nom:'Graissage + tension de chaîne', km:600, mois:1 },
  { id:'chaine-kit', ic:'⚙️', nom:'Kit chaîne (chaîne + pignon + couronne)', km:20000, mois:0 },
  { id:'fair',       ic:'🌬️', nom:'Filtre à air', km:18000, mois:24 },
  { id:'bougies',    ic:'⚡', nom:'Bougies (NGK CR9EK)', km:12000, mois:24 },
  { id:'soupapes',   ic:'🔩', nom:'Jeu aux soupapes', km:42000, mois:0 },
  { id:'lfrein',     ic:'🧪', nom:'Liquide de frein (AV + AR)', km:0, mois:24 },
  { id:'lrefr',      ic:'❄️', nom:'Liquide de refroidissement', km:0, mois:36 },
  { id:'fourche',    ic:'🦾', nom:'Huile de fourche', km:24000, mois:36 },
  { id:'plaq',       ic:'🛑', nom:'Plaquettes de frein (contrôle)', km:6000, mois:12 },
  { id:'pneus',      ic:'🛞', nom:'Pneus (usure, date DOT)', km:6000, mois:12 },
  { id:'batt',       ic:'🔋', nom:'Batterie (charge, hivernage)', km:0, mois:12 }
];
const planWith = (base, over) => base.map(p => Object.assign({}, p, (over || {})[p.id] || {})).concat((over && over._add) || []);

/* Mots-clés reconnus sur une facture → éléments du plan */
const PLAN_KEYWORDS = [
  ['vidange', /vidange|huile moteur|filtre (a|à) huile|oil/i],
  ['fair', /filtre (a|à) air|air filter/i],
  ['fhab', /habitacle|pollen|filtre cabine/i],
  ['bougies', /bougie/i],
  ['lfrein', /liquide de frein|purge.*frein|dot ?4/i],
  ['lrefr', /refroidissement|antigel|coolant/i],
  ['plaq', /plaquette|disque/i],
  ['pneus', /pneu|parall(e|é)lisme|g(e|é)om(e|é)trie|[eé]quilibrage/i],
  ['batt', /batterie/i],
  ['clim', /clim/i],
  ['essuie', /essuie|balai/i],
  ['distrib', /distribution/i],
  ['chaine-kit', /kit cha(i|î)ne|pignon|couronne/i],
  ['chaine-gr', /graiss|lubrif.*cha(i|î)ne/i],
  ['soupapes', /soupape/i],
  ['fourche', /fourche|spi/i],
  ['fess', /filtre (a|à) (essence|carburant)/i],
  ['carbu', /carbu/i],
  ['cacc', /courroie (d.)?(alternateur|accessoire)/i],
  ['rouille', /corrosion|rouille|soubassement/i],
  ['hybf', /batterie hybride|ventilation batterie/i]
];

const MODELS = {
  auris: {
    marque:'Toyota', modele:'Auris', type:'car', color:'#ef4444', def:'auris2-hsd',
    variants: {
      'auris2-133': {
        nom:'Auris II 1.33 Dual VVT-i 99 ch', annees:'2012 – 2018', carb:'SP95-E10', reservoir:50, conso:5.6,
        specs:[
          ['Moteur', [['Moteur','1.33 Dual VVT-i (1NR-FE)'],['Architecture','4 cylindres en ligne, 16 soupapes'],['Cylindrée','1 329 cm³'],['Puissance','99 ch à 6 000 tr/min'],['Couple','128 Nm à 3 800 tr/min'],['Distribution','Chaîne (sans entretien)'],['Boîte','Manuelle 6 rapports'],['Norme','Euro 5 / Euro 6']]],
          ['Performances', [['0 à 100 km/h','≈ 12,6 s'],['Vitesse max.','≈ 175 km/h'],['Conso. mixte','≈ 5,6 L/100 km'],['CO₂','≈ 130 g/km']]],
          ['Capacités', [['Réservoir','50 L'],['Huile moteur','0W-20 / 5W-30 · ≈ 3,4 L avec filtre'],['Carburant','SP95-E10 / SP98']]],
          ['Pneus', [['Dimension','205/55 R16 (ou 195/65 R15)'],['Pression AV / AR','≈ 2,3 / 2,2 bar (voir montant de porte)']]],
          ['Dimensions', [['Longueur','4,28 m'],['Poids','≈ 1 200 kg'],['Coffre','360 L']]]
        ],
        plan: planWith(PLAN_CAR)
      },
      'auris2-hsd': {
        nom:'Auris II Hybride 1.8 HSD 136 ch', annees:'2012 – 2018', carb:'SP95-E10', reservoir:45, conso:4.0,
        specs:[
          ['Moteur', [['Moteur','1.8 VVT-i (2ZR-FXE) + moteur électrique'],['Puissance cumulée','136 ch'],['Thermique','99 ch à 5 200 tr/min · 142 Nm'],['Électrique','82 ch · 207 Nm'],['Distribution','Chaîne (sans entretien)'],['Boîte','Automatique e-CVT'],['Batterie','Ni-MH']]],
          ['Performances', [['0 à 100 km/h','≈ 10,9 s'],['Vitesse max.','180 km/h'],['Conso. mixte','≈ 4,0 L/100 km'],['Vignette Crit’Air','1']]],
          ['Capacités', [['Réservoir','45 L'],['Huile moteur','0W-20 · ≈ 4,2 L avec filtre'],['Carburant','SP95-E10 / SP98']]],
          ['Pneus', [['Dimension','195/65 R15 · 205/55 R16 · 225/45 R17'],['Pression AV / AR','≈ 2,3 / 2,3 bar']]],
          ['Dimensions', [['Longueur','4,28 m'],['Poids','≈ 1 380 kg'],['Coffre','360 L']]]
        ],
        plan: planWith(PLAN_CAR, { _add:[{ id:'hyb', ic:'🔌', nom:'Contrôle système hybride (garage Toyota)', km:15000, mois:12 }, { id:'hybf', ic:'🌀', nom:'Filtre / grille de ventilation de la batterie hybride (sous la banquette arrière)', km:20000, mois:12, info:'Une grille encrassée fait chauffer la batterie et augmente la consommation. Un coup d’aspirateur suffit.' }] })
      },
      'auris1-hsd': {
        nom:'Auris I Hybride 1.8 HSD 136 ch', annees:'2010 – 2012', carb:'SP95-E10', reservoir:45, conso:3.9,
        specs:[
          ['Moteur', [['Moteur','1.8 VVT-i (2ZR-FXE) + moteur électrique'],['Puissance cumulée','136 ch'],['Thermique','99 ch à 5 200 tr/min · 142 Nm'],['Électrique','82 ch · 207 Nm'],['Distribution','Chaîne (sans entretien)'],['Boîte','Automatique e-CVT'],['Batterie','Ni-MH']]],
          ['Performances', [['0 à 100 km/h','≈ 11,4 s'],['Vitesse max.','180 km/h'],['Conso. mixte','≈ 3,9 L/100 km'],['Vignette Crit’Air','1']]],
          ['Capacités', [['Réservoir','≈ 45 L (à vérifier)'],['Huile moteur','0W-20 · ≈ 4,2 L avec filtre'],['Carburant','SP95-E10 / SP98']]],
          ['Pneus', [['Dimension','195/65 R15 · 205/55 R16'],['Pression AV / AR','≈ 2,3 / 2,3 bar (voir montant de porte)']]],
          ['Dimensions', [['Longueur','4,25 m'],['Poids','≈ 1 380 kg']]]
        ],
        plan: planWith(PLAN_CAR, { _add:[{ id:'hyb', ic:'🔌', nom:'Contrôle système hybride (garage Toyota)', km:15000, mois:12 }, { id:'hybf', ic:'🌀', nom:'Filtre / grille de ventilation de la batterie hybride (sous la banquette arrière)', km:20000, mois:12, info:'Une grille encrassée fait chauffer la batterie et augmente la consommation. Un coup d’aspirateur suffit.' }] })
      },
      'auris2-12t': {
        nom:'Auris II 1.2 T 116 ch', annees:'2015 – 2018', carb:'SP95-E10', reservoir:50, conso:5.0,
        specs:[
          ['Moteur', [['Moteur','1.2 Turbo D-4T (8NR-FTS)'],['Cylindrée','1 197 cm³'],['Puissance','116 ch à 5 200 tr/min'],['Couple','185 Nm de 1 500 à 4 000 tr/min'],['Distribution','Chaîne'],['Boîte','Manuelle 6 ou CVT']]],
          ['Performances', [['0 à 100 km/h','≈ 10,1 s'],['Vitesse max.','200 km/h'],['Conso. mixte','≈ 5,0 L/100 km']]],
          ['Capacités', [['Réservoir','50 L'],['Huile moteur','0W-20 · ≈ 4,2 L avec filtre']]],
          ['Pneus', [['Dimension','205/55 R16 · 225/45 R17'],['Pression AV / AR','≈ 2,4 / 2,3 bar']]]
        ],
        plan: planWith(PLAN_CAR)
      },
      'auris1-133': {
        nom:'Auris I 1.33 Dual VVT-i 101 ch', annees:'2009 – 2012', carb:'SP95-E10', reservoir:55, conso:6.0,
        specs:[
          ['Moteur', [['Moteur','1.33 Dual VVT-i (1NR-FE)'],['Puissance','101 ch à 6 000 tr/min'],['Couple','132 Nm à 3 800 tr/min'],['Distribution','Chaîne'],['Boîte','Manuelle 6 rapports']]],
          ['Performances', [['0 à 100 km/h','≈ 13 s'],['Vitesse max.','175 km/h'],['Conso. mixte','≈ 6,0 L/100 km']]],
          ['Capacités', [['Réservoir','55 L'],['Huile moteur','0W-20 / 5W-30 · ≈ 3,4 L avec filtre']]],
          ['Pneus', [['Dimension','195/65 R15 · 205/55 R16'],['Pression AV / AR','≈ 2,3 / 2,2 bar']]]
        ],
        plan: planWith(PLAN_CAR)
      },
      'auris-d4d': {
        nom:'Auris 1.4 D-4D 90 ch (diesel)', annees:'2007 – 2018', carb:'Gazole', reservoir:50, conso:4.2,
        specs:[
          ['Moteur', [['Moteur','1.4 D-4D (1ND-TV) diesel'],['Puissance','90 ch à 3 800 tr/min'],['Couple','205 Nm'],['Distribution','Chaîne'],['Filtre à particules','Oui']]],
          ['Capacités', [['Réservoir','50 L'],['Huile moteur','5W-30 (ACEA C2) · ≈ 3,9 L avec filtre']]],
          ['Pneus', [['Dimension','205/55 R16'],['Pression AV / AR','≈ 2,3 / 2,2 bar']]]
        ],
        plan: planWith(PLAN_CAR, { bougies:{ nom:'Filtre à gazole', ic:'⛽', km:40000, mois:48 } })
      }
    }
  },
  express: {
    marque:'Renault', modele:'Express', type:'van', color:'#facc15', def:'express1-11',
    variants: {
      'express2-tce': {
        nom:'Express Van 1.3 TCe 100 ch', annees:'2021 →', carb:'SP95-E10', reservoir:50, conso:6.8,
        specs:[
          ['Moteur', [['Moteur','1.3 TCe 100 FAP (H5Ht), turbo injection directe'],['Architecture','4 cylindres en ligne'],['Cylindrée','1 333 cm³'],['Puissance','100 ch à 4 500 tr/min'],['Couple','200 Nm à 1 500 tr/min'],['Distribution','Chaîne'],['Boîte','Manuelle 6 rapports'],['Norme','Euro 6d']]],
          ['Performances', [['Conso. mixte WLTP','≈ 6,8 L/100 km (5,8 à 7,9 selon cycle)'],['CO₂','≈ 148 g/km'],['Vitesse max.','≈ 170 km/h']]],
          ['Capacités', [['Réservoir','50 L'],['Huile moteur','5W-30 norme Renault RN17 · ≈ 5 L (à vérifier)'],['Carburant','SP95-E10 / SP98']]],
          ['Utilitaire', [['Volume utile','3,3 à 3,7 m³'],['Charge utile','≈ 650 kg'],['Longueur','4,39 m']]],
          ['Pneus', [['Dimension','205/60 R16'],['Pression AV / AR','≈ 2,4 / 2,6 bar (voir étiquette de porte)']]]
        ],
        plan: planWith(PLAN_CAR, { vidange:{ km:20000, mois:12, info:'Constructeur : jusqu’à 30 000 km / 1 an. 20 000 km conseillé pour un moteur turbo à usage utilitaire.' }, bougies:{ km:60000, mois:48 } })
      },
      'express1-11': {
        nom:'Express (1re génération) 1.1 essence', annees:'1985 – 1998', carb:'SP98', reservoir:43, conso:7.0,
        specs:[
          ['Moteur', [['Moteur','1.1 essence « Cléon-Fonte » (C1E)'],['Architecture','4 cylindres en ligne, culbuteurs, 8 soupapes'],['Cylindrée','1 108 cm³'],['Puissance','≈ 48 ch à 5 250 tr/min'],['Alimentation','Carburateur simple corps'],['Distribution','Chaîne (pas de courroie à changer)'],['Boîte','Manuelle 4 ou 5 rapports']]],
          ['Performances', [['Vitesse max.','≈ 130 km/h'],['Conso. mixte','≈ 7 L/100 km'],['Vignette Crit’Air','Non classé (essence avant 1997) : interdit dans les ZFE strictes, comme Montpellier']]],
          ['Capacités', [['Réservoir','≈ 43 L (à vérifier)'],['Huile moteur','15W-40 ou 10W-40 minérale / semi-synthèse · ≈ 3 L avec filtre (à vérifier)'],['Carburant','SP98 conseillé (moteur ancien, SP95-E10 déconseillé)']]],
          ['Utilitaire', [['Volume utile','≈ 2,6 m³'],['Charge utile','≈ 500 kg'],['Poids à vide','≈ 850 kg']]],
          ['Pneus', [['Dimension','145/80 R13 (à vérifier sur le flanc)'],['Pression AV / AR','≈ 2,0 / 2,3 bar (plus à l’arrière si chargé)']]]
        ],
        plan: [
          { id:'vidange', ic:'🛢️', nom:'Vidange huile + filtre à huile', km:7500, mois:12, info:'Moteur ancien : vidange rapprochée et niveau d’huile à vérifier tous les 1 000 km.' },
          { id:'fair', ic:'🌬️', nom:'Filtre à air', km:15000, mois:24 },
          { id:'fess', ic:'⛽', nom:'Filtre à essence', km:30000, mois:36 },
          { id:'bougies', ic:'⚡', nom:'Bougies + allumeur (tête, rotor)', km:15000, mois:24 },
          { id:'carbu', ic:'🔧', nom:'Réglage carburateur / ralenti', km:15000, mois:24 },
          { id:'cacc', ic:'➰', nom:'Courroie d’alternateur', km:40000, mois:48 },
          { id:'lfrein', ic:'🧪', nom:'Liquide de frein', km:0, mois:24 },
          { id:'lrefr', ic:'❄️', nom:'Liquide de refroidissement', km:40000, mois:24 },
          { id:'plaq', ic:'🛑', nom:'Freins : plaquettes AV, tambours AR', km:15000, mois:12 },
          { id:'pneus', ic:'🛞', nom:'Pneus (usure, âge, pression)', km:10000, mois:12 },
          { id:'rouille', ic:'🧽', nom:'Contrôle corrosion : bas de caisse, plancher, passages de roue', km:0, mois:12, info:'Point faible des véhicules de cet âge et point surveillé au contrôle technique.' },
          { id:'batt', ic:'🔋', nom:'Batterie (contrôle)', km:0, mois:24 },
          { id:'essuie', ic:'🌧️', nom:'Balais d’essuie-glace', km:0, mois:12 }
        ]
      },
      'express1-14': {
        nom:'Express (1re génération) 1.4 essence', annees:'1985 – 1998', carb:'SP95', reservoir:47, conso:7.5,
        specs:[
          ['Moteur', [['Moteur','1.4 essence (C3J / E7J selon année)'],['Cylindrée','1 390 / 1 397 cm³'],['Puissance','≈ 58 à 60 ch'],['Distribution','C3J : chaîne · E7J : courroie'],['Boîte','Manuelle 4 ou 5 rapports']]],
          ['Performances', [['Vitesse max.','≈ 145 km/h'],['Conso. mixte','≈ 7,5 L/100 km']]],
          ['Capacités', [['Réservoir','≈ 47 L'],['Huile moteur','15W-40 / 10W-40 · ≈ 3,5 L avec filtre'],['Carburant','SP95 / SP98 (SP95-E10 déconseillé avant 2000)']]],
          ['Pneus', [['Dimension','145/80 R13 · 155/70 R13'],['Pression AV / AR','≈ 2,0 / 2,4 bar']]]
        ],
        plan: planWith(PLAN_CAR, { vidange:{ km:10000, mois:12 }, bougies:{ km:20000, mois:24 }, fhab:{ km:0, mois:0, nom:'Filtre à essence', ic:'⛽' }, clim:{ km:0, mois:0, nom:'Allumage (vis platinées / rupteur)', ic:'🔧' },
          _add:[{ id:'distrib', ic:'⏱️', nom:'Courroie de distribution (moteur E7J)', km:60000, mois:60 }] })
      }
    }
  },
  z750s: {
    marque:'Kawasaki', modele:'Z750 S', type:'moto', color:'#84cc16', def:'z750s-05',
    variants: {
      'z750s-05': {
        nom:'Z750 S (ZR750K) 110 ch', annees:'2005 – 2006', carb:'SP98', reservoir:18, conso:6.0,
        specs:[
          ['Moteur', [['Moteur','4 cylindres en ligne, refroidissement liquide'],['Distribution','Double arbre à cames, 16 soupapes'],['Cylindrée','748 cm³'],['Alésage × course','68,4 × 50,9 mm'],['Puissance','110 ch (81 kW) à 11 000 tr/min'],['Couple','75 Nm à 8 200 tr/min'],['Alimentation','Injection électronique'],['Boîte','6 rapports'],['Transmission','Chaîne · braquet 15 × 43']]],
          ['Partie cycle', [['Cadre','Tubulaire acier, épine dorsale'],['Fourche','Télescopique Ø 41 mm'],['Frein AV','Double disque Ø 300 mm'],['Frein AR','Simple disque Ø 220 mm'],['Carénage','Tête de fourche (version S)']]],
          ['Réglementation', [['Vignette Crit’Air','3 (moto Euro 2)'],['Contrôle technique','Tous les 3 ans (obligatoire depuis 2024)']]],
          ['Capacités', [['Réservoir','18 L (dont ≈ 3 L de réserve)'],['Huile moteur','10W-40 JASO MA · ≈ 3,8 L avec filtre (à vérifier)'],['Bougies','NGK CR9EK'],['Carburant','SP98 conseillé (SP95-E10 accepté)']]],
          ['Pneus', [['Avant','120/70 ZR17'],['Arrière','180/55 ZR17'],['Pression AV / AR','2,5 / 2,9 bar']]],
          ['Dimensions', [['Poids à sec','≈ 199 kg'],['Hauteur de selle','≈ 815 mm'],['Autonomie','≈ 280 à 300 km']]]
        ],
        plan: planWith(PLAN_MOTO)
      }
    }
  }
};

/* Véhicules créés au premier lancement */
const DEFAULT_VEHICLES = [
  { id:'auris', model:'auris', nom:'Toyota Auris' },
  { id:'express', model:'express', nom:'Renault Express' },
  { id:'z750s', model:'z750s', nom:'Kawasaki Z750 S' }
];

const FUELS = ['SP95-E10', 'SP95', 'SP98', 'E85', 'Gazole', 'GPL'];
const STATIONS = ['TotalEnergies', 'Esso', 'BP', 'Shell', 'Avia', 'Intermarché', 'E.Leclerc', 'Carrefour', 'Auchan', 'Super U', 'Système U', 'Casino', 'Dyneff', 'Agip', 'Elan', 'Netto', 'Lidl'];
