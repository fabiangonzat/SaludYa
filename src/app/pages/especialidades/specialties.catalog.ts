import { SPECIALTIES, doctorSpecialtyName } from '../medicos/doctors.models';

export type SpecialtyCategory = 'Todas' | 'Atención general' | 'Especialidades clínicas' | 'Bienestar integral';
export interface SpecialtyInfo {
  name: (typeof SPECIALTIES)[number];
  description: string;
  overview: string;
  reasons: string[];
  care: string[];
  category: Exclude<SpecialtyCategory, 'Todas'>;
  icon: string;
  featured: boolean;
  doctorSpecialty: string;
}

const ICONS = [
  'M12 3v18M3 12h18',
  'M3 12h4l2-6 4 12 2-6h6',
  'M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z',
  'M12 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM5 21v-2a7 7 0 0 1 14 0v2',
  'M12 20s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z',
  'M9 7a3 3 0 1 1 6 0c0 2-3 3-3 5m0 4h.01M4 4l3 3m10 10 3 3',
  'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  'M8 3v18m8-18v18M5 8h14m-14 8h14',
  'M8 4c0-2 8-2 8 2 0 6-2 14-4 14S8 12 8 4z',
  'M12 4a8 8 0 1 0 8 8M12 8v4l3 2m3-9 2-2m-2 2 2 2',
  'M12 4a5 5 0 0 1 5 5v2a3 3 0 0 1-3 3h-1v4h-2v-4a4 4 0 0 1-4-4V9a5 5 0 0 1 5-5z',
  'M12 3v18M8 7h8M8 17h8M5 12h14',
  'M4 5h16v14H4zM8 9h8m-8 4h8m-8 3h5',
  'M9 4v6a3 3 0 0 0 6 0V4m-9 0v5a6 6 0 0 0 12 0V4m-6 12v4',
  'M4 10a8 8 0 1 1 16 0c0 6-8 11-8 11S4 16 4 10zm8-3v6m-3-3h6',
  'M12 3v18m-5-4a5 5 0 0 1 10 0M7 8a5 5 0 0 1 10 0',
  'M12 3a9 9 0 1 0 9 9M12 7v5l4 2m2-9 2-2',
  'M12 3a9 9 0 1 0 9 9M12 7v5l4 2',
  'M12 3v18m-6-6a6 6 0 0 1 12 0M6 8a6 6 0 0 1 12 0',
  'M4 6h16M4 12h16M4 18h16m-8-15v18',
];

