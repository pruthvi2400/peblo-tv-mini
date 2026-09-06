from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import MetaData

# Use PostgreSQL naming convention for constraints and indexes
naming_convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s"
}

# Create the base class for SQLAlchemy models
Base = declarative_base(
    metadata=MetaData(naming_convention=naming_convention)
)