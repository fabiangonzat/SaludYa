import { NgTemplateOutlet } from '@angular/common';
import { Component, HostListener, InjectionToken, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Observable, defer, delay, of } from 'rxjs';

/* =====================================================================
 *  MODELOS
 *  Ajusta estos tipos a la respuesta real de tu backend.
 * ===================================================================== */
export type TipoDocumento = 'DNI' | 'CE' | 'PASAPORTE';
export type SeccionPerfil = 'personal' | 'emergencia' | 'salud';

export interface DatosPersonales {
  nombres: string;
  apellidos: string;
  tipoDocumento: TipoDocumento;
  numeroDocumento: string;
  fechaNacimiento: string; // YYYY-MM-DD
  genero: string;
  telefono: string;
  email: string;
  direccion: string;
  ciudad: string;
  departamento: string;
}

export interface ContactoEmergencia {
  nombre: string;
  parentesco: string;
  telefono: string;
  email: string;
}

export interface DatosSalud {
  tipoSangre: string;
  alergias: string;
  enfermedades: string;
  medicamentos: string;
  observaciones: string;
}

export interface PreferenciasNotificacion {
  recordatoriosCitas: boolean;
  confirmacionesCitas: boolean;
  mensajesMedicos: boolean;
  actualizacionesPlataforma: boolean;
}

export interface PerfilPaciente extends DatosPersonales {
  id: string;
  fotoUrl?: string | null;
  emailVerificado: boolean;
  telefonoVerificado: boolean;
  estadoCuenta: 'activa' | 'inactiva';
  fechaRegistro: string; // YYYY-MM-DD
  contactoEmergencia: ContactoEmergencia;
  salud: DatosSalud;
  notificaciones: PreferenciasNotificacion;
}

export interface ActividadCuenta {
  fecha: string; // ISO
  descripcion: string;
  dispositivo?: string | null;
}

/* =====================================================================
 *  CONTRATO CON EL BACKEND
 *  No se inventan endpoints: implementa esta interfaz con tus servicios
 *  existentes y regístrala:  { provide: PERFIL_API, useClass: MiPerfilApi }
 *  Si no se registra, el componente funciona con DATOS DE PRUEBA.
 * ===================================================================== */
export interface PerfilApi {
  obtener(): Observable<PerfilPaciente>;
  actualizar(seccion: SeccionPerfil, datos: DatosPersonales | ContactoEmergencia | DatosSalud): Observable<PerfilPaciente>;
  subirFoto(archivo: File): Observable<{ fotoUrl: string }>;
  cambiarPassword(actual: string, nueva: string): Observable<void>;
  guardarNotificaciones(prefs: PreferenciasNotificacion): Observable<void>;
  solicitarVerificacionEmail(): Observable<void>;
  solicitarVerificacionTelefono(): Observable<void>;
  actividadReciente(): Observable<ActividadCuenta[]>;
}
export const PERFIL_API = new InjectionToken<PerfilApi>('PERFIL_API');

/** Implementación en memoria SOLO para ver la interfaz. No guarda nada en el servidor ni en el navegador. */
function crearApiDemo(): PerfilApi {
  let perfil: PerfilPaciente = {
    id: 'demo',
    nombres: 'Paciente',
    apellidos: 'de Prueba',
    tipoDocumento: 'DNI',
    numeroDocumento: '00000000',
    fechaNacimiento: '1990-01-01',
    genero: '',
    telefono: '900000000',
    email: 'paciente.prueba@ejemplo.com',
    direccion: '',
    ciudad: '',
    departamento: '',
    fotoUrl: null,
    emailVerificado: false,
    telefonoVerificado: false,
    estadoCuenta: 'activa',
    fechaRegistro: '2026-01-01',
    contactoEmergencia: { nombre: '', parentesco: '', telefono: '', email: '' },
    salud: { tipoSangre: '', alergias: '', enfermedades: '', medicamentos: '', observaciones: '' },
    notificaciones: { recordatoriosCitas: true, confirmacionesCitas: true, mensajesMedicos: true, actualizacionesPlataforma: false },
  };
  const lag = <T>(fn: () => T) => defer(() => of(fn())).pipe(delay(500));
  return {
    obtener: () => lag(() => perfil),
    actualizar: (seccion, datos) =>
      lag(() => {
        perfil =
          seccion === 'personal' ? { ...perfil, ...(datos as DatosPersonales) }
          : seccion === 'emergencia' ? { ...perfil, contactoEmergencia: datos as ContactoEmergencia }
          : { ...perfil, salud: datos as DatosSalud };
        return perfil;
      }),
    subirFoto: (archivo) => lag(() => ({ fotoUrl: URL.createObjectURL(archivo) })),
    cambiarPassword: () => lag(() => undefined),
    guardarNotificaciones: (prefs) => lag(() => { perfil = { ...perfil, notificaciones: prefs }; }),
    solicitarVerificacionEmail: () => lag(() => undefined),
    solicitarVerificacionTelefono: () => lag(() => undefined),
    actividadReciente: () => lag(() => []),
  };
}

