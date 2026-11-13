import { shuffle } from '../../engine/rng';
import { cap, pick, sample, spread, NAMES, type Family } from './util';

type R = () => number;
const P = <T>(rng: R, a: readonly T[]) => pick(rng, a);

// ═════════════════════════════════════════════════════════════════════════
// FALLACIES: many templates × many topics. Every template unmistakably
// commits one fallacy, described by a single sentence (the answer).
// ═════════════════════════════════════════════════════════════════════════
const TOPICS = ['el reciclaje', 'la dieta', 'el horario de la biblioteca', 'el presupuesto de la fiesta', 'las normas del edificio', 'el plan de viaje', 'el menú del comedor', 'el torneo del barrio', 'la limpieza del parque', 'el uso del móvil en clase'];
const INSULTS = ['siempre llega tarde', 'viste fatal', 'no sabe ni freír un huevo', 'tiene el coche hecho un desastre', 'suspendió dibujo en el colegio', 'habla demasiado alto', 'no ha leído un libro en su vida', 'se equivoca de autobús cada dos por tres'];
const ADJ_BAD = ['desordenado', 'antipático', 'despistado', 'presumido', 'pesado', 'cotilla'];
const STRAW: [string, string][] = [
  ['comer menos dulces en el comedor', 'prohibir las tartas de cumpleaños'],
  ['usar un poco menos el coche', 'que vayamos andando a todas partes'],
  ['revisar el horario de la biblioteca', 'cerrarla para siempre'],
  ['dejar el móvil durante la cena', 'que vivamos como en la Edad de Piedra'],
  ['ahorrar un poco cada mes', 'no gastar nunca nada en nada'],
  ['poner menos deberes los fines de semana', 'que los niños no aprendan nada'],
  ['dar algo más de tiempo en los exámenes', 'regalar los aprobados'],
  ['bajar un poco el volumen de la música', 'que la fiesta sea un funeral'],
  ['entrenar dos días por semana en vez de tres', 'que el equipo deje de jugar'],
  ['pintar la sala de otro color', 'tirar el edificio entero'],
];
const SLOPE: string[][] = [
  ['dejamos que los alumnos usen el móvil en el recreo', 'luego lo usarán en clase', 'después en los exámenes', 'al final nadie aprenderá nada'],
  ['te dejo quedarte cinco minutos más despierto', 'mañana querrás una hora', 'luego toda la noche', 'acabarás suspendiendo todo'],
  ['permitimos un perro en el edificio', 'pronto habrá diez', 'después vendrán caballos', 'esto acabará siendo un zoo'],
  ['hoy te saltas el gimnasio', 'mañana te lo saltarás otra vez', 'luego lo dejarás del todo', 'acabarás sin poder subir una escalera'],
  ['bajamos el precio de la entrada un euro', 'luego pedirán que sea gratis', 'después que les paguemos', 'el club acabará arruinado'],
  ['dejamos que un vecino aparque en la acera', 'todos aparcarán en la acera', 'nadie podrá caminar', 'la calle se convertirá en un aparcamiento'],
  ['empiezas a comer palomitas viendo la tele', 'comerás palomitas a todas horas', 'dejarás de comer verdura', 'tu salud se arruinará'],
];
const DILEMMA: [string, string][] = [
  ['sacas un diez en todo', 'eres un desastre'],
  ['te encanta el fútbol', 'odias el deporte'],
  ['compras el modelo más caro', 'tendrás uno que se rompe mañana'],
  ['vienes a mi fiesta', 'ya no eres mi amigo'],
  ['estás conmigo', 'estás contra mí'],
  ['trabajas los fines de semana', 'no te importa tu futuro'],
  ['te gusta la ciudad', 'odias el campo'],
  ['madrugas cada día', 'eres un vago'],
];
const SUPERSTITION: [string, string, string][] = [
  ['se puso la gorra azul', 'ganó el partido', 'la gorra azul da suerte'],
  ['cambió de bolígrafo', 'aprobó el examen', 'ese bolígrafo hace aprobar'],
  ['regó las plantas por la noche', 'al día siguiente llovió', 'regar de noche atrae la lluvia'],
  ['se comió un plátano antes de salir', 'no hubo atasco', 'el plátano evita los atascos'],
  ['saludó a un gato negro', 'perdió las llaves', 'los gatos negros dan mala suerte'],
  ['empezó a usar una pulsera nueva', 'se le pasó el resfriado', 'la pulsera cura los resfriados'],
  ['pidió pizza el lunes', 'su equipo ganó el martes', 'pedir pizza ayuda a su equipo'],
];
const BRANDS = ['esa marca', 'ese supermercado', 'esa tienda', 'esa aplicación', 'esa cadena de restaurantes'];
const HASTY: [string, string][] = [
  ['un yogur', 'estaba caducado'], ['un bocadillo', 'estaba seco'], ['un cargador', 'no funcionaba'], ['una camiseta', 'encogió al lavarla'], ['un café', 'estaba frío'],
];
const PEOPLE_PLACE: [string, string][] = [['turistas', 'ese país'], ['vecinos', 'ese barrio'], ['alumnos', 'ese colegio'], ['conductores', 'esa ciudad'], ['camareros', 'esa playa']];
const TRAITS = ['maleducados', 'despistados', 'antipáticos', 'tacaños', 'impuntuales'];
const POPULAR: [string, string][] = [
  ['Esta serie', 'la ve todo el mundo'], ['Ese restaurante', 'siempre tiene cola'], ['Esa dieta', 'la hace media oficina'], ['Este juego', 'lo tienen todos mis amigos'],
  ['Esa canción', 'tiene millones de reproducciones'], ['Este champú', 'es el más vendido'], ['Ese libro', 'está en todas las mochilas'],
];
const FAMOUS = ['Un futbolista famoso', 'Una cantante muy conocida', 'Un actor de moda', 'Una influencer con millones de seguidores', 'Un presentador de la tele'];
const OFF_FIELD = ['esta pulsera magnética cura el dolor de espalda', 'este zumo previene la gripe', 'conviene invertir todos tus ahorros en esa moneda digital', 'este colchón te hace más inteligente', 'esta crema rejuvenece diez años en una semana'];
const CIRC: [string, string][] = [
  ['Este restaurante es el mejor de la ciudad', 'no hay ninguno mejor que él'],
  ['Lucía es de fiar', 'es una persona en la que se puede confiar'],
  ['Esta norma es justa', 'es lo correcto'],
  ['Ese libro es interesante', 'despierta mucho interés'],
  ['Tengo razón', 'lo que digo es cierto'],
  ['Este método funciona', 'da resultado'],
];
const ADVICE: [string, string][] = [
  ['coma más verdura', 'la comes'], ['fume menos', 'lo has dejado'], ['ordene mi cuarto', 'ordenas el tuyo'], ['haga deporte', 'lo haces'], ['ahorre', 'ahorras'], ['me acueste antes', 'te acuestas pronto'],
];
const UNPROVEN = ['hay dragones en algún planeta lejano', 'existe una ciudad secreta bajo el mar', 'hay un tesoro enterrado en el parque', 'los calcetines desaparecidos viajan a otra dimensión', 'mi gato entiende el chino'];
const STREAKS: [string, string, string][] = [
  ['Ha salido cara', 'veces seguidas', 'cruz'], ['Ha salido rojo en la ruleta', 'veces seguidas', 'negro'], ['El dado no ha sacado un seis en', 'tiradas', 'un seis'], ['Han nacido niñas en el hospital', 'veces seguidas', 'un niño'],
];
const NATURAL = ['Esta infusión es natural', 'Este remedio es cien por cien natural', 'Esa seta es natural', 'Este veneno de planta es natural'];
const PARTS: [string, string, string, string][] = [
  ['pieza del mueble', 'ligera', 'el mueble entero', 'ligero'],
  ['jugador del equipo', 'excelente', 'el equipo', 'excelente'],
  ['ingrediente', 'delicioso', 'el plato', 'delicioso'],
  ['ladrillo', 'pequeño', 'la casa', 'pequeña'],
  ['músico de la orquesta', 'bueno', 'el concierto', 'bueno'],
  ['frase del libro', 'corta', 'el libro', 'corto'],
];
const WHOLES: [string, string, string, string][] = [
  ['La orquesta es enorme', 'cada músico es enorme'],
  ['El equipo es el mejor de la liga', 'cada jugador es el mejor de la liga'],
  ['El hormiguero es gigantesco', 'cada hormiga es gigantesca'],
  ['La biblioteca es muy antigua', 'cada libro es muy antiguo'],
].map(([a, b]) => [a, b, '', ''] as [string, string, string, string]);
const ANEC: [string, string, string][] = [
  ['abuelo', 'fumó', 'fumar no es tan malo'], ['tía', 'no se puso nunca el cinturón', 'el cinturón no sirve para nada'], ['vecino', 'comió fritos a diario', 'los fritos no hacen daño'], ['primo', 'nunca estudió', 'estudiar no sirve de nada'],
];
const CORR: [string, string, string][] = [
  ['se venden más helados', 'hay más ahogamientos', 'el calor del verano'], ['hay más bomberos en un incendio', 'hay más daños', 'el tamaño del incendio'],
  ['los niños tienen el pie más grande', 'leen mejor', 'la edad'], ['se venden más paraguas', 'hay más accidentes de tráfico', 'la lluvia'],
  ['se usa más la calefacción', 'hay más resfriados', 'el invierno'], ['hay más cigüeñas', 'nacen más niños', 'que son zonas rurales con más familias'],
];
const FEAR: [string, string][] = [
  ['compras esta alarma', 'no podrás dormir tranquilo nunca más'], ['contratas este seguro', 'tu familia quedará desprotegida para siempre'], ['usas esta crema', 'envejecerás antes que todos tus amigos'], ['firmas hoy mismo', 'te arrepentirás el resto de tu vida'],
];
const SUNK: [string, string, string][] = [
  ['pagado la entrada', 'me quedo hasta el final', 'la película me aburre muchísimo'], ['comprado el menú entero', 'me lo como todo', 'ya estoy lleno'],
  ['invertido dos años en este proyecto', 'sigo con él', 'está claro que no funciona'], ['pagado la matrícula', 'voy a todas las clases', 'he descubierto que no me gusta nada'],
  ['hecho media cola', 'me quedo', 'en la tienda de enfrente no hay nadie'],
];
const ANALOGY: [string, string, string][] = [
  ['Un empleado es como un clavo', 'a los clavos se les martillea', 'a los empleados hay que tratarlos con dureza'],
  ['Un país es como una familia', 'en una familia manda el padre', 'en un país debe mandar una sola persona'],
  ['El cerebro es como un músculo', 'los músculos crecen si se usan', 'pensar mucho hará que te crezca la cabeza'],
  ['Las personas son como los coches', 'a los coches se les cambian las piezas', 'a las personas se les puede cambiar el carácter igual de fácil'],
];
const TRADITION: [string, string][] = [
  ['Siempre se ha hecho así en esta empresa', 'es la mejor manera'], ['Mis abuelos ya lo hacían', 'tiene que estar bien'], ['En este pueblo nunca ha habido biblioteca', 'no hace falta ninguna'], ['El examen siempre ha sido oral', 'no se puede hacer de otra forma'],
];
const NOVELTY: [string, string][] = [['Es el móvil que acaba de salir', 'tiene que ser mejor que el anterior'], ['Es un método nuevo', 'seguro que funciona mejor'], ['Es la última versión de la app', 'no puede tener fallos'], ['Esta dieta es la más reciente', 'es la más sana']];
const SCOTS: [string, string, string][] = [
  ['persona de Madrid', 'odia el calor', 'ha vivido siempre en Madrid'],
  ['persona futbolera', 'se pierde un partido', 'tiene abono del equipo desde hace veinte años'],
  ['persona amante del café', 'lo toma con azúcar', 'toma tres cafés al día'],
  ['persona lectora', 'abandona un libro a medias', 'lee un libro por semana'],
  ['persona deportista', 'se salta un entrenamiento', 'corre diez kilómetros cada mañana'],
];

