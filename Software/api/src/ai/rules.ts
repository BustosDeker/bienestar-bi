import type { RecommendInput, Recommendation, RecommendationProvider } from './types.js';

type Lang = 'es' | 'en';
type St = 'bueno' | 'regular' | 'malo';

const T: Record<string, Record<St, Record<Lang, string>>> = {
  'KPI-01': {
    malo: {
      es: 'La satisfacción con la vida promedio está en nivel bajo. Conviene acudir a la oficina de bienestar estudiantil y conversar con alguien de confianza; no es un diagnóstico, solo una señal para pedir apoyo a tiempo.',
      en: 'Average life satisfaction is low. Consider visiting the student wellbeing office and talking with someone you trust; this is not a diagnosis, just a signal to ask for support early.',
    },
    regular: {
      es: 'La satisfacción con la vida está en un nivel intermedio. Identificar una meta pequeña y alcanzable para esta semana puede ayudar a sostener la tendencia entre mediciones.',
      en: 'Life satisfaction is at an intermediate level. Picking one small, achievable goal for this week can help sustain the trend between waves.',
    },
    bueno: {
      es: 'La satisfacción con la vida está en un buen nivel. Vale la pena mantener las rutinas que te funcionan y compartirlas con tus compañeros.',
      en: 'Life satisfaction is at a good level. It is worth keeping the routines that work for you and sharing them with peers.',
    },
  },
  'KPI-02': {
    malo: {
      es: 'Las horas semanales de interacción significativa son pocas. Agenda al menos un encuentro semanal con alguien cercano (familia, amistades o compañeros), presencial si es posible.',
      en: 'Weekly hours of meaningful interaction are low. Schedule at least one weekly meeting with someone close (family, friends or classmates), in person if possible.',
    },
    regular: {
      es: 'Las horas de interacción significativa están a medio camino de la meta. Sumar una conversación o una comida compartida más por semana acerca el indicador al nivel bueno.',
      en: 'Hours of meaningful interaction are halfway to the target. Adding one more conversation or shared meal per week moves the indicator toward the good level.',
    },
    bueno: {
      es: 'Las horas de interacción significativa son suficientes. Mantén esos espacios y cuida que no se cancelen en semanas de más carga académica.',
      en: 'Hours of meaningful interaction are sufficient. Keep those spaces and protect them during heavier academic weeks.',
    },
  },
  'KPI-03': {
    malo: {
      es: 'La calidad percibida de las interacciones es baja. Prioriza espacios donde te sientas escuchado y considera hablar con orientación estudiantil si te sientes aislado.',
      en: 'Perceived quality of interactions is low. Prioritize settings where you feel heard and consider talking to student counseling if you feel isolated.',
    },
    regular: {
      es: 'La calidad relacional es aceptable pero mejorable. Dedicar tiempo sin distracciones (sin pantallas) a las personas importantes suele elevar la valoración.',
      en: 'Relationship quality is acceptable but could improve. Spending distraction-free time (no screens) with important people tends to raise the rating.',
    },
    bueno: {
      es: 'La calidad de las relaciones es alta. Es un recurso valioso: cuida esos vínculos y dedica tiempo a fortalecerlos.',
      en: 'Relationship quality is high. This is a valuable resource: nurture those bonds and make time to strengthen them.',
    },
  },
  'KPI-04': {
    malo: {
      es: 'Casi no hay días de actividad física por semana. Empieza con 10 minutos de caminata en 2 o 3 días y aumenta de forma gradual.',
      en: 'There are almost no days of physical activity per week. Start with a 10-minute walk on 2 or 3 days and increase gradually.',
    },
    regular: {
      es: 'La actividad física está entre 1 y 3 días por semana. Añadir un día más, o combinar caminata con yoga o estiramiento, ayuda a llegar a 3 días.',
      en: 'Physical activity is between 1 and 3 days per week. Adding one more day, or mixing walking with yoga or stretching, helps reach 3 days.',
    },
    bueno: {
      es: 'Se alcanza la meta de actividad física semanal. Variar el tipo de actividad (y sumar autocuidado) ayuda a mantener la constancia.',
      en: 'The weekly physical-activity target is met. Varying the activity type (and adding self-care) helps keep consistency.',
    },
  },
};

const GENERAL: Record<Lang, string> = {
  es: 'Estas recomendaciones son orientativas y se basan en asociaciones, no en causas; no reemplazan la atención profesional.',
  en: 'These recommendations are indicative and based on associations, not causes; they do not replace professional care.',
};
const ORDER: Record<St, number> = { malo: 0, regular: 1, bueno: 2 };

export const rulesProvider: RecommendationProvider = {
  name: 'rules',
  async recommend(input: RecommendInput): Promise<Recommendation[]> {
    const items = input.kpis
      .filter((k) => k.estado)
      .sort((a, b) => ORDER[a.estado!] - ORDER[b.estado!] || a.id.localeCompare(b.id));
    const out: Recommendation[] = items.map((k) => ({ kpi: k.id, text: T[k.id][k.estado!][input.lang] }));
    const k1 = input.kpis.find((k) => k.id === 'KPI-01');
    if (k1?.estado === 'malo') {
      // la sugerencia de bienestar siempre va primero
      const i = out.findIndex((r) => r.kpi === 'KPI-01');
      if (i > 0) out.unshift(out.splice(i, 1)[0]);
    }
    out.push({ kpi: 'GENERAL', text: GENERAL[input.lang] });
    return out.slice(0, 5);
  },
};