/* =====================================================================
 *  CONSTANTES Y VALIDADORES
 * ===================================================================== */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^9\d{8}$/; // celular peruano
const MAX_FOTO_BYTES = 2 * 1024 * 1024;
const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'];

function documentoValido(control: AbstractControl): ValidationErrors | null {
  const tipo = control.parent?.get('tipoDocumento')?.value as TipoDocumento | undefined;
  const v = String(control.value ?? '').trim();
  if (!v) return null; // lo cubre "required"
  if (tipo === 'DNI') return /^\d{8}$/.test(v) ? null : { documento: 'El DNI debe tener 8 dígitos.' };
  if (tipo === 'CE') return /^[A-Za-z0-9]{9,12}$/.test(v) ? null : { documento: 'El carné de extranjería debe tener entre 9 y 12 caracteres.' };
  return /^[A-Za-z0-9]{6,12}$/.test(v) ? null : { documento: 'El pasaporte debe tener entre 6 y 12 caracteres.' };
}

export function calcularEdad(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - y;
  if (hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d)) edad--;
  return edad;
}

function fechaNacimientoValida(control: AbstractControl): ValidationErrors | null {
  const edad = calcularEdad(control.value as string);
  if (edad === null) return null;
  if (edad < 0) return { futura: true };
  if (edad > 120) return { edadMaxima: true };
  return null;
}

/** Si se registra cualquier dato del contacto de emergencia, nombre y teléfono pasan a ser obligatorios. */
function requeridoSiHayContacto(control: AbstractControl): ValidationErrors | null {
  const grupo = control.parent;
  if (!grupo) return null;
  const hayDatos = ['nombre', 'parentesco', 'telefono', 'email'].some((k) => !!String(grupo.get(k)?.value ?? '').trim());
  return hayDatos && !String(control.value ?? '').trim() ? { required: true } : null;
}

function passwordsCoinciden(group: AbstractControl): ValidationErrors | null {
  const nueva = group.get('nueva')?.value;
  const confirmar = group.get('confirmar')?.value;
  return nueva && confirmar && nueva !== confirmar ? { mismatch: true } : null;
}

function nuevaDistintaDeActual(group: AbstractControl): ValidationErrors | null {
  const actual = group.get('actual')?.value;
  const nueva = group.get('nueva')?.value;
  return actual && nueva && actual === nueva ? { igualActual: true } : null;
}

/* =====================================================================
 *  CATÁLOGOS Y DEFINICIÓN DE CAMPOS
 * ===================================================================== */
interface CampoDef {
  name: string;
  label: string;
  type: 'text' | 'tel' | 'email' | 'date' | 'select' | 'textarea';
  options?: { value: string; label: string }[];
  placeholder?: string;
  autocomplete?: string;
  full?: boolean;
  optional?: boolean;
  maxlength?: number;
}

const opts = (valores: string[]) => valores.map((v) => ({ value: v, label: v }));

const DEPARTAMENTOS = [
  'Amazonas', 'Áncash', 'Apurímac', 'Arequipa', 'Ayacucho', 'Cajamarca', 'Callao', 'Cusco', 'Huancavelica',
  'Huánuco', 'Ica', 'Junín', 'La Libertad', 'Lambayeque', 'Lima', 'Loreto', 'Madre de Dios', 'Moquegua',
  'Pasco', 'Piura', 'Puno', 'San Martín', 'Tacna', 'Tumbes', 'Ucayali',
];