interface Fallacy {
  id: string;
  desc: string;
  make: (rng: R) => string;
}
const FALLACIES: Fallacy[] = [
  { id: 'adh', desc: 'Ataca a la persona en vez de a su argumento', make: (r) => P(r, [
    () => `«No hagas caso a ${P(r, NAMES)} sobre ${P(r, TOPICS)}: ${P(r, INSULTS)}.»`,
    () => { const n = P(r, NAMES); return `«¿Que ${n} propone cambiar ${P(r, TOPICS)}? Viniendo de alguien tan ${P(r, ADJ_BAD)}, seguro que es una mala idea.»`; },
    () => `«La propuesta de ${P(r, NAMES)} sobre ${P(r, TOPICS)} no vale nada: ¿has visto cómo ${P(r, ['habla', 'se viste', 'conduce', 'escribe'])}?»`,
  ])() },
  { id: 'paja', desc: 'Deforma la idea del otro para rebatirla más fácilmente', make: (r) => { const [a, b] = P(r, STRAW); return P(r, [
    () => `—Creo que deberíamos ${a}. —¿O sea que quieres ${b}?`,
    () => `«${P(r, NAMES)} dice que hay que ${a}. ¡Lo que quiere en realidad es ${b}!»`,
  ])(); } },
  { id: 'pend', desc: 'Supone sin pruebas una cadena de consecuencias cada vez peores', make: (r) => { const [a, b, c, d] = P(r, SLOPE); return `«Si ${a}, ${b}, ${c} y ${d}.»`; } },
  { id: 'dil', desc: 'Presenta solo dos opciones cuando hay más', make: (r) => { const [a, b] = P(r, DILEMMA); return P(r, [() => `«O ${a}, o ${b}. No hay más.»`, () => `«Si no ${a}, es que ${b}.»`])(); } },
  { id: 'post', desc: 'Confunde «pasó después» con «pasó por eso»', make: (r) => { const [a, b, c] = P(r, SUPERSTITION); return `«${P(r, NAMES)} ${a} y ${b}. Está claro: ${c}.»`; } },
  { id: 'gen', desc: 'Saca una conclusión general a partir de muy pocos casos', make: (r) => P(r, [
    () => { const [t, bad] = P(r, HASTY); return `«Compré ${t} en ${P(r, BRANDS)} y ${bad}. Todo lo que venden allí es malo.»`; },
    () => { const [p, pl] = P(r, PEOPLE_PLACE); return `«Los dos ${p} de ${pl} que conozco son ${P(r, TRAITS)}. Allí todos son así.»`; },
  ])() },
  { id: 'may', desc: 'Da algo por cierto solo porque mucha gente lo cree o lo hace', make: (r) => { const [a, b] = P(r, POPULAR); return `«${a} tiene que ser buen${a.startsWith('Esa') || a.startsWith('Esta') ? 'a' : 'o'}: ${b}.»`; } },
  { id: 'aut', desc: 'Se apoya en alguien que no es experto en el tema', make: (r) => `«${P(r, FAMOUS)} dice que ${P(r, OFF_FIELD)}, así que debe de ser verdad.»` },
  { id: 'circ', desc: 'Da por supuesto justo lo que quiere demostrar', make: (r) => { const [a, b] = P(r, CIRC); return `«${a}, porque ${b}.»`; } },
  { id: 'tu', desc: 'Rechaza un consejo señalando que el otro tampoco lo cumple', make: (r) => { const [a, b] = P(r, ADVICE); return `«¿Me dices que ${a}? ¡Si tú tampoco ${b}!»`; } },
  { id: 'ign', desc: 'Toma la falta de pruebas como si fuera una prueba', make: (r) => { const x = P(r, UNPROVEN); return P(r, [() => `«Nadie ha demostrado que no sea verdad que ${x}, así que es verdad.»`, () => `«Como nadie ha probado todavía que ${x}, seguro que es mentira.»`])(); } },
  { id: 'jug', desc: 'Cree que el azar «compensa» los resultados anteriores', make: (r) => { const [a, b, c] = P(r, STREAKS); const n = P(r, ['cinco', 'seis', 'ocho', 'diez']); return `«${a} ${n} ${b}, así que ahora es casi seguro que toca ${c}.»`; } },
  { id: 'nat', desc: 'Supone que todo lo natural es bueno', make: (r) => `«${P(r, NATURAL)}, así que no puede hacerte ningún daño.»` },
  { id: 'comp', desc: 'Supone que lo que vale para cada parte vale para el conjunto', make: (r) => { const [a, b, c, d] = P(r, PARTS); return `«Cada ${a} es ${b}, así que ${c} será ${d}.»`; } },
  { id: 'div', desc: 'Supone que lo que vale para el conjunto vale para cada parte', make: (r) => { const [a, b] = P(r, WHOLES); return `«${a}, así que ${b}.»`; } },
  { id: 'anec', desc: 'Usa un caso aislado contra datos generales', make: (r) => { const [a, b, c] = P(r, ANEC); return `«Mi ${a} ${b} toda la vida y está estupendo, así que ${c}.»`; } },
  { id: 'corr', desc: 'Cree que si dos cosas suben a la vez, una causa la otra', make: (r) => { const [a, b] = P(r, CORR); return `«Cuando ${a}, ${b}. Así que lo primero provoca lo segundo.»`; } },
  { id: 'emo', desc: 'Intenta convencer con miedo en vez de con razones', make: (r) => { const [a, b] = P(r, FEAR); return `«Si no ${a}, ${b}.»`; } },
  { id: 'hund', desc: 'Sigue con algo solo por lo que ya ha invertido', make: (r) => { const [a, b, c] = P(r, SUNK); return `«Ya he ${a}, así que ${b} aunque ${c}.»`; } },
  { id: 'anal', desc: 'Compara dos cosas que se parecen en algo, pero no en lo importante', make: (r) => { const [a, b, c] = P(r, ANALOGY); return `«${a}: ${b}, así que ${c}.»`; } },
  { id: 'trad', desc: 'Da algo por bueno solo porque siempre se ha hecho así', make: (r) => { const [a, b] = P(r, TRADITION); return `«${a}, así que ${b}.»`; } },
  { id: 'nov', desc: 'Da algo por mejor solo porque es nuevo', make: (r) => { const [a, b] = P(r, NOVELTY); return `«${a}, así que ${b}.»`; } },
  { id: 'esc', desc: 'Cambia la definición para no aceptar un contraejemplo', make: (r) => { const [g, d, proof] = P(r, SCOTS); const n = P(r, NAMES); return `—Ninguna ${g} de verdad ${d}. —Pues ${n} ${proof} y ${d}. —Entonces no es una ${g} de verdad.`; } },
];

