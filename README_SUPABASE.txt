CONFIGURACIÓN SUPABASE PARA LA WEB DE LUIS ALADRO

1. SQL Editor
   Ejecuta el archivo supabase_setup.sql para crear la tabla articles y las políticas RLS.

2. Storage
   Crea un bucket llamado exactamente:
   article-images

   Debe ser Public bucket para que las imágenes puedan verse en la web pública.
   Después ejecuta también la parte de políticas de Storage incluida en supabase_setup.sql.

3. Authentication
   En Authentication > Users crea tu usuario administrador con email y contraseña.
   Ese email y esa contraseña son los que usarás en el área privada de la web.

4. GitHub
   Sube estos archivos sustituyendo los actuales:
   - index.html
   - styles.css
   - script.js
   - supabase-config.js
   - datos.txt

5. Importante
   La URL de Supabase usada en supabase-config.js no debe terminar en /rest/v1/.
   Debe ser la URL base del proyecto: https://mwkydgulwssdmuizhpmf.supabase.co

   La clave incluida es publishable/anon y es apta para navegador si RLS está activado.
   No subas nunca claves secretas o service_role a GitHub.