const CAMPOS_PERSONALES: CampoDef[] = [
  { name: 'nombres', label: 'Nombres', type: 'text', autocomplete: 'given-name', placeholder: 'Tus nombres' },
  { name: 'apellidos', label: 'Apellidos', type: 'text', autocomplete: 'family-name', placeholder: 'Tus apellidos' },
  { name: 'tipoDocumento', label: 'Tipo de documento', type: 'select', options: [
    { value: 'DNI', label: 'DNI' }, { value: 'CE', label: 'Carné de extranjería' }, { value: 'PASAPORTE', label: 'Pasaporte' },
  ] },
  { name: 'numeroDocumento', label: 'Número de documento', type: 'text', placeholder: '12345678' },
  { name: 'fechaNacimiento', label: 'Fecha de nacimiento', type: 'date', autocomplete: 'bday' },
  { name: 'genero', label: 'Género', type: 'select', optional: true, options: [
    { value: '', label: 'Seleccionar' }, { value: 'femenino', label: 'Femenino' }, { value: 'masculino', label: 'Masculino' },
    { value: 'otro', label: 'Otro' }, { value: 'prefiero-no-decirlo', label: 'Prefiero no decirlo' },
  ] },
  { name: 'telefono', label: 'Teléfono celular', type: 'tel', autocomplete: 'tel-national', placeholder: '987654321', maxlength: 9 },
  { name: 'email', label: 'Correo electrónico', type: 'email', autocomplete: 'email', placeholder: 'tu@correo.com' },
  { name: 'direccion', label: 'Dirección', type: 'text', autocomplete: 'street-address', placeholder: 'Calle, número, distrito', full: true, optional: true },
  { name: 'ciudad', label: 'Ciudad', type: 'text', placeholder: 'Ciudad', optional: true },
  { name: 'departamento', label: 'Departamento', type: 'select', optional: true,
    options: [{ value: '', label: 'Seleccionar' }, ...opts(DEPARTAMENTOS)] },
];

const CAMPOS_EMERGENCIA: CampoDef[] = [
  { name: 'nombre', label: 'Nombre del contacto', type: 'text', placeholder: 'Nombre y apellido', full: true },
  { name: 'parentesco', label: 'Parentesco', type: 'select', optional: true, options: [
    { value: '', label: 'Seleccionar' },
    ...opts(['Padre', 'Madre', 'Hijo/a', 'Hermano/a', 'Cónyuge o pareja', 'Abuelo/a', 'Tío/a', 'Amigo/a', 'Otro']),
  ] },
  { name: 'telefono', label: 'Número telefónico', type: 'tel', placeholder: '987654321', maxlength: 9 },
  { name: 'email', label: 'Correo electrónico (opcional)', type: 'email', placeholder: 'contacto@correo.com', full: true, optional: true },
];