const fallacyId: Family = {
  id: 'fal',
  uniquePrompt: true,
  counts: () => spread(4, 5, 5, 5, 4, 3),
  make: ({ D, rng }) => {
    const pool = D <= 3 ? FALLACIES.filter((f) => ['adh', 'paja', 'dil', 'post', 'gen', 'may', 'aut', 'tu', 'nat', 'emo'].includes(f.id)) : FALLACIES;
    const f = pick(rng, pool);
    const others = sample(rng, FALLACIES.filter((x) => x !== f), 3).map((x) => x.desc);
    return { cat: 'filosofia', prompt: `${f.make(rng)} ¿Qué error de razonamiento comete?`, correct: f.desc, wrong: others, expl: `${f.desc}: por eso el argumento no se sostiene.` };
  },
};

const fallacyFind: Family = {
  id: 'fax',
  counts: () => spread(1, 1, 2, 2, 1, 1),
  make: ({ rng }) => {
    const [f, ...o] = sample(rng, FALLACIES, 4);
    const lower = f.desc.charAt(0).toLowerCase() + f.desc.slice(1);
    return {
      cat: 'filosofia',
      prompt: `¿En qué argumento se comete este error de razonamiento: ${lower}?`,
      correct: f.make(rng),
      wrong: o.map((x) => x.make(rng)),
      expl: `Ese argumento ${lower}. Los demás cometen otros errores.`,
    };
  },
};

