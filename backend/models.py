"""Modelo de datos de InverSim (v2: autenticación, snapshots y evaluaciones)."""
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, CheckConstraint, DateTime, Float, ForeignKey, Index, Integer, String, Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base

CAPITAL_INICIAL_LEGACY = 10_000.0
TIPOS_MOVIMIENTO = ("inicial", "compra", "venta", "recarga", "retiro")


def ahora():
    return datetime.now(timezone.utc)


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(50), nullable=False)
    correo: Mapped[str] = mapped_column(String(120), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    tutorial_completado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # --- NUEVO (Paso 1: perfil y preferencias) ---
    foto_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    idioma: Mapped[str] = mapped_column(String(5), nullable=False, default="es", server_default="es")
    tema: Mapped[str] = mapped_column(String(10), nullable=False, default="claro", server_default="claro")
    # ---------------------------------------------
    saldo_ficticio: Mapped[float] = mapped_column(Float, nullable=False, default=CAPITAL_INICIAL_LEGACY)
    saldo_inicial: Mapped[float] = mapped_column(
        Float, nullable=False, default=CAPITAL_INICIAL_LEGACY, server_default=str(CAPITAL_INICIAL_LEGACY)
    )
    creado_en: Mapped[datetime] = mapped_column(DateTime, default=ahora)

    transacciones: Mapped[list["Transaccion"]] = relationship(back_populates="usuario")

    __table_args__ = (
        CheckConstraint("saldo_ficticio >= 0", name="ck_saldo_no_negativo"),
        CheckConstraint("tema IN ('claro','oscuro')", name="ck_tema_valido"),
    )


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    id_usuario: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=ahora)
    expira_en: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    usado_en: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    __table_args__ = (Index("ix_password_reset_usuario_expira", "id_usuario", "expira_en"),)



class Accion(Base):
    __tablename__ = "acciones"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre_empresa: Mapped[str] = mapped_column(String(80), nullable=False)
    ticker: Mapped[str] = mapped_column(String(10), nullable=False, unique=True)
    precio_actual: Mapped[float] = mapped_column(Float, nullable=False)

    # Parámetros del simulador (por tick de ~3 s)
    precio_base: Mapped[float] = mapped_column(Float, nullable=False)  # valor "justo" a largo plazo
    volatilidad: Mapped[float] = mapped_column(Float, nullable=False)  # sigma
    deriva: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)  # mu

    transacciones: Mapped[list["Transaccion"]] = relationship(back_populates="accion")
    historial: Mapped[list["PrecioHistorico"]] = relationship(back_populates="accion")


class Transaccion(Base):
    __tablename__ = "transacciones"

    id: Mapped[int] = mapped_column(primary_key=True)
    id_usuario: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), nullable=False, index=True)
    id_accion: Mapped[int] = mapped_column(ForeignKey("acciones.id"), nullable=False, index=True)
    tipo_operacion: Mapped[str] = mapped_column(String(10), nullable=False)  # 'compra' | 'venta'
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False)
    precio_historico: Mapped[float] = mapped_column(Float, nullable=False)  # precio al ejecutarse
    fecha: Mapped[datetime] = mapped_column(DateTime, default=ahora)

    usuario: Mapped[Usuario] = relationship(back_populates="transacciones")
    accion: Mapped[Accion] = relationship(back_populates="transacciones")

    __table_args__ = (
        CheckConstraint("tipo_operacion IN ('compra','venta')", name="ck_tipo_operacion"),
        CheckConstraint("cantidad > 0", name="ck_cantidad_positiva"),
    )


class PrecioHistorico(Base):
    """Serie de tiempo de precios: alimenta el gráfico en vivo."""

    __tablename__ = "precios_historicos"

    id: Mapped[int] = mapped_column(primary_key=True)
    id_accion: Mapped[int] = mapped_column(ForeignKey("acciones.id"), nullable=False)
    precio: Mapped[float] = mapped_column(Float, nullable=False)
    fecha: Mapped[datetime] = mapped_column(DateTime, default=ahora)

    accion: Mapped[Accion] = relationship(back_populates="historial")

    __table_args__ = (Index("ix_precios_accion_id", "id_accion", "id"),)


# ===================== NUEVO (módulo 4: progreso y evaluación) =====================
class SnapshotPatrimonio(Base):
    """Foto periódica del patrimonio de cada usuario → gráfico "Mi progreso"."""

    __tablename__ = "snapshots_patrimonio"

    id: Mapped[int] = mapped_column(primary_key=True)
    id_usuario: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), nullable=False)
    fecha: Mapped[datetime] = mapped_column(DateTime, default=ahora)
    saldo: Mapped[float] = mapped_column(Float, nullable=False)  # efectivo
    valor_inversiones: Mapped[float] = mapped_column(Float, nullable=False)  # acciones a precio de mercado
    patrimonio: Mapped[float] = mapped_column(Float, nullable=False)  # saldo + valor_inversiones

    __table_args__ = (Index("ix_snapshots_usuario_id", "id_usuario", "id"),)


class Evaluacion(Base):
    """Quiz generado a partir de lo que hizo el usuario en un ciclo de operaciones."""

    __tablename__ = "evaluaciones"

    id: Mapped[int] = mapped_column(primary_key=True)
    id_usuario: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), nullable=False, index=True)
    creada_en: Mapped[datetime] = mapped_column(DateTime, default=ahora)
    completada_en: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Última transacción incluida al crearla: define dónde empieza el siguiente ciclo.
    hasta_transaccion_id: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    preguntas_json: Mapped[str] = mapped_column(Text, nullable=False)  # incluye respuestas correctas (solo servidor)
    respuestas_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    puntaje: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total: Mapped[int] = mapped_column(Integer, nullable=False)


class Feedback(Base):
    """Comentarios de los usuarios. Solo se escribe desde la API; no se expone para lectura."""

    __tablename__ = "feedback"

    id: Mapped[int] = mapped_column(primary_key=True)
    id_usuario: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), nullable=False, index=True)
    comentario: Mapped[str] = mapped_column(Text, nullable=False)
    fecha: Mapped[datetime] = mapped_column(DateTime, default=ahora)


class MovimientoBilletera(Base):
    """Libro de la billetera: cada cambio en el saldo del usuario deja un asiento."""

    __tablename__ = "movimientos_billetera"

    id: Mapped[int] = mapped_column(primary_key=True)
    id_usuario: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), nullable=False)
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)  # ver TIPOS_MOVIMIENTO
    monto: Mapped[float] = mapped_column(Float, nullable=False)  # + ingresa efectivo, - sale
    saldo_posterior: Mapped[float] = mapped_column(Float, nullable=False)
    descripcion: Mapped[str] = mapped_column(String(200), nullable=False)
    id_transaccion: Mapped[int | None] = mapped_column(ForeignKey("transacciones.id"), nullable=True)
    fecha: Mapped[datetime] = mapped_column(DateTime, default=ahora)

    __table_args__ = (Index("ix_movimientos_usuario_id", "id_usuario", "id"),)