const DESCRIPTIONS: Array<[string, string, string, string, SpecialtyInfo['category'], boolean]> = [
  ['Atención primaria para evaluar síntomas frecuentes, prevenir enfermedades y orientar tu cuidado.', 'La medicina general aborda la atención inicial y continua de la salud en personas de distintas edades. El profesional evalúa síntomas, realiza controles y orienta si hace falta atención especializada.', 'Chequeos preventivos|Síntomas comunes|Control de salud', 'Consulta presencial|Consulta virtual', 'Atención general', true],
  ['Evaluación y seguimiento de la salud del corazón y el sistema circulatorio.', 'La cardiología se ocupa de prevenir, diagnosticar y tratar afecciones del corazón y los vasos sanguíneos.', 'Presión arterial|Palpitaciones|Dolor en el pecho', 'Consulta presencial|Consulta virtual', 'Especialidades clínicas', true],
  ['Atención médica para la piel, el cabello y las uñas.', 'La dermatología evalúa condiciones de la piel y sus anexos, así como cambios que requieren seguimiento médico.', 'Acné o irritación|Lunares|Caída del cabello', 'Consulta presencial|Consulta virtual', 'Especialidades clínicas', false],
  ['Atención de la salud y el desarrollo de niñas, niños y adolescentes.', 'La pediatría acompaña el crecimiento, la prevención y la atención de enfermedades durante la infancia y adolescencia.', 'Controles de crecimiento|Fiebre|Vacunación y orientación', 'Consulta presencial|Consulta virtual', 'Especialidades clínicas', true],
  ['Cuidado ginecológico y obstétrico en las distintas etapas de la vida.', 'La ginecología y obstetricia atiende la salud reproductiva, el embarazo y controles relacionados.', 'Control ginecológico|Planificación familiar|Seguimiento prenatal', 'Consulta presencial|Consulta virtual', 'Especialidades clínicas', false],
  ['Evaluación del cerebro, la médula espinal y el sistema nervioso.', 'La neurología se ocupa del diagnóstico y seguimiento de condiciones que afectan el sistema nervioso.', 'Dolores de cabeza|Cambios en memoria|Mareos o temblores', 'Consulta presencial|Consulta virtual', 'Especialidades clínicas', false],
  ['Atención de la visión y de las estructuras del ojo.', 'La oftalmología evalúa la salud ocular, la visión y condiciones que requieren tratamiento o seguimiento.', 'Visión borrosa|Irritación ocular|Control de la vista', 'Consulta presencial', 'Especialidades clínicas', false],
  ['Atención de huesos, articulaciones, músculos y lesiones del movimiento.', 'La traumatología y ortopedia aborda lesiones y afecciones del sistema musculoesquelético.', 'Dolor articular|Lesiones|Molestias de espalda', 'Consulta presencial', 'Especialidades clínicas', false],
  ['Prevención, evaluación y cuidado de la salud bucal.', 'La odontología atiende dientes, encías y otras estructuras de la boca, además de promover hábitos de prevención.', 'Dolor dental|Salud de encías|Limpieza y prevención', 'Consulta presencial', 'Especialidades clínicas', false],
  ['Acompañamiento profesional para el bienestar emocional y conductual.', 'La psicología evalúa procesos emocionales y conductuales y brinda orientación o terapia según cada caso.', 'Estrés|Ansiedad|Dificultades emocionales', 'Consulta presencial|Consulta virtual', 'Bienestar integral', true],
  ['Evaluación y tratamiento médico de condiciones de salud mental.', 'La psiquiatría es una especialidad médica que evalúa la salud mental y ofrece opciones de tratamiento clínico.', 'Cambios en el ánimo|Sueño|Seguimiento de tratamiento', 'Consulta presencial|Consulta virtual', 'Bienestar integral', false],
  ['Atención de hormonas, metabolismo y glándulas endocrinas.', 'La endocrinología evalúa el funcionamiento hormonal y metabólico del organismo.', 'Tiroides|Diabetes|Cambios metabólicos', 'Consulta presencial|Consulta virtual', 'Especialidades clínicas', false],
  ['Evaluación del aparato digestivo y sus órganos.', 'La gastroenterología aborda el sistema digestivo, incluidos el esófago, estómago, intestinos, hígado y páncreas.', 'Dolor abdominal|Reflujo|Cambios digestivos', 'Consulta presencial|Consulta virtual', 'Especialidades clínicas', false],
  ['Atención del sistema urinario y de la salud urológica.', 'La urología se ocupa del diagnóstico y tratamiento de condiciones del tracto urinario y, según el caso, del sistema reproductor masculino.', 'Molestias urinarias|Control urológico|Seguimiento renal', 'Consulta presencial', 'Especialidades clínicas', false],
  ['Evaluación de oído, nariz, garganta y estructuras relacionadas.', 'La otorrinolaringología atiende condiciones del oído, nariz, garganta y áreas relacionadas de cabeza y cuello.', 'Dolor de oído|Congestión nasal|Molestias de garganta', 'Consulta presencial', 'Especialidades clínicas', false],
  ['Atención del sistema respiratorio y los pulmones.', 'La neumología evalúa síntomas y condiciones que afectan la respiración y los pulmones.', 'Tos persistente|Dificultad respiratoria|Asma', 'Consulta presencial|Consulta virtual', 'Especialidades clínicas', false],
  ['Evaluación de articulaciones, músculos y enfermedades inflamatorias.', 'La reumatología aborda enfermedades del aparato locomotor y trastornos autoinmunes sistémicos.', 'Dolor articular|Rigidez|Inflamación', 'Consulta presencial', 'Especialidades clínicas', false],
  ['Atención de los riñones y del equilibrio de líquidos del organismo.', 'La nefrología se ocupa de la salud renal, la función de los riñones y condiciones relacionadas.', 'Control de función renal|Presión arterial|Seguimiento de enfermedad renal', 'Consulta presencial', 'Especialidades clínicas', false],
  ['Evaluación médica de tumores y coordinación de su tratamiento.', 'La oncología estudia y trata enfermedades oncológicas y coordina el cuidado con otros profesionales.', 'Orientación especializada|Segunda opinión|Seguimiento oncológico', 'Consulta presencial', 'Especialidades clínicas', false],
  ['Orientación alimentaria para apoyar la salud y los hábitos cotidianos.', 'Nutrición brinda evaluación y orientación alimentaria adaptada a las necesidades y objetivos de cada persona.', 'Planificación de comidas|Hábitos saludables|Nutrición clínica', 'Consulta presencial|Consulta virtual', 'Bienestar integral', false],
];

export const SPECIALTY_CATEGORIES: SpecialtyCategory[] = ['Todas', 'Atención general', 'Especialidades clínicas', 'Bienestar integral'];

export const SPECIALTY_CATALOG: SpecialtyInfo[] = SPECIALTIES.map((name, index) => {
  const [description, overview, reasons, care, category, featured] = DESCRIPTIONS[index];
  return { name, description, overview, reasons: reasons.split('|'), care: care.split('|'), category, icon: ICONS[index], featured, doctorSpecialty: doctorSpecialtyName(name) };
});