// ═════════════════════════════════════════════════════════════════════════
// PHILOSOPHY
// ═════════════════════════════════════════════════════════════════════════
const ACTS = [
  ['devolver una cartera que se ha encontrado', 'devuelve'],
  ['decirle la verdad a un amigo aunque le duela', 'se la dice'],
  ['donar parte de su sueldo', 'lo hace'],
  ['no copiar en el examen', 'no copia'],
  ['cumplir una promesa que le cuesta', 'la cumple'],
  ['ayudar a un desconocido con la compra', 'le ayuda'],
  ['repartir el premio con su equipo', 'lo reparte'],
  ['avisar del error en la cuenta del restaurante', 'avisa'],
  ['visitar a su abuela aunque tenga mucho sueño', 'la visita'],
  ['reconocer que se equivocó', 'lo reconoce'],
] as const;
const THEORIES = [
  { name: 'Consecuencialismo: juzga por los resultados', why: ['porque así habrá más bienestar en total', 'porque es lo que produce mejores consecuencias para todos', 'porque así se causa menos sufrimiento'] },
  { name: 'Deontología: hay deberes que se cumplen siempre', why: ['porque es su deber, salgan como salgan las cosas', 'porque hay normas que no se rompen nunca, pase lo que pase', 'porque está mal hacerlo de otra forma, aunque nadie se entere'] },
  { name: 'Ética de la virtud: actuar como una buena persona', why: ['porque eso es lo que haría una persona honesta', 'porque quiere ser alguien generoso y valiente', 'porque así se forma un buen carácter'] },
  { name: 'Contractualismo: reglas que todos aceptarían', why: ['porque es una regla que todos aceptaríamos si la pactáramos juntos', 'porque nadie podría rechazar razonablemente esa norma', 'porque es lo que acordaría cualquiera sin saber qué papel le tocará'] },
];
const ethics: Family = {
  id: 'eti',
  uniquePrompt: true,
  counts: () => spread(2, 3, 3, 3, 2, 1),
  make: ({ rng }) => {
    const [act, verb] = pick(rng, ACTS);
    const th = pick(rng, THEORIES);
    const n = pick(rng, NAMES);
    return {
      cat: 'filosofia',
      prompt: `${n} duda si ${act}. Al final ${verb}, ${pick(rng, th.why)}. ¿Con qué forma de pensar en ética encaja mejor su razón?`,
      correct: th.name,
      wrong: THEORIES.filter((t) => t !== th).map((t) => t.name),
      expl: `Lo que decide no es la acción en sí, sino la razón que da: ${th.name.split(':')[1].trim()}.`,
    };
  },
};

const REASONING = [
  { name: 'Deducción: la conclusión se sigue necesariamente', ex: [
    'Todas las llaves de este llavero abren la casa. Esta llave es de este llavero. Así que abre la casa.',
    'Si llueve, el partido se suspende. Está lloviendo. Por tanto, el partido se suspende.',
    'Ningún pájaro de la jaula canta. Pío está en la jaula. Así que Pío no canta.',
    'Todos los números pares son divisibles entre dos. El 48 es par. Luego es divisible entre dos.',
    'Solo los socios entran gratis. Marta no es socia. Así que Marta no entra gratis.',
  ] },
  { name: 'Inducción: generaliza a partir de casos observados', ex: [
    'Los cien cisnes que he visto eran blancos. Así que todos los cisnes deben de ser blancos.',
    'Cada mañana de este mes el autobús ha llegado tarde. Mañana también llegará tarde.',
    'Las veinte manzanas de la caja que he probado están dulces. Las demás también lo estarán.',
    'Todas las veces que he regado esta planta, ha crecido. Regar la hace crecer.',
    'En todos los pueblos que he visitado de esta comarca hay una fuente. Seguro que en todos la hay.',
  ] },
  { name: 'Abducción: elige la explicación más probable', ex: [
    'El suelo de la calle está mojado y hay charcos. Lo más probable es que haya llovido.',
    'La galleta ha desaparecido y el perro tiene migas en el hocico. Seguramente se la ha comido el perro.',
    'El coche no arranca y las luces no se encienden. Probablemente la batería está descargada.',
    'Hay huellas de barro que van de la puerta al sofá. Alguien ha entrado con las botas sucias.',
    'Mi amiga no contesta y su móvil da apagado. Lo más probable es que se haya quedado sin batería.',
  ] },
  { name: 'Analogía: compara con un caso parecido', ex: [
    'Un medicamento funcionó en ratones con esta enfermedad; los humanos se parecen en lo importante, así que quizá funcione en humanos.',
    'Mi método para aprender inglés funcionó; el italiano se aprende de forma parecida, así que también me servirá.',
    'Esta tienda triunfó en una ciudad parecida a la nuestra, así que probablemente triunfe aquí.',
    'El truco para enfriar la sopa sirve para el café, que también es un líquido caliente.',
  ] },
];
const reasoning: Family = {
  id: 'raz',
  uniquePrompt: true,
  counts: () => spread(1, 1, 1, 0, 0, 0),
  make: ({ rng }) => {
    const r = pick(rng, REASONING);
    return { cat: 'filosofia', prompt: `«${pick(rng, r.ex)}» ¿Qué tipo de razonamiento es?`, correct: r.name, wrong: REASONING.filter((x) => x !== r).map((x) => x.name), expl: `${r.name}.` };
  },
};