const CAMPOS_SALUD: CampoDef[] = [
  { name: 'tipoSangre', label: 'Tipo de sangre', type: 'select', optional: true, full: true, options: [
    { value: '', label: 'Sin registrar' }, ...opts(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
  ] },
  { name: 'alergias', label: 'Alergias conocidas', type: 'textarea', optional: true, full: true, maxlength: 500, placeholder: 'Medicamentos, alimentos, otros' },
  { name: 'enfermedades', label: 'Enfermedades preexistentes', type: 'textarea', optional: true, full: true, maxlength: 500 },
  { name: 'medicamentos', label: 'Medicamentos habituales', type: 'textarea', optional: true, full: true, maxlength: 500 },
  { name: 'observaciones', label: 'Observaciones médicas importantes', type: 'textarea', optional: true, full: true, maxlength: 500 },
];

const MENSAJES_PATRON: Record<string, string> = {
  email: 'Ingresa un correo válido, por ejemplo tu@correo.com.',
  telefono: 'Ingresa un celular de 9 dígitos que empiece con 9.',
};

/** Iconos de trazo (24x24). */
const ICONS: Record<string, string[]> = {
  user: ['M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7'],
  edit: ['M4 20h4L19 9l-4-4L4 16z', 'M13.5 6.5l4 4'],
  camera: ['M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z', 'M12 11a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z'],
  mail: ['M3 6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z', 'M3 7l9 6 9-6'],
  phone: ['M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z'],
  id: ['M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 10a1.5 1.5 0 1 0 0 .01', 'M6 16c.5-1.5 1.5-2 3-2s2.5.5 3 2', 'M14 10h4', 'M14 14h4'],
  calendar: ['M3 8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z', 'M8 3v4', 'M16 3v4', 'M3 10h18'],
  shield: ['M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z', 'M9 12l2 2 4-4'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  x: ['M6 6l12 12', 'M18 6L6 18'],
  eye: ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z', 'M9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0'],
  'eye-off': ['M3 3l18 18', 'M10.6 10.6a2 2 0 0 0 2.8 2.8', 'M9.9 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3 3.9', 'M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 4.2-1'],
  lock: ['M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z', 'M8 11V8a4 4 0 0 1 8 0v3'],
  alert: ['M12 3l10 18H2z', 'M12 10v5', 'M12 18h.01'],
  info: ['M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0', 'M12 11v5', 'M12 8h.01'],
  health: ['M12 21s-7-4.6-9.5-9A5.5 5.5 0 0 1 12 6.5 5.5 5.5 0 0 1 21.5 12C19 16.4 12 21 12 21z', 'M7 12h2l1.5-2.5 2 5 1.5-2.5h3'],
  bell: ['M18 16v-5a6 6 0 1 0-12 0v5l-2 2h16z', 'M10 21h4'],
  activity: ['M3 12h4l2.5-6 4 12 2.5-6H21'],
  contact: ['M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z', 'M15 3a6 6 0 0 1 6 6', 'M15 7a2 2 0 0 1 2 2'],
};

type Toast = { tipo: 'ok' | 'error'; texto: string };

/**
 * Sección «Mi perfil» de SaludYA (solo el contenido central: no incluye sidebar ni encabezado).
 *
 *   <app-perfil />
 *
 * Para conectar tu backend, registra tu implementación de PerfilApi:
 *   providers: [{ provide: PERFIL_API, useClass: MiPerfilApi }]
 *
 * Privacidad: los datos viven solo en memoria del componente (no se guardan en localStorage).
 */
@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [ReactiveFormsModule, NgTemplateOutlet],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.css',
})
export class PerfilComponent implements OnInit {
  private fb = inject(FormBuilder);
  private readonly injectedApi = inject(PERFIL_API, { optional: true });
  private readonly api: PerfilApi = this.injectedApi ?? crearApiDemo();

  /** true cuando no hay backend conectado y se muestran datos de prueba. */
  protected readonly demo = !this.injectedApi;

  protected readonly icons = ICONS;
  protected readonly camposPersonales = CAMPOS_PERSONALES;
  protected readonly camposEmergencia = CAMPOS_EMERGENCIA;
  protected readonly camposSalud = CAMPOS_SALUD;

  /* ----- Estado general ----- */
  protected readonly perfil = signal<PerfilPaciente | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly toast = signal<Toast | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  /* ----- Formularios (uno por tarjeta) ----- */
  protected readonly personalForm = this.fb.nonNullable.group({
    nombres: ['', [Validators.required, Validators.maxLength(60)]],
    apellidos: ['', [Validators.required, Validators.maxLength(60)]],
    tipoDocumento: ['DNI' as TipoDocumento, Validators.required],
    numeroDocumento: ['', [Validators.required, documentoValido]],
    fechaNacimiento: ['', [Validators.required, fechaNacimientoValida]],
    genero: [''],
    telefono: ['', [Validators.required, Validators.pattern(PHONE_RE)]],
    email: ['', [Validators.required, Validators.pattern(EMAIL_RE)]],
    direccion: ['', Validators.maxLength(120)],
    ciudad: ['', Validators.maxLength(60)],
    departamento: [''],
  });

  protected readonly emergenciaForm = this.fb.nonNullable.group({
    nombre: ['', [requeridoSiHayContacto, Validators.maxLength(100)]],
    parentesco: [''],
    telefono: ['', [requeridoSiHayContacto, Validators.pattern(PHONE_RE)]],
    email: ['', Validators.pattern(EMAIL_RE)],
  });

  protected readonly saludForm = this.fb.nonNullable.group({
    tipoSangre: [''],
    alergias: ['', Validators.maxLength(500)],
    enfermedades: ['', Validators.maxLength(500)],
    medicamentos: ['', Validators.maxLength(500)],
    observaciones: ['', Validators.maxLength(500)],
  });

  protected readonly passwordForm = this.fb.nonNullable.group(
    {
      actual: ['', Validators.required],
      nueva: ['', [Validators.required, Validators.minLength(8)]],
      confirmar: ['', Validators.required],
    },
    { validators: [passwordsCoinciden, nuevaDistintaDeActual] }
  );

