# Cyber Sort

Aplicación FastAPI para registrar participantes y sortearlos en equipos equilibrados de 2 o 3. Cada sorteo queda guardado como una instantánea permanente en PostgreSQL.

## Ejecutar localmente

1. Crea una base PostgreSQL llamada `cybersort` y un usuario con permisos sobre ella.
2. Copia `.env.example` a `.env` y ajusta `DATABASE_URL`, `ADMIN_USERNAME` y `ADMIN_PASSWORD`.
3. Instala dependencias y arranca la aplicación:

   ```bash
   python -m venv .venv
   . .venv/bin/activate
   pip install -r requirements.txt
   uvicorn app.main:app --reload
   ```

Las tablas se crean al arrancar. Abre `/` para registrar nombres, `/admin` para ejecutar un sorteo (HTTP Basic Auth) y `/results` para consultar siempre el último resultado.

## API de resultados

- `GET /api/results`: resultado más reciente; antes del primer sorteo devuelve `draw_id: null` y una lista `teams` vacía.
- `GET /api/results/{draw_id}`: resultado de un sorteo archivado; responde `404` si no existe.

Cada respuesta incluye `draw_id`, `created_at`, `total_participants` y `teams`, con número, tamaño y nombres de sus integrantes.

Los participantes usados en un sorteo se archivan y dejan de estar en la lista pendiente. Los nuevos registros quedan para la siguiente ronda. Con un total múltiplo de 3 se forman equipos de 3; con sobrantes, el sistema redistribuye equilibradamente en equipos de 2 y 3 para no dejar a nadie solo. Se requieren al menos 2 participantes.