const COND: [string, string, number][] = [
  // 0 necessary only, 1 sufficient only, 2 both, 3 neither
  ['haber oxígeno', 'que haya fuego', 0], ['saber leer', 'entender un libro de física', 0], ['saber nadar', 'ganar una carrera de natación', 0],
  ['tener cuatro lados', 'ser un cuadrado', 0], ['ser un mamífero', 'ser un perro', 0], ['vivir en España', 'vivir en Sevilla', 0], ['ser mayor que 5', 'ser mayor que 10', 0],
  ['que llueva', 'que el suelo de la calle se moje', 1], ['ser un cuadrado', 'ser un rectángulo', 1], ['tener 100 euros', 'poder pagar algo de 10 euros', 1],
  ['ser un perro', 'ser un mamífero', 1], ['vivir en Sevilla', 'vivir en España', 1], ['sacar un 10', 'aprobar', 1], ['ser mayor que 10', 'ser mayor que 5', 1],
  ['ser un triángulo', 'tener exactamente tres lados', 2], ['ser un número par', 'ser divisible entre dos', 2], ['ser el día después del lunes', 'ser martes', 2],
  ['llevar paraguas', 'que llueva', 3], ['ser alto', 'jugar bien al ajedrez', 3], ['tener un gato', 'vivir en un piso', 3], ['madrugar', 'ser feliz', 3], ['llevar gafas', 'ser inteligente', 3],
];
const COND_OPTS = ['Necesaria, pero no suficiente', 'Suficiente, pero no necesaria', 'Necesaria y suficiente', 'Ni necesaria ni suficiente'];
const COND_EXPL = [
  (a: string, b: string) => `Sin ${a} no puede ocurrir ${b}, pero con eso solo no basta.`,
  (a: string, b: string) => `${cap(a)} basta para ${b}, pero ${b} también puede darse de otras formas.`,
  (a: string, b: string) => `${cap(a)} y ${b} van siempre juntos: uno garantiza el otro.`,
  (a: string, b: string) => `${cap(a)} ni hace falta ni garantiza ${b}.`,
];
const conditions: Family = {
  id: 'nec',
  uniquePrompt: true,
  counts: () => spread(0, 1, 1, 1, 0, 0),
  make: ({ rng }) => {
    const [a, b, k] = pick(rng, COND);
    return { cat: 'filosofia', prompt: `«${cap(a)}» respecto a «${b}», ¿qué tipo de condición es?`, correct: COND_OPTS[k], wrong: COND_OPTS.filter((_, i) => i !== k), expl: COND_EXPL[k](a, b) };
  },
};

const causation: Family = {
  id: 'cau',
  uniquePrompt: true,
  counts: () => spread(0, 1, 1, 0, 0, 0),
  make: ({ rng }) => {
    const [a, b, z] = pick(rng, CORR);
    const where = pick(rng, ['En los datos de varios años', 'En un estudio de muchos pueblos', 'Según las estadísticas de una ciudad']);
    return {
      cat: 'filosofia',
      prompt: `${where}, cuando ${a}, también ${b}. ¿Qué es lo más razonable pensar?`,
      correct: `Que probablemente ambas cosas dependen de algo más: ${z}`,
      wrong: ['Que lo primero causa lo segundo', 'Que lo segundo causa lo primero', 'Que es imposible que estén relacionadas'],
      expl: `Que dos cosas ocurran juntas no prueba que una cause la otra. Aquí las dos suben por ${z}.`,
    };
  },
};

const RAZORS = [
  { name: 'Navaja de Ockham: la explicación más sencilla', ex: [
    'Oyes un golpe en la cocina. Antes de pensar en un fantasma, piensas que se ha caído algo de la encimera.',
    'Tu planta está mustia. En vez de sospechar de una plaga desconocida, piensas que no la has regado.',
    'Las luces parpadean. Antes que pensar en un sabotaje, piensas que es una bombilla gastada.',
  ] },
  { name: 'Navaja de Hanlon: antes torpeza que mala intención', ex: [
    'Tu compañero vuelve a dejar la puerta abierta. Antes de pensar que lo hace para fastidiarte, piensas que es despistado.',
    'El camarero te trae otro plato. En lugar de pensar que te tiene manía, supones que se ha confundido.',
    'Tu vecino no te devuelve el saludo. Antes de creer que está enfadado contigo, piensas que no te ha visto.',
  ] },
  { name: 'Estándar de Sagan: lo extraordinario exige pruebas extraordinarias', ex: [
    'Alguien asegura que su gato habla tres idiomas. Para creerlo, pides algo más que su palabra.',
    'Un vídeo dice que han encontrado una ciudad bajo el hielo. Esperas pruebas muy sólidas antes de creerlo.',
    'Un vendedor promete que su pulsera te hace invencible. Algo así necesitaría pruebas muy fuertes.',
  ] },
  { name: 'Navaja de Hitchens: lo que se afirma sin pruebas se descarta sin pruebas', ex: [
    'Alguien dice que hay un tesoro bajo tu casa, pero no da ninguna prueba. No necesitas demostrar que no lo hay para no creerle.',
    'Te dicen que un número trae mala suerte, sin dar ninguna razón. Puedes ignorarlo sin más.',
    'Un desconocido afirma que la luna es hueca, sin aportar nada. No tienes que refutarlo para no creerle.',
  ] },
];
const razors: Family = {
  id: 'nav',
  uniquePrompt: true,
  counts: () => spread(0, 0, 1, 1, 0, 0),
  make: ({ rng }) => {
    const r = pick(rng, RAZORS);
    return { cat: 'filosofia', prompt: `«${pick(rng, r.ex)}» ¿Qué principio está aplicando?`, correct: r.name, wrong: RAZORS.filter((x) => x !== r).map((x) => x.name), expl: `${r.name}.` };
  },
};