  protected readonly formularios: Record<SeccionPerfil, FormGroup> = {
    personal: this.personalForm,
    emergencia: this.emergenciaForm,
    salud: this.saludForm,
  };

  /* ----- Edición / guardado ----- */
  protected readonly editing = signal<Record<SeccionPerfil, boolean>>({ personal: false, emergencia: false, salud: false });
  protected readonly saving = signal<SeccionPerfil | 'password' | null>(null);

  /* ----- Foto ----- */
  protected readonly fotoPreview = signal<string | null>(null);
  protected readonly subiendoFoto = signal(false);

  /* ----- Contraseña ----- */
  protected readonly showPassword = signal(false);
  private readonly nuevaPassword = toSignal(this.passwordForm.controls.nueva.valueChanges, { initialValue: '' });
  protected readonly requisitos = computed(() => {
    const v = this.nuevaPassword();
    return [
      { texto: 'Al menos 8 caracteres', ok: v.length >= 8 },
      { texto: 'Mayúsculas y minúsculas', ok: /[a-z]/.test(v) && /[A-Z]/.test(v) },
      { texto: 'Al menos un número', ok: /\d/.test(v) },
      { texto: 'Al menos un símbolo', ok: /[^A-Za-z0-9]/.test(v) },
    ];
  });
  protected readonly fuerza = computed(() => {
    const puntos = this.requisitos().filter((r) => r.ok).length;
    const vacia = this.nuevaPassword().length === 0;
    const etiquetas = ['Débil', 'Débil', 'Media', 'Buena', 'Fuerte'];
    return { puntos: vacia ? 0 : Math.max(1, puntos), etiqueta: vacia ? '' : etiquetas[puntos] };
  });

  /* ----- Verificaciones y actividad ----- */
  protected readonly verificando = signal<'email' | 'telefono' | null>(null);
  protected readonly actividadAbierta = signal(false);
  protected readonly actividadLoading = signal(false);
  protected readonly actividadError = signal(false);
  protected readonly actividad = signal<ActividadCuenta[]>([]);

  /* ----- Derivados ----- */
  protected readonly nombreCompleto = computed(() => {
    const p = this.perfil();
    return p ? `${p.nombres} ${p.apellidos}`.trim() : '';
  });
  protected readonly iniciales = computed(() => {
    const p = this.perfil();
    return p ? `${p.nombres.charAt(0)}${p.apellidos.charAt(0)}`.toUpperCase() : '';
  });
  protected readonly edad = computed(() => calcularEdad(this.perfil()?.fechaNacimiento));

