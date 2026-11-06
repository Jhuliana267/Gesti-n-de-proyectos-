-- Esquema de referencia de InverSim v2 (SQLite / PostgreSQL).
-- La app lo crea automáticamente con SQLAlchemy (Base.metadata.create_all);
-- este archivo es solo documentación / para crearlo a mano.

CREATE TABLE usuarios (
    id                  INTEGER PRIMARY KEY,           -- SERIAL en PostgreSQL
    nombre              VARCHAR(50)  NOT NULL,
    correo              VARCHAR(120) NOT NULL UNIQUE,  -- NUEVO v2
    password_hash       VARCHAR(128) NOT NULL,         -- NUEVO v2 (bcrypt)
    tutorial_completado BOOLEAN NOT NULL DEFAULT FALSE,-- NUEVO v2
    saldo_ficticio      FLOAT NOT NULL DEFAULT 10000 CHECK (saldo_ficticio >= 0),
    saldo_inicial       FLOAT NOT NULL DEFAULT 10000,
    creado_en           TIMESTAMP NOT NULL
);

CREATE TABLE acciones (
    id             INTEGER PRIMARY KEY,
    nombre_empresa VARCHAR(80) NOT NULL,
    ticker         VARCHAR(10) NOT NULL UNIQUE,
    precio_actual  FLOAT NOT NULL,
    precio_base    FLOAT NOT NULL,                -- valor "justo" de largo plazo
    volatilidad    FLOAT NOT NULL,                -- sigma por tick
    deriva         FLOAT NOT NULL DEFAULT 0       -- mu por tick
);

CREATE TABLE transacciones (
    id               INTEGER PRIMARY KEY,
    id_usuario       INTEGER NOT NULL REFERENCES usuarios(id),
    id_accion        INTEGER NOT NULL REFERENCES acciones(id),
    tipo_operacion   VARCHAR(10) NOT NULL CHECK (tipo_operacion IN ('compra','venta')),
    cantidad         INTEGER NOT NULL CHECK (cantidad > 0),
    precio_historico FLOAT NOT NULL,              -- precio al que se ejecutó
    fecha            TIMESTAMP NOT NULL
);
CREATE INDEX ix_transacciones_usuario ON transacciones(id_usuario);
CREATE INDEX ix_transacciones_accion  ON transacciones(id_accion);

-- Serie de tiempo para el gráfico en vivo
CREATE TABLE precios_historicos (
    id        INTEGER PRIMARY KEY,
    id_accion INTEGER NOT NULL REFERENCES acciones(id),
    precio    FLOAT NOT NULL,
    fecha     TIMESTAMP NOT NULL
);
CREATE INDEX ix_precios_accion_id ON precios_historicos(id_accion, id);

-- NUEVO v2: evolución del patrimonio de cada usuario ("Mi progreso")
CREATE TABLE snapshots_patrimonio (
    id                INTEGER PRIMARY KEY,
    id_usuario        INTEGER NOT NULL REFERENCES usuarios(id),
    fecha             TIMESTAMP NOT NULL,
    saldo             FLOAT NOT NULL,             -- efectivo
    valor_inversiones FLOAT NOT NULL,             -- acciones a precio de mercado
    patrimonio        FLOAT NOT NULL              -- saldo + valor_inversiones
);
CREATE INDEX ix_snapshots_usuario_id ON snapshots_patrimonio(id_usuario, id);

-- NUEVO v2: quizzes generados por ciclo de operaciones
CREATE TABLE evaluaciones (
    id                   INTEGER PRIMARY KEY,
    id_usuario           INTEGER NOT NULL REFERENCES usuarios(id),
    creada_en            TIMESTAMP NOT NULL,
    completada_en        TIMESTAMP,
    hasta_transaccion_id INTEGER NOT NULL DEFAULT 0,  -- dónde termina el ciclo evaluado
    preguntas_json       TEXT NOT NULL,               -- incluye respuestas correctas (solo servidor)
    respuestas_json      TEXT,
    puntaje              INTEGER,
    total                INTEGER NOT NULL
);
CREATE INDEX ix_evaluaciones_usuario ON evaluaciones(id_usuario);