// Validity vs truth: [premises, conclusion, valid?, premisesTrue?]
const ARGS: [string, boolean, boolean][] = [
  ['Todos los peces vuelan. Nemo es un pez. Por tanto, Nemo vuela.', true, false],
  ['Todos los gatos son mamíferos. Misi es un gato. Por tanto, Misi es un mamífero.', true, true],
  ['Todos los perros son animales. Mi gato es un animal. Por tanto, mi gato es un perro.', false, true],
  ['Si llueve, el suelo de la calle se moja. El suelo de la calle está mojado. Por tanto, ha llovido.', false, true],
  ['Todos los cuadrados tienen cinco lados. Esta figura es un cuadrado. Por tanto, tiene cinco lados.', true, false],
  ['Todas las frutas son azules. El limón es una fruta. Por tanto, el limón es azul.', true, false],
  ['Algunos pájaros vuelan. Los pingüinos son pájaros. Por tanto, los pingüinos vuelan.', false, true],
  ['Si un número es par, es divisible entre dos. El 8 es par. Por tanto, es divisible entre dos.', true, true],
  ['Ningún reptil tiene plumas. Las serpientes son reptiles. Por tanto, las serpientes no tienen plumas.', true, true],
  ['Todos los coches son de chocolate. Esta piedra es de chocolate. Por tanto, esta piedra es un coche.', false, false],
  ['Ninguna persona necesita dormir. Ana es una persona. Por tanto, Ana no necesita dormir.', true, false],
  ['Todos los lunes llueve chocolate. Hoy es lunes. Por tanto, hoy llueve chocolate.', true, false],
];
const ARG_OPTS = (v: boolean, t: boolean) => (v ? (t ? 'Válido y con premisas verdaderas' : 'Válido, pero con alguna premisa falsa') : t ? 'No válido, aunque las premisas sean verdaderas' : 'No válido y con alguna premisa falsa');
const validity: Family = {
  id: 'val',
  uniquePrompt: true,
  counts: () => spread(0, 0, 1, 1, 0, 0),
  make: ({ rng }) => {
    const [txt, v, t] = pick(rng, ARGS);
    const all = [ARG_OPTS(true, true), ARG_OPTS(true, false), ARG_OPTS(false, true), ARG_OPTS(false, false)];
    const ans = ARG_OPTS(v, t);
    return {
      cat: 'filosofia',
      prompt: `«${txt}» ¿Cómo es este argumento? (Válido = si las premisas fueran ciertas, la conclusión lo sería seguro.)`,
      correct: ans,
      wrong: all.filter((x) => x !== ans),
      expl: v ? `La conclusión se sigue de las premisas${t ? ', y además son ciertas' : ', aunque alguna premisa sea falsa'}.` : 'La conclusión no se sigue necesariamente de las premisas, aunque pudiera ser cierta.',
    };
  },
};

// ═════════════════════════════════════════════════════════════════════════
// PARADOXES (invented variations of classic structures)
// ═════════════════════════════════════════════════════════════════════════
const VAGUE: [string, string, string, string][] = [
  // [property, small change, absurd conclusion, word]
  ['Una persona con mil euros no es rica. Si a alguien que no es rico le das un euro, sigue sin serlo.', 'un euro', 'Que nadie podría llegar a ser rico nunca', 'rico'],
  ['Alguien que mide 1,50 m no es alto. Si a alguien que no es alto le sumas un milímetro, sigue sin serlo.', 'un milímetro', 'Que nadie podría ser alto nunca', 'alto'],
  ['Un bebé de un día no es viejo. Si alguien no es viejo, un día después tampoco lo es.', 'un día', 'Que nadie llegaría a ser viejo nunca', 'viejo'],
  ['Tres personas no son una multitud. Si a un grupo que no es multitud le añades una persona, sigue sin serlo.', 'una persona', 'Que nunca podría haber una multitud', 'multitud'],
  ['A mediodía es de día. Un segundo después de un momento de día, sigue siendo de día.', 'un segundo', 'Que nunca llegaría a ser de noche', 'día'],
  ['Una gota de agua no es un charco. Si a algo que no es charco le añades una gota, sigue sin serlo.', 'una gota', 'Que nunca podría formarse un charco', 'charco'],
  ['Una página no es un libro largo. Si un libro no es largo, añadirle una página no lo hace largo.', 'una página', 'Que ningún libro podría ser largo', 'largo'],
  ['Una casa no es una ciudad. Si un lugar no es una ciudad, añadirle una casa no lo convierte en ciudad.', 'una casa', 'Que nunca podría existir una ciudad', 'ciudad'],
];
const sorites: Family = {
  id: 'sor',
  uniquePrompt: true,
  counts: () => spread(0, 1, 1, 1, 1, 0),
  make: ({ rng }) => {
    const [txt, , absurd, word] = pick(rng, VAGUE);
    if (rng() < 0.5) {
      return { cat: 'paradojas', prompt: `${txt} Repitiendo la regla una y otra vez, ¿a qué conclusión absurda se llega?`, correct: absurd, wrong: ['Que todo el mundo cumpliría la condición desde el principio', 'A ninguna: el razonamiento es correcto', 'Que el cambio pequeño no existe'], expl: 'Es la paradoja sorites: un cambio diminuto nunca parece suficiente, pero muchos juntos sí lo son.' };
    }
    return { cat: 'paradojas', prompt: `${txt} ¿Qué muestra este tipo de paradoja?`, correct: `Que la palabra «${word}» no tiene un límite exacto`, wrong: [`Que «${word}» no significa nada`, 'Que los cambios pequeños no importan nunca', 'Que las reglas lógicas no sirven'], expl: `Las palabras vagas como «${word}» funcionan sin una frontera exacta, y eso es lo que explota la paradoja.` };
  },
};