  constructor() {
    // Mantiene sincronizados los campos que dependen unos de otros
    this.personalForm.controls.tipoDocumento.valueChanges.pipe(takeUntilDestroyed()).subscribe(() =>
      this.personalForm.controls.numeroDocumento.updateValueAndValidity()
    );
    this.emergenciaForm.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.emergenciaForm.controls.nombre.updateValueAndValidity({ emitEvent: false });
      this.emergenciaForm.controls.telefono.updateValueAndValidity({ emitEvent: false });
    });
    // Al inicio las tarjetas están en modo visualización
    Object.values(this.formularios).forEach((f) => f.disable({ emitEvent: false }));
  }

  ngOnInit(): void {
    this.cargar();
  }

  /* =====================================================================
   *  CARGA
   * ===================================================================== */
  protected cargar(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.api.obtener().subscribe({
      next: (p) => {
        this.aplicarPerfil(p);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }

  private aplicarPerfil(p: PerfilPaciente): void {
    this.perfil.set(p);
    this.personalForm.reset({
      nombres: p.nombres, apellidos: p.apellidos, tipoDocumento: p.tipoDocumento, numeroDocumento: p.numeroDocumento,
      fechaNacimiento: p.fechaNacimiento, genero: p.genero ?? '', telefono: p.telefono, email: p.email,
      direccion: p.direccion ?? '', ciudad: p.ciudad ?? '', departamento: p.departamento ?? '',
    });
    this.emergenciaForm.reset({
      nombre: p.contactoEmergencia?.nombre ?? '', parentesco: p.contactoEmergencia?.parentesco ?? '',
      telefono: p.contactoEmergencia?.telefono ?? '', email: p.contactoEmergencia?.email ?? '',
    });
    this.saludForm.reset({
      tipoSangre: p.salud?.tipoSangre ?? '', alergias: p.salud?.alergias ?? '', enfermedades: p.salud?.enfermedades ?? '',
      medicamentos: p.salud?.medicamentos ?? '', observaciones: p.salud?.observaciones ?? '',
    });
  }

  /* =====================================================================
   *  EDICIÓN Y GUARDADO
   * ===================================================================== */
  protected editar(seccion: SeccionPerfil): void {
    this.formularios[seccion].enable({ emitEvent: false });
    this.editing.update((e) => ({ ...e, [seccion]: true }));
  }

  protected cancelar(seccion: SeccionPerfil): void {
    const p = this.perfil();
    if (p) this.aplicarPerfil(p); // descarta los cambios
    Object.entries(this.editing()).forEach(([k, v]) => {
      if (k !== seccion && v) this.formularios[k as SeccionPerfil].enable({ emitEvent: false });
    });
    this.formularios[seccion].disable({ emitEvent: false });
    this.editing.update((e) => ({ ...e, [seccion]: false }));
  }

  /** Botón «Editar perfil» del encabezado: abre la información personal. */
  protected editarPerfil(): void {
    this.editar('personal');
    document.getElementById('perfil-personal')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected guardar(seccion: SeccionPerfil): void {
    const form = this.formularios[seccion];
    if (form.invalid) {
      form.markAllAsTouched();
      this.notificar('error', 'Revisa los campos marcados antes de guardar.');
      return;
    }
    this.saving.set(seccion);
    this.api.actualizar(seccion, form.getRawValue()).subscribe({
      next: (p) => {
        this.aplicarPerfil(p);
        form.disable({ emitEvent: false });
        this.editing.update((e) => ({ ...e, [seccion]: false }));
        this.saving.set(null);
        this.notificar('ok', 'Tus cambios se guardaron correctamente.');
      },
      error: () => {
        this.saving.set(null);
        this.notificar('error', 'No pudimos guardar los cambios. Inténtalo nuevamente.');
      },
    });
  }

  /* =====================================================================
   *  FOTO DE PERFIL
   * ===================================================================== */
  protected onFoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;

    if (!TIPOS_FOTO.includes(archivo.type)) {
      this.notificar('error', 'Elige una imagen JPG, PNG o WebP.');
      return;
    }
    if (archivo.size > MAX_FOTO_BYTES) {
      this.notificar('error', 'La imagen no puede superar los 2 MB.');
      return;
    }

    const previa = URL.createObjectURL(archivo);
    this.fotoPreview.set(previa);
    this.subiendoFoto.set(true);
    this.api.subirFoto(archivo).subscribe({
      next: ({ fotoUrl }) => {
        this.perfil.update((p) => (p ? { ...p, fotoUrl } : p));
        this.fotoPreview.set(null);
        this.subiendoFoto.set(false);
        this.notificar('ok', 'Tu foto de perfil se actualizó.');
      },
      error: () => {
        URL.revokeObjectURL(previa);
        this.fotoPreview.set(null);
        this.subiendoFoto.set(false);
        this.notificar('error', 'No pudimos subir la foto. Inténtalo nuevamente.');
      },
    });
  }

  /* =====================================================================
   *  SEGURIDAD
   * ===================================================================== */
  protected cambiarPassword(): void {
    const f = this.passwordForm;
    if (f.invalid) {
      f.markAllAsTouched();
      return;
    }
    const { actual, nueva } = f.getRawValue();
    this.saving.set('password');
    this.api.cambiarPassword(actual, nueva).subscribe({
      next: () => {
        f.reset();
        this.saving.set(null);
        this.notificar('ok', 'Tu contraseña se actualizó correctamente.');
      },
      error: () => {
        this.saving.set(null);
        this.notificar('error', 'No pudimos cambiar la contraseña. Verifica tu contraseña actual e inténtalo nuevamente.');
      },
    });
  }

  protected verificar(tipo: 'email' | 'telefono'): void {
    this.verificando.set(tipo);
    const peticion = tipo === 'email' ? this.api.solicitarVerificacionEmail() : this.api.solicitarVerificacionTelefono();
    peticion.subscribe({
      next: () => {
        this.verificando.set(null);
        this.notificar('ok', tipo === 'email' ? 'Enviamos la solicitud de verificación de tu correo.' : 'Enviamos la solicitud de verificación de tu teléfono.');
      },
      error: () => {
        this.verificando.set(null);
        this.notificar('error', 'No pudimos enviar la solicitud. Inténtalo nuevamente.');
      },
    });
  }

  protected abrirActividad(): void {
    this.actividadAbierta.set(true);
    this.actividadLoading.set(true);
    this.actividadError.set(false);
    this.api.actividadReciente().subscribe({
      next: (lista) => {
        this.actividad.set(lista);
        this.actividadLoading.set(false);
      },
      error: () => {
        this.actividadError.set(true);
        this.actividadLoading.set(false);
      },
    });
  }

  @HostListener('document:keydown.escape')
  protected cerrarActividad(): void {
    this.actividadAbierta.set(false);
  }

  /* =====================================================================
   *  NOTIFICACIONES
   * ===================================================================== */
  protected cambiarNotificacion(clave: keyof PreferenciasNotificacion): void {
    const p = this.perfil();
    if (!p) return;
    const anterior = p.notificaciones;
    const nuevas = { ...anterior, [clave]: !anterior[clave] };
    this.perfil.set({ ...p, notificaciones: nuevas }); // se refleja de inmediato
    this.api.guardarNotificaciones(nuevas).subscribe({
      next: () => this.notificar('ok', 'Preferencias de notificaciones guardadas.'),
      error: () => {
        this.perfil.update((x) => (x ? { ...x, notificaciones: anterior } : x)); // revierte
        this.notificar('error', 'No pudimos guardar tu preferencia. Inténtalo nuevamente.');
      },
    });
  }

  /* =====================================================================
   *  UTILIDADES DE LA VISTA
   * ===================================================================== */
  protected notificar(tipo: Toast['tipo'], texto: string): void {
    this.toast.set({ tipo, texto });
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 6000);
  }

  protected cerrarToast(): void {
    this.toast.set(null);
  }

  /** Mensaje de error de un campo (solo después de que el usuario lo toca). */
  protected error(form: FormGroup, name: string): string | null {
    const c = form.get(name);
    if (!c || c.disabled || c.valid || !(c.touched || c.dirty)) return null;
    const e = c.errors ?? {};
    if (e['required']) return 'Este campo es obligatorio.';
    if (e['documento']) return e['documento'] as string;
    if (e['pattern']) return MENSAJES_PATRON[name] ?? 'El formato no es válido.';
    if (e['futura']) return 'La fecha de nacimiento no puede ser futura.';
    if (e['edadMaxima']) return 'Revisa la fecha de nacimiento.';
    if (e['maxlength']) return `Máximo ${e['maxlength'].requiredLength} caracteres.`;
    return 'Revisa este campo.';
  }

  protected errorPassword(name: 'actual' | 'nueva' | 'confirmar'): string | null {
    const f = this.passwordForm;
    const c = f.controls[name];
    if (!(c.touched || c.dirty)) return null;
    if (c.hasError('required')) return name === 'actual' ? 'Ingresa tu contraseña actual.' : name === 'nueva' ? 'Ingresa una nueva contraseña.' : 'Confirma tu nueva contraseña.';
    if (name === 'nueva' && c.hasError('minlength')) return 'La contraseña debe tener al menos 8 caracteres.';
    if (name === 'nueva' && f.hasError('igualActual')) return 'La nueva contraseña debe ser distinta de la actual.';
    if (name === 'confirmar' && f.hasError('mismatch')) return 'Las contraseñas no coinciden.';
    return null;
  }

  protected fechaLarga(iso: string | null | undefined): string {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  protected fechaHora(iso: string): string {
    return new Date(iso).toLocaleString('es-PE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  protected generoTexto(valor: string | undefined): string {
    const mapa: Record<string, string> = { femenino: 'Femenino', masculino: 'Masculino', otro: 'Otro', 'prefiero-no-decirlo': 'Prefiero no decirlo' };
    return (valor && mapa[valor]) || 'Sin especificar';
  }

  protected documentoTexto(p: PerfilPaciente): string {
    const etiqueta = p.tipoDocumento === 'CE' ? 'CE' : p.tipoDocumento === 'PASAPORTE' ? 'Pasaporte' : 'DNI';
    return `${etiqueta} ${p.numeroDocumento}`;
  }
}
