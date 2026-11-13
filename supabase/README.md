# Despliegue de SaludYA CRM en Supabase

La aplicación ya usa el proyecto `spefixwemgfbndnofzei`. La migración crea el
modelo relacional, las restricciones, las políticas RLS, las funciones de
reserva atómica y Realtime.

## Aplicar el esquema

1. Instala e inicia sesión en la CLI: `npx supabase login`.
2. Desde esta carpeta ejecuta:

   ```powershell
     npx supabase link --project-ref spefixwemgfbndnofzei
   npx supabase db push
   ```

   Como alternativa, abre el **SQL Editor** de Supabase y ejecuta el contenido
   de `migrations/20261103160000_crm_szaludya.sql` una única vez.

3. En **Authentication > URL Configuration**, agrega las URLs de desarrollo y
   producción de tu aplicación a `Site URL` y `Redirect URLs`.

4. Crea la cuenta administradora mediante un registro normal y, desde SQL
   Editor (sustituye el correo), ejecuta:

   ```sql
   update public.profiles
   set role = 'admin'
   where email = 'admin@tudominio.com';
   ```

   Nunca habilites el rol `admin` desde el formulario público. La migración lo
   impide expresamente.

## Modelo resultante

`auth.users` → `profiles` → `doctors` → `doctor_availability` / `doctor_slots`

`profiles (patient)` → `appointments` ← `doctors`

Cada cita tiene `appointment_changes`, puede tener `messages` y como máximo un
`medical_records`. El administrador puede ver la agenda y gestionar médicos;
no obtiene acceso al contenido clínico del paciente.

Las funciones `book_appointment`, `reschedule_appointment` y
`change_appointment_status` bloquean el slot durante la operación para impedir
reservas dobles incluso si dos pacientes intentan elegir la misma hora.

## Verificación de médicos y aviso al administrador

La migración `20261109090000_doctor_verification.sql` añade el proceso de
verificación profesional. Un médico adjunta de una a cuatro imágenes de su
licencia, tarjeta profesional o credencial; estas se almacenan de forma
privada. No aparece en el directorio hasta que un administrador aprueba la
solicitud desde `/admin`.

Después de aplicar esa migración, despliega la función de notificación:

```powershell
npx supabase functions deploy notify-doctor-verification
```

El correo se envía por Resend. Crea una cuenta en Resend, verifica un dominio o
una dirección remitente y configura los secretos **sin incluirlos en Angular ni
en Git**:

```powershell
npx supabase secrets set RESEND_API_KEY=re_xxxxxxxxx
npx supabase secrets set NOTIFICATION_FROM="SaludYA <verificaciones@tu-dominio.com>"
npx supabase secrets set ADMIN_NOTIFICATION_EMAIL=rosalesnacho914@gmail.com
```

Sin esos tres secretos, la solicitud y los documentos sí se guardan y aparecen
en el panel administrativo, pero el aviso automático por email no se enviará.