const IDENT: [string, string][] = [
  ['una guitarra', 'todas sus piezas'], ['una bicicleta', 'todas sus piezas'], ['un grupo de música', 'a todos sus miembros'], ['un equipo de fútbol', 'a todos sus jugadores'],
  ['un ordenador', 'todos sus componentes'], ['una casa', 'todos sus ladrillos'], ['un coche antiguo', 'todas sus piezas'], ['una empresa', 'a todos sus empleados'], ['un barco de pesca', 'todas sus tablas'], ['un reloj de la abuela', 'todos sus engranajes'],
];
const identity: Family = {
  id: 'ide',
  uniquePrompt: true,
  counts: () => spread(0, 1, 1, 1, 1, 1),
  make: ({ D, rng }) => {
    const [obj, parts] = pick(rng, IDENT);
    if (D <= 5 || rng() < 0.5) {
      return { cat: 'paradojas', prompt: `Con los años, a ${obj} le cambian, uno a uno, ${parts}, hasta no quedar nada del original. ¿Qué pregunta plantea, como el barco de Teseo?`, correct: `Si sigue siendo ${obj.replace(/^una? /, (a) => (a === 'una ' ? 'la misma ' : 'el mismo '))}`, wrong: ['Cuánto ha costado cambiarlo todo', 'Quién ha hecho los cambios', 'Si funciona mejor que antes'], expl: 'Plantea qué hace que algo siga siendo lo mismo cuando cambian todas sus partes.' };
    }
    return { cat: 'paradojas', prompt: `A ${obj} le cambian ${parts} y, con lo que se retiró, alguien monta otr${obj.startsWith('una') ? 'a' : 'o'} idéntic${obj.startsWith('una') ? 'a' : 'o'}. ¿Por qué se complica el problema?`, correct: 'Los dos tienen motivos para ser «el original»', wrong: ['Porque uno de los dos funciona peor', 'Porque ninguno vale nada', 'No se complica: el reconstruido es una copia sin más'], expl: 'Uno conserva la continuidad y la historia; el otro, el material original.' };
  },
};

const SELF: [string, number][] = [
  // 0 verdadera, 1 falsa, 2 paradójica
  ['Esta frase es falsa.', 2], ['Lo que dice esta frase es mentira.', 2], ['Esta frase no es verdadera.', 2],
  ['Esta frase tiene cinco palabras.', 0], ['Esta frase tiene siete palabras.', 1], ['Esta frase contiene la letra zeta.', 0],
  ['Esta frase no contiene la letra a.', 1], ['Esta frase está escrita en español.', 0], ['Esta frase está escrita en francés.', 1],
  ['Esta frase termina con un punto.', 0], ['Esta frase tiene más de veinte letras.', 0], ['Esta frase tiene menos de diez letras.', 1],
  ['Esta frase empieza por la letra E.', 0], ['Esta frase empieza por la letra B.', 1], ['Nada de lo que pone en esta frase es cierto.', 2],
];
const SELF_OPTS = ['Verdadera', 'Falsa', 'Paradójica: no puede ser ni verdadera ni falsa', 'No es una frase'];
const SELF_EXPL = ['Lo que dice de sí misma se cumple.', 'Lo que dice de sí misma no se cumple.', 'Si fuera verdadera sería falsa, y si fuera falsa sería verdadera.'];
const selfRef: Family = {
  id: 'aut',
  uniquePrompt: true,
  counts: () => spread(1, 1, 1, 0, 0, 0),
  make: ({ rng }) => {
    const [txt, k] = pick(rng, SELF);
    const where = pick(rng, ['En un cartel pone', 'En una pizarra alguien ha escrito', 'En un papel se lee', 'En la puerta de un aula pone']);
    return { cat: 'paradojas', prompt: `${where}: «${txt}» ¿Cómo es esa frase?`, correct: SELF_OPTS[k], wrong: SELF_OPTS.filter((_, i) => i !== k), expl: SELF_EXPL[k] };
  },
};

const HOTEL_NEW = [2, 3, 4, 5, 7, 10, 12, 20, 50, 100];
const NUMW: Record<number, string> = { 2: 'dos', 3: 'tres', 4: 'cuatro', 5: 'cinco', 7: 'siete', 10: 'diez', 12: 'doce', 20: 'veinte', 50: 'cincuenta', 100: 'cien' };
const hotel: Family = {
  id: 'hot',
  uniquePrompt: true,
  counts: () => spread(0, 0, 1, 1, 1, 1),
  make: ({ rng }) => {
    const k = pick(rng, HOTEL_NEW);
    const who = pick(rng, ['huéspedes', 'turistas', 'viajeros', 'músicos de una banda', 'jugadores de un equipo']);
    return {
      cat: 'paradojas',
      prompt: `Un hotel con infinitas habitaciones (1, 2, 3…) está completo. Llegan ${NUMW[k]} ${who} más. ¿Cómo los aloja sin echar a nadie ni compartir habitación?`,
      correct: `Pasando al huésped de la habitación n a la n + ${k} y dejando libres las ${k} primeras`,
      wrong: ['Es imposible: el hotel está lleno', 'Pasando a cada huésped a la habitación siguiente: quedan libres todas las necesarias', `Echando a los ${NUMW[k]} últimos huéspedes`],
      expl: `Al correr a todos ${k} puestos, todos siguen teniendo habitación y quedan libres de la 1 a la ${k}. (Correr un solo puesto deja libre solo una.)`,
    };
  },
};

const DILEMMAS = [
  { ctx: 'Dos tiendas vecinas deciden a la vez si bajan precios o no.', a: 'bajar precios', b: 'mantener precios', unit: 'clientes' },
  { ctx: 'Dos compañeros de piso deciden a la vez si limpian la cocina o no.', a: 'no limpiar', b: 'limpiar', unit: 'puntos de comodidad' },
  { ctx: 'Dos pescadores comparten un lago y deciden a la vez si pescan mucho o poco.', a: 'pescar mucho', b: 'pescar poco', unit: 'peces' },
  { ctx: 'Dos equipos rivales deciden a la vez si gastan mucho en fichajes o no.', a: 'gastar mucho', b: 'no gastar', unit: 'puntos' },
];
const prisoner: Family = {
  id: 'pri',
  uniquePrompt: true,
  counts: () => spread(0, 0, 1, 1, 1, 1),
  make: ({ rng }) => {
    const d = pick(rng, DILEMMAS);
    // Classic structure T > R > P > S (temptation, reward, punishment, sucker).
    const S = pick(rng, [0, 1, 2]);
    const P2 = S + pick(rng, [1, 2]);
    const R2 = P2 + pick(rng, [2, 3]);
    const T = R2 + pick(rng, [1, 2, 3]);
    const both = rng() < 0.5;
    return {
      cat: 'paradojas',
      prompt: `${d.ctx} Si los dos eligen «${d.b}», cada uno gana ${R2} ${d.unit}. Si los dos eligen «${d.a}», cada uno gana ${P2}. Si solo uno elige «${d.a}», ese gana ${T} y el otro ${S}. ${both ? 'Si cada uno piensa solo en lo suyo, ¿qué acaban haciendo?' : '¿Qué sería mejor para los dos juntos?'}`,
      correct: both ? `Los dos eligen «${d.a}»` : `Que los dos eligieran «${d.b}»`,
      wrong: both ? [`Los dos eligen «${d.b}»`, `Uno elige «${d.a}» y el otro «${d.b}»`, 'Ninguno decide nada'] : [`Que los dos eligieran «${d.a}»`, `Que solo uno eligiera «${d.a}»`, 'Da igual lo que hagan'],
      expl: both
        ? `Elegir «${d.a}» te da más pase lo que pase (${T} > ${R2} y ${P2} > ${S}), así que los dos lo hacen… y acaban con ${P2} cada uno en lugar de ${R2}. Es el dilema del prisionero.`
        : `Juntos ganan más si los dos eligen «${d.b}» (${R2} cada uno), aunque a cada uno por separado le tiente lo contrario. Es el dilema del prisionero.`,
    };
  },
};

