# 📈 InverSim

Simulador web de inversión en acciones con **dinero ficticio**, pensado para jóvenes sin experiencia.

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite + Recharts |
| Backend | Python + FastAPI |
| Base de datos | SQLite (por defecto) o PostgreSQL, vía SQLAlchemy 2 |

```
inversim/
├── backend/
│   ├── main.py          # Rutas de la API REST
│   ├── models.py        # Modelo de datos (SQLAlchemy)
│   ├── simulator.py     # Simulador de precios (movimiento browniano geométrico)
│   ├── database.py      # Conexión a la BD
│   ├── schema.sql       # Esquema SQL de referencia
│   └── requirements.txt
└── frontend/
    ├── vite.config.js   # Proxy /api -> backend :8000
    └── src/             # App.jsx, api.js, components/…
```

## Novedades de la v2

- 🔐 **Login y registro reales** (bcrypt + JWT). Las rutas del simulador exigen sesión.
- 🧭 **Tutorial guiado** la primera vez que entras (se puede repetir desde «Ver tutorial»).
- 🎓 **Mentor IA** (`POST /api/analisis-ia`) con Gemini u OpenAI; sin clave funciona en modo demo.
- 💬 **Chat de aprendizaje Botpress** como burbuja independiente para dudas y conceptos; se carga con el embed público generado desde Botpress Webchat.
- 📊 **Mi progreso**: evolución del capital y **evaluación (quiz)** generada con tus propias operaciones.

Configura el backend copiando `backend/.env.example` a `backend/.env`.
**Si vienes de la v1, borra `backend/inversim.db`** (la tabla de usuarios cambió y los datos son ficticios).

## Requisitos

- Python 3.10+
- Node.js 18+

## Levantar el proyecto (2 terminales)

### 1) Backend — http://127.0.0.1:8000

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Al arrancar se crean las tablas, se siembran 5 empresas con historial inicial y empieza el simulador (un tick cada 3 s, equivalente aproximadamente a una hora de mercado simulado). Los precios son ficticios: no siguen el saldo del usuario ni cotizaciones en tiempo real. AgroFuturo varía menos; BioSalud y GameVerse, más.
Documentación interactiva de la API: http://127.0.0.1:8000/docs

> Usa **un solo worker** de uvicorn (no `--workers N`): cada proceso lanzaría su propio simulador.

### 2) Frontend — http://localhost:5173

```bash
cd frontend
npm install
npm run dev
```

Abre http://localhost:5173, crea una cuenta y recibirás el equivalente a **$1.000.000 COP** en dinero ficticio. El saldo se almacena en USD. Para convertir monedas, la app usa la TRM diaria publicada por la Superintendencia Financiera de Colombia para COP y tasas de referencia diarias del Banco Central Europeo para EUR, CNY, MXN, BRL, GBP, JPY, CAD, CHF y AUD. Muestra las dos fuentes y sus fechas de vigencia; el botón de actualización vuelve a consultarlas. Son tasas de referencia, no cotizaciones en tiempo real ni ofertas de transacción. Las acciones siguen siendo simuladas.

## Cómo se conectan

El navegador llama a rutas relativas `/api/...`. En desarrollo, `vite.config.js` las reenvía a `http://127.0.0.1:8000`
(sin problemas de CORS). El frontend consulta precios, saldo y portafolio cada 3 s (polling), igual que el simulador.

Para desplegar con otro dominio, define `VITE_API_URL=https://tu-api.com` antes de `npm run build`
y agrega ese origen en `allow_origins` (CORS) de `backend/main.py`.

## Usar PostgreSQL (opcional)

```bash
pip install psycopg2-binary
export DATABASE_URL="postgresql+psycopg2://usuario:clave@localhost:5432/inversim"
uvicorn main:app --port 8000
```

## API

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/registro` | Crea cuenta (nombre, correo, password) → token + saldo equivalente a $1.000.000 COP |
| POST | `/api/login` | Inicia sesión → token |
| GET | `/api/tasa-cambio` | Tasas de referencia oficiales para USD, COP, EUR, CNY, MXN, BRL, GBP, JPY, CAD, CHF y AUD |
| POST | `/api/tasa-cambio/actualizar` | Consulta manual de tasas vigentes (con límite de una solicitud por minuto) |
| GET | `/api/me` | Usuario autenticado 🔒 |
| POST | `/api/me/tutorial-completado` | Marca el tutorial como visto 🔒 |
| GET | `/api/me/portafolio` | Saldo, posiciones, ganancia/pérdida y patrimonio 🔒 |
| GET | `/api/me/transacciones` | Historial de operaciones 🔒 |
| POST | `/api/analisis-ia` | Mentor IA: explica tus decisiones 🔒 |
| GET | `/api/me/progreso` | Serie de patrimonio, resumen y estado del ciclo 🔒 |
| GET | `/api/me/evaluacion` | Genera/recupera el quiz del ciclo 🔒 |
| POST | `/api/me/evaluacion/{id}/responder` | Califica el quiz 🔒 |
| GET | `/api/acciones` | Acciones con precio actual y % de cambio |
| GET | `/api/acciones/{id}/historial?limite=80` | Serie de precios para el gráfico |
| POST | `/api/transacciones` | Compra/venta (`id_accion, tipo_operacion, cantidad`) 🔒 |

Ejemplo:

```bash
curl -X POST http://127.0.0.1:8000/api/transacciones \
  -H "Authorization: Bearer TU_TOKEN" -H "Content-Type: application/json" \
  -d '{"id_accion":1,"tipo_operacion":"compra","cantidad":10}'
```

Validaciones: compra → saldo suficiente; venta → acciones suficientes (HTTP 400 con mensaje claro).
En ventas, la respuesta incluye `ganancia_realizada` (precio de venta − costo promedio) × cantidad.

## El simulador de mercado

Cada tick, para cada acción:

```
S(t+1) = S(t) · exp( μ + k·ln(S_base / S(t)) − σ²/2 + σ·Z ),   Z ~ N(0,1)
```

- **σ** (volatilidad) distinta por empresa: AgroFuturo y TechCorp varían menos; BioSalud y GameVerse más.
- **μ** deriva pequeña de fondo.
- **k** reversión suave hacia el precio base, para que nada se dispare ni colapse.
- El cambio por tick se limita a ±2.5 % y el precio mínimo es $1. Son cotizaciones ficticias para practicar, no precios reales ni recomendación de inversión.

Ajusta las constantes y empresas en `backend/simulator.py`.

## Notas y límites del prototipo

- Autenticación básica: el token JWT se guarda en `localStorage`. Para producción añade HTTPS, límite de intentos de login, recuperación de contraseña y verificación de correo.
- Los importes usan `float` por simplicidad; en producción usa `Numeric/Decimal`.
- Para escalar a muchos usuarios, mueve el simulador a un proceso/worker aparte y usa WebSockets en lugar de polling.
- Herramienta educativa; no es asesoría financiera.
