"""Template for generating Alembic migration scripts."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'replace_with_revision_id'
down_revision = None
branch_labels = None
depends_on = None
def upgrade():
    # Write your upgrade commands here.
    # Example: create a table
    pass


def downgrade():
    # Write your downgrade commands here.
    # Example: drop a table
    pass