const ZENO = [
  ['Para cruzar la calle, Leo primero recorre la mitad, luego la mitad de lo que le queda, luego la mitad de lo que queda…', 'Leo'],
  ['Una flecha, antes de llegar a la diana, debe recorrer la mitad del camino; después la mitad del resto; y así sin fin…', 'la flecha'],
  ['Para salir de la habitación, Sara debe llegar primero a mitad de camino de la puerta, luego a mitad de lo que falta…', 'Sara'],
  ['Un corredor debe recorrer la mitad de la pista, luego la mitad de lo que queda, luego la mitad otra vez…', 'el corredor'],
];
const zeno: Family = {
  id: 'zen',
  uniquePrompt: true,
  counts: () => spread(0, 1, 1, 1, 0, 0),
  make: ({ rng }) => {
    const [txt, who] = pick(rng, ZENO);
    const ask = pick(rng, ['¿Dónde falla el razonamiento de que nunca llegará?', '¿Por qué, en realidad, sí llega?']);
    return { cat: 'paradojas', prompt: `${txt} Zenón concluiría que ${who} nunca llega. ${ask}`, correct: 'Infinitos tramos cada vez más cortos pueden recorrerse en un tiempo finito', wrong: ['Porque los tramos no se acortan', 'Porque en realidad no se mueve', 'No falla: nunca llega'], expl: 'La suma de ½ + ¼ + ⅛ + … no crece sin fin: da exactamente el trayecto completo, y se recorre en un tiempo finito.' };
  },
};

const TIME = [
  { p: 'Viajas al pasado e impides que se invente la máquina del tiempo.', c: 'Si no se inventa, no puedes haber viajado para impedirlo', w: ['La máquina se inventa igualmente', 'Te conviertes en el inventor', 'No ocurre nada raro'] },
  { p: 'Viajas al pasado y le das a una compositora famosa las partituras de sus propias canciones, que ella copia y publica.', c: 'Nadie ha compuesto realmente esas canciones: no tienen origen', w: ['Las compuso ella, sin más', 'Las compusiste tú', 'Las canciones desaparecen'] },
  { p: 'Un viajero del tiempo vuelve atrás para evitar el accidente que le hizo construir su máquina del tiempo.', c: 'Si evita el accidente, ya no tendría motivo para viajar y evitarlo', w: ['El accidente ocurre dos veces', 'Su máquina deja de funcionar', 'No hay ningún problema'] },
  { p: 'Viajas al pasado y te encuentras contigo mismo de niño, que recordará ese encuentro toda la vida… y por eso decidirá viajar al pasado.', c: 'El viaje es causa y consecuencia a la vez: un bucle sin principio', w: ['Es imposible encontrarse con uno mismo', 'El niño olvida el encuentro', 'Ninguna: es una historia normal'] },
];
const timeTravel: Family = {
  id: 'tie',
  uniquePrompt: true,
  counts: () => spread(0, 0, 1, 1, 1, 0),
  make: ({ rng }) => {
    const t = pick(rng, TIME);
    return { cat: 'paradojas', prompt: `${t.p} ¿Qué paradoja aparece?`, correct: t.c, wrong: t.w, expl: 'Los viajes al pasado crean bucles donde un efecto anula (o crea) su propia causa.' };
  },
};

const SURPRISE = ['un examen sorpresa', 'una visita sorpresa del director', 'un simulacro de incendio sorpresa', 'una fiesta sorpresa', 'un regalo sorpresa'];
const SPAN: [string, string[]][] = [
  ['de lunes a viernes', ['lunes', 'martes', 'miércoles', 'jueves', 'viernes']],
  ['de lunes a sábado', ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']],
  ['de martes a viernes', ['martes', 'miércoles', 'jueves', 'viernes']],
  ['de miércoles a domingo', ['miércoles', 'jueves', 'viernes', 'sábado', 'domingo']],
];
const surprise: Family = {
  id: 'sop2',
  uniquePrompt: true,
  counts: () => spread(0, 1, 1, 1, 0, 0),
  make: ({ rng }) => {
    const ev = pick(rng, SURPRISE);
    const [span, days] = pick(rng, SPAN);
    const second = rng() < 0.4;
    const ans = second ? days[days.length - 2] : days[days.length - 1];
    const wrong = shuffle(days.filter((d) => d !== ans), rng).slice(0, 3);
    return {
      cat: 'paradojas',
      prompt: `Te anuncian ${ev} para un día de la semana que viene (${span}) y te aseguran que no podrás adivinar el día la víspera. Razonas descartando días desde el final. ¿Qué día descartas ${second ? 'en segundo lugar' : 'primero'}?`,
      correct: cap(ans),
      wrong: wrong.map(cap),
      expl: `Primero el ${days[days.length - 1]} (la víspera lo sabrías). Después el ${days[days.length - 2]}, y así hasta concluir que no puede haber sorpresa… aunque luego la hay.`,
    };
  },
};

export const PHILO_FAMILIES = [fallacyId, fallacyFind, ethics, reasoning, conditions, causation, razors, validity, sorites, identity, selfRef, hotel, prisoner, zeno, timeTravel, surprise